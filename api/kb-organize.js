// AI filing assistant for the Knowledge module. Chat backed by Gemini that
// can create, move, rename, and delete books/sections/subsections/pages
// via tool calls — executed client-side under the user's own RLS session
// (this endpoint never touches the database). Deletes are always
// client-confirmed before they happen, same pattern as the other
// assistants. Requires GEMINI_API_KEY in Vercel env.

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

const ID_PARAM = { type: 'STRING', description: "A node's id, taken from the folder tree snapshot." }

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'create_node',
      description: "Create a new folder (book/section/subsection) or page in the knowledge tree.",
      parameters: {
        type: 'OBJECT',
        properties: {
          parent_id: { type: 'STRING', description: 'id of the parent folder, or omit/empty for a new top-level book' },
          kind: { type: 'STRING', description: "'folder' (a book, section, or subsection — anything that can contain other items) or 'page' (an actual note with content)" },
          title: { type: 'STRING' },
          content: { type: 'STRING', description: 'Only for pages — the note content' },
        },
        required: ['kind', 'title'],
      },
    },
    {
      name: 'move_node',
      description: 'Move a folder or page to a different parent (re-file it elsewhere in the tree).',
      parameters: {
        type: 'OBJECT',
        properties: { id: ID_PARAM, new_parent_id: { type: 'STRING', description: 'id of the new parent folder, or omit/empty to move to top-level (make it a new book)' } },
        required: ['id'],
      },
    },
    {
      name: 'rename_node',
      description: 'Rename a folder or page.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM, title: { type: 'STRING' } }, required: ['id', 'title'] },
    },
    {
      name: 'update_page_content',
      description: "Update a page's note content (not for folders).",
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM, content: { type: 'STRING' } }, required: ['id', 'content'] },
    },
    {
      name: 'delete_node',
      description: 'Delete a folder (and everything inside it) or a page. Always shown to the user for confirmation before it happens.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
    {
      name: 'attach_resource',
      description: "Attach the file the user most recently uploaded in this conversation (if any) to a page as a resource. Only call this after the user has uploaded a file and asked to attach/save/embed it somewhere.",
      parameters: { type: 'OBJECT', properties: { page_id: ID_PARAM }, required: ['page_id'] },
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
    "You are the filing assistant for a personal knowledge base, organized like a manual: books at the top level, containing sections, containing subsections, containing pages (the actual notes).",
    "You can see the current folder tree below (each item with its id, kind, and indentation showing its depth). Help the user create new books/sections/subsections/pages, move items to reorganize them, rename things, update page content, and delete things — using the tools directly rather than telling them to do it manually.",
    "When the user describes some content and asks you to file it, or asks 'where should this go', use the existing tree structure to suggest or create a sensible location (creating new folders if nothing fitting exists) rather than dumping everything at the top level.",
    "If a message says the user uploaded and the file's content was extracted, that extracted text is available to you — use it as the content when creating or updating a page if the user asks to save/file it. If the user asks to attach/save the uploaded file itself (as opposed to just its extracted text) to a page, use attach_resource with that page's id.",
    "Be concise; plain text, minimal markdown.",
    context ? `\n\n--- Knowledge tree snapshot ---\n${String(context).slice(0, 14000)}` : '',
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
    console.error('kb-organize error', e)
    return res.status(500).json({ error: 'Failed to reach the AI service' })
  }
}
