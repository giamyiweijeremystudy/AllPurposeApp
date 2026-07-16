// Vercel serverless function — proxies chat requests to Google's Gemini API
// (has a free tier — no credit card required). Keeps GEMINI_API_KEY
// server-side only; never expose it to the client.
//
// Get a free key at https://aistudio.google.com/apikey and set it as
// GEMINI_API_KEY in Vercel project settings (Project → Settings →
// Environment Variables), then redeploy.

const GEMINI_MODEL = 'gemini-3.1-flash-lite' // current cost-efficient GA model; replaces the retired gemini-2.5-flash

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Get a free key at aistudio.google.com/apikey and set it in Vercel project settings.' })
  }

  const { messages, context } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' })
  }
  // Basic sanity limits so a malformed/abusive request can't blow up cost.
  if (messages.length > 40) {
    return res.status(400).json({ error: 'Too many messages in this conversation' })
  }
  for (const m of messages) {
    if (typeof m?.content !== 'string' || m.content.length > 8000) {
      return res.status(400).json({ error: 'Each message must be a string under 8000 characters' })
    }
  }

  const systemInstruction = [
    "You are the AI Helper built into this user's personal dashboard app.",
    "You can see a snapshot of their app data below (tasks, calendar events, notes, and page layout) and can answer questions about it, summarize it, or generate new content (notes, task lists, schedules, drafts) that they can copy into the app.",
    "You cannot directly modify the app's data yourself — you only generate text for the user to review and add themselves.",
    "Be concise and practical. Use plain text with simple line breaks; avoid heavy markdown.",
    context ? `\n\n--- Current app snapshot ---\n${String(context).slice(0, 12000)}` : '',
  ].join(' ')

  // Gemini's REST API uses "contents" with role user/model, and a separate
  // systemInstruction field (no "system" role in the contents array).
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { maxOutputTokens: 1500 },
        }),
      }
    )

    const data = await upstream.json()
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'Upstream API error' })
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n\n').trim()
    return res.status(200).json({ text: text || '(no response)' })
  } catch (err) {
    console.error('ai-helper error', err)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
