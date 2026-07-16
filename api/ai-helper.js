// Vercel serverless function — proxies chat requests to Google's Gemini API
// (has a free tier — no credit card required). Keeps GEMINI_API_KEY
// server-side only; never expose it to the client.
//
// Get a free key at https://aistudio.google.com/apikey and set it as
// GEMINI_API_KEY in Vercel project settings (Project → Settings →
// Environment Variables), then redeploy.
//
// Supports Gemini function calling: the model can request one of the
// TOOLS below, the client actually performs the action against Supabase
// (using the signed-in user's own session, so normal RLS rules apply —
// this function never touches the database itself), and sends the
// result back in a follow-up request via `pendingFunctionResults`.

const GEMINI_MODEL = 'gemini-3.1-flash-lite' // current cost-efficient GA model; replaces the retired gemini-2.5-flash

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'add_task',
      description: "Add a new task to the user's task list.",
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'The task title' },
          due_date: { type: 'STRING', description: 'Due date as YYYY-MM-DD, optional' },
          priority: { type: 'STRING', description: 'low, medium, or high — optional, defaults to medium' },
        },
        required: ['title'],
      },
    },
    {
      name: 'add_page',
      description: 'Add a new page to the app sidebar (e.g. a new tool or section of the app).',
      parameters: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'The page name shown in the sidebar' },
          icon: { type: 'STRING', description: "A Tabler icon class like 'ti-star' or 'ti-book', optional" },
          section: { type: 'STRING', description: "Which sidebar section to put it under (e.g. Main, Work). Optional, defaults to Main; a new section is created if it doesn't exist." },
        },
        required: ['label'],
      },
    },
    {
      name: 'add_note',
      description: "Add a note widget to the app's Overview page.",
      parameters: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'Short title for the note' },
          note: { type: 'STRING', description: 'The note content' },
        },
        required: ['label', 'note'],
      },
    },
    {
      name: 'add_event',
      description: "Add an event to the user's calendar.",
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          start_at: { type: 'STRING', description: 'ISO 8601 datetime, e.g. 2026-07-20T15:00:00' },
          end_at: { type: 'STRING', description: 'ISO 8601 datetime, optional — defaults to start_at' },
          all_day: { type: 'BOOLEAN', description: 'Whether this is an all-day event, optional' },
        },
        required: ['title', 'start_at'],
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
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Get a free key at aistudio.google.com/apikey and set it in Vercel project settings.' })
  }

  const { messages, context, pendingFunctionResults } = req.body || {}
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
  if (pendingFunctionResults && (!Array.isArray(pendingFunctionResults) || pendingFunctionResults.length > 10)) {
    return res.status(400).json({ error: 'Invalid pendingFunctionResults' })
  }

  const systemInstruction = [
    "You are the AI Helper built into this user's personal dashboard app.",
    "You can see a snapshot of their app data below (tasks, calendar events, notes, and page layout) and can answer questions about it, summarize it, generate content, or take action using the available tools (add_task, add_page, add_note, add_event) when the user asks you to add or create something.",
    "Only call a tool when the user has actually asked for something to be added/created — don't call tools just to answer a question.",
    "Be concise and practical. Use plain text with simple line breaks; avoid heavy markdown.",
    context ? `\n\n--- Current app snapshot ---\n${String(context).slice(0, 12000)}` : '',
  ].join(' ')

  // Gemini's REST API uses "contents" with role user/model, and a separate
  // systemInstruction field (no "system" role in the contents array).
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  // If the client already executed function call(s) we asked for, append the
  // model's call + the client's result so Gemini can produce a final answer.
  if (pendingFunctionResults?.length) {
    contents.push({
      role: 'model',
      parts: pendingFunctionResults.map(r => ({ functionCall: { name: r.name, args: r.args || {} } })),
    })
    contents.push({
      role: 'function',
      parts: pendingFunctionResults.map(r => ({
        functionResponse: { name: r.name, response: { result: r.result } },
      })),
    })
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools: TOOLS,
          generationConfig: { maxOutputTokens: 1500 },
        }),
      }
    )

    const data = await upstream.json()
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'Upstream API error' })
    }
    const parts = data.candidates?.[0]?.content?.parts || []
    const text = parts.filter(p => p.text).map(p => p.text).join('\n\n').trim()
    const functionCalls = parts
      .filter(p => p.functionCall)
      .map(p => ({ name: p.functionCall.name, args: p.functionCall.args || {} }))

    return res.status(200).json({ text, functionCalls })
  } catch (err) {
    console.error('ai-helper error', err)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
