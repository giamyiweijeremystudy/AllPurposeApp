// Vercel serverless function — Gemini-backed assistant for the Knowledge
// Base feature. Separate from api/ai-helper.js because this is a focused,
// single-shot text task (help with one entry's content) rather than a
// full agentic chat with app-wide tool access.
//
// Requires GEMINI_API_KEY in Vercel project environment variables
// (same key used by the AI Helper tab — get one free at
// aistudio.google.com/apikey).

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

const MODE_PROMPTS = {
  expand: 'Expand and flesh out these notes with more useful detail, examples, and structure. Keep the same general topic and intent. Return only the improved notes, no preamble.',
  summarize: 'Summarize these notes concisely, keeping the key points. Return only the summary, no preamble.',
  organize: 'Reorganize and clean up these notes for clarity (headings, bullet points where useful) without losing any information. Return only the reorganized notes, no preamble.',
  quiz: 'Write 5 short quiz questions (with answers listed separately below the questions) based on these notes, to help the user study them. Return only the quiz.',
  explain: 'Explain the topic of these notes more simply, as if teaching a beginner. Return only the explanation, no preamble.',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Get a free key at aistudio.google.com/apikey and set it in Vercel project settings.' })
  }

  const { title, content, mode, instruction } = req.body || {}
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content is required' })
  }
  if (content.length > 12000) {
    return res.status(400).json({ error: 'Content is too long (max 12000 characters)' })
  }

  let task
  if (mode && MODE_PROMPTS[mode]) {
    task = MODE_PROMPTS[mode]
  } else if (instruction && typeof instruction === 'string') {
    if (instruction.length > 2000) return res.status(400).json({ error: 'Instruction is too long' })
    task = `Follow this instruction on the notes below: ${instruction}. Return only the resulting notes, no preamble.`
  } else {
    return res.status(400).json({ error: 'Provide either a known mode or a custom instruction' })
  }

  const prompt = `${task}\n\nTitle: ${title || '(untitled)'}\n\nNotes:\n${content}`

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
    console.error('kb-assist error', err)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
