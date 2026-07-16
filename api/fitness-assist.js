// AI fitness coach backed by Gemini. Chat with the user's fitness data as
// context (workouts, activities, gear). Can log workouts via a tool call —
// executed client-side under the user's own RLS session, same pattern as
// the other assistants. Requires GEMINI_API_KEY in Vercel env.

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'log_workout',
      description: "Log a workout for the user (e.g. 'I did 3 sets of 20 push-ups').",
      parameters: {
        type: 'OBJECT',
        properties: {
          exercise: { type: 'STRING', description: 'pushups, situps, pullups, running, cycling, strength, or custom' },
          custom_name: { type: 'STRING', description: 'Name if exercise is custom or strength (e.g. Bench press)' },
          sets: { type: 'NUMBER' }, reps: { type: 'NUMBER' }, weight_kg: { type: 'NUMBER' },
          duration_min: { type: 'NUMBER' }, distance_km: { type: 'NUMBER' },
          performed_at: { type: 'STRING', description: 'ISO datetime, optional — defaults to now' },
          notes: { type: 'STRING' },
        },
        required: ['exercise'],
      },
    },
  ],
}]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' })

  const { messages, context, pendingFunctionResults } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array is required' })
  if (messages.length > 40) return res.status(400).json({ error: 'Too many messages' })
  for (const m of messages) {
    if (typeof m?.content !== 'string' || m.content.length > 8000) return res.status(400).json({ error: 'Each message must be a string under 8000 characters' })
  }
  if (pendingFunctionResults && (!Array.isArray(pendingFunctionResults) || pendingFunctionResults.length > 10)) {
    return res.status(400).json({ error: 'Invalid pendingFunctionResults' })
  }

  const systemInstruction = [
    "You are an AI fitness coach inside a personal dashboard app.",
    "Use the fitness data snapshot below to analyze workout history, spot trends and plateaus, summarize weekly performance, recommend workouts, progressions, recovery days, and training plans, and answer fitness questions with concrete references to the user's actual data.",
    "You can log workouts with the log_workout tool when the user describes one — do it directly rather than telling them to.",
    "Give practical, encouraging, specific advice. You are not a medical professional — for pain, injuries, or health conditions, briefly recommend seeing a professional.",
    "Be concise; plain text, minimal markdown.",
    context ? `\n\n--- Fitness data snapshot ---\n${String(context).slice(0, 14000)}` : '',
  ].join(' ')

  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  if (pendingFunctionResults?.length) {
    contents.push({
      role: 'model',
      parts: pendingFunctionResults.map(r => {
        const part = { functionCall: { name: r.name, args: r.args || {} } }
        if (r.thoughtSignature) part.thoughtSignature = r.thoughtSignature
        return part
      }),
    })
    contents.push({
      role: 'function',
      parts: pendingFunctionResults.map(r => ({ functionResponse: { name: r.name, response: { result: r.result } } })),
    })
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, tools: TOOLS, generationConfig: { maxOutputTokens: 1500 } }),
      }
    )
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Upstream API error' })
    const parts = data.candidates?.[0]?.content?.parts || []
    const text = parts.filter(p => p.text).map(p => p.text).join('\n\n').trim()
    const functionCalls = parts.filter(p => p.functionCall).map(p => ({
      name: p.functionCall.name, args: p.functionCall.args || {}, thoughtSignature: p.thoughtSignature,
    }))
    return res.status(200).json({ text, functionCalls })
  } catch (e) {
    console.error('fitness assist error', e)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
