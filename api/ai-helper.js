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
//
// Full CRUD is exposed for everything the AI Helper's context includes
// (tasks, calendar events, notes, sidebar pages) — not just creation.
// The app snapshot passed as `context` includes each item's id so the
// model can target a specific record for update_/delete_ calls.

const GEMINI_MODEL = 'gemini-3.1-flash-lite' // current cost-efficient GA model; replaces the retired gemini-2.5-flash

const ID_PARAM = { type: 'STRING', description: "The item's id, taken from the app snapshot (e.g. from '[id:...]')." }

const TOOLS = [{
  functionDeclarations: [
    // ── Tasks ──────────────────────────────────────────────
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
      name: 'update_task',
      description: 'Update an existing task (title, due date, priority, or mark complete/incomplete).',
      parameters: {
        type: 'OBJECT',
        properties: {
          id: ID_PARAM,
          title: { type: 'STRING' },
          due_date: { type: 'STRING', description: 'YYYY-MM-DD, or empty string to clear it' },
          priority: { type: 'STRING', description: 'low, medium, or high' },
          completed: { type: 'BOOLEAN' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_task',
      description: 'Delete a task.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    // ── Calendar events ────────────────────────────────────
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
    {
      name: 'update_event',
      description: 'Update an existing calendar event.',
      parameters: {
        type: 'OBJECT',
        properties: {
          id: ID_PARAM,
          title: { type: 'STRING' },
          start_at: { type: 'STRING', description: 'ISO 8601 datetime' },
          end_at: { type: 'STRING', description: 'ISO 8601 datetime' },
          all_day: { type: 'BOOLEAN' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_event',
      description: "Delete an event from the user's calendar. Use this whenever the user asks to remove/cancel/delete a calendar event — do it directly, don't tell the user to do it manually.",
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    // ── Notes (Overview page widgets) ─────────────────────
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
      name: 'update_note',
      description: 'Update an existing note widget.',
      parameters: {
        type: 'OBJECT',
        properties: { id: ID_PARAM, label: { type: 'STRING' }, note: { type: 'STRING' } },
        required: ['id'],
      },
    },
    {
      name: 'delete_note',
      description: 'Delete a note widget.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    // ── Sidebar pages ──────────────────────────────────────
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
      name: 'update_page',
      description: 'Rename or change the icon of an existing sidebar page.',
      parameters: {
        type: 'OBJECT',
        properties: { id: ID_PARAM, label: { type: 'STRING' }, icon: { type: 'STRING' } },
        required: ['id'],
      },
    },
    {
      name: 'delete_page',
      description: 'Remove a page from the sidebar.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    // ── Knowledge base entries ─────────────────────────────
    {
      name: 'add_kb_entry',
      description: "Create a new entry in the user's knowledge base / learning notes.",
      parameters: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, content: { type: 'STRING' } },
        required: ['title', 'content'],
      },
    },
    {
      name: 'update_kb_entry',
      description: 'Update the title or content of an existing knowledge base entry.',
      parameters: {
        type: 'OBJECT',
        properties: { id: ID_PARAM, title: { type: 'STRING' }, content: { type: 'STRING' } },
        required: ['id'],
      },
    },
    {
      name: 'delete_kb_entry',
      description: 'Delete a knowledge base entry.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    // ── Finance ────────────────────────────────────────────
    {
      name: 'add_finance_entry',
      description: "Record an expense or income in the user's finance tracker.",
      parameters: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', description: "'expense' or 'income'" },
          amount: { type: 'NUMBER', description: 'Positive amount' },
          category: { type: 'STRING', description: 'One of: Food, Transport, Housing, Shopping, Entertainment, Health, Education, Salary, Other. Defaults to Other.' },
          description: { type: 'STRING', description: 'Optional short description' },
          entry_date: { type: 'STRING', description: 'YYYY-MM-DD, optional — defaults to today' },
        },
        required: ['kind', 'amount'],
      },
    },
    {
      name: 'update_finance_entry',
      description: 'Update an existing finance entry.',
      parameters: {
        type: 'OBJECT',
        properties: {
          id: ID_PARAM,
          kind: { type: 'STRING' }, amount: { type: 'NUMBER' }, category: { type: 'STRING' },
          description: { type: 'STRING' }, entry_date: { type: 'STRING' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_finance_entry',
      description: 'Delete a finance entry.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    // ── Habits ─────────────────────────────────────────────
    {
      name: 'add_habit',
      description: 'Create a new daily habit to track.',
      parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' } }, required: ['name'] },
    },
    {
      name: 'check_habit',
      description: "Mark a habit as done (or not done) for a date. Use done:true to check it off, done:false to un-check.",
      parameters: {
        type: 'OBJECT',
        properties: {
          id: ID_PARAM,
          date: { type: 'STRING', description: 'YYYY-MM-DD, optional — defaults to today' },
          done: { type: 'BOOLEAN', description: 'true to mark done, false to unmark. Defaults to true.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_habit',
      description: 'Delete a habit and its check history.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
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
    "You can see a snapshot of their app data below (tasks, calendar events, notes, and page layout, each with an id) and can answer questions about it, summarize it, generate content, or take action using the available tools — including creating, updating, AND deleting tasks, events, notes, and sidebar pages — whenever the user asks. You are not limited to only creating things; if the user asks you to remove, delete, cancel, rename, or edit something, use the matching update_/delete_ tool directly. Never tell the user to make a change manually if a tool exists for it.",
    "When the user refers to an item by name (e.g. 'delete my dentist appointment'), match it against the id shown in the app snapshot below and use that id in the tool call. If more than one item plausibly matches, ask which one before acting rather than guessing.",
    "Only call a tool when the user has actually asked for something to be added/changed/removed — don't call tools just to answer a question.",
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
      parts: pendingFunctionResults.map(r => {
        const part = { functionCall: { name: r.name, args: r.args || {} } }
        // Required by Gemini 3 thinking models — must be echoed back exactly
        // as received, or the call is rejected / reasoning quality degrades.
        if (r.thoughtSignature) part.thoughtSignature = r.thoughtSignature
        return part
      }),
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
      .map(p => ({
        name: p.functionCall.name,
        args: p.functionCall.args || {},
        // Gemini 3 requires this to be echoed back verbatim on the next
        // turn (only the first parallel functionCall part carries one).
        thoughtSignature: p.thoughtSignature,
      }))

    return res.status(200).json({ text, functionCalls })
  } catch (err) {
    console.error('ai-helper error', err)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
