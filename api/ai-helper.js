// Vercel serverless function — proxies chat requests to the Anthropic API.
// Keeps ANTHROPIC_API_KEY server-side only; never expose it to the client.
//
// Requires an ANTHROPIC_API_KEY environment variable to be set in the
// Vercel project settings (Project → Settings → Environment Variables).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in Vercel project settings.' })
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

  const system = [
    "You are the AI Helper built into this user's personal dashboard app.",
    "You can see a snapshot of their app data below (tasks, calendar events, notes, and page layout) and can answer questions about it, summarize it, or generate new content (notes, task lists, schedules, drafts) that they can copy into the app.",
    "You cannot directly modify the app's data yourself — you only generate text for the user to review and add themselves.",
    "Be concise and practical. Use plain text with simple line breaks; avoid heavy markdown.",
    context ? `\n\n--- Current app snapshot ---\n${String(context).slice(0, 12000)}` : '',
  ].join(' ')

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'Upstream API error' })
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n')
    return res.status(200).json({ text })
  } catch (err) {
    console.error('ai-helper error', err)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
