// Vercel serverless function — AI financial assistant backed by Gemini.
// Two modes:
//   mode: 'chat'  → answer questions about the user's finance data, and
//                   can add or delete entries via tool calls. Deletes are
//                   never executed here — this function only *requests*
//                   them; the client always shows a confirmation before
//                   actually deleting anything.
//   mode: 'parse' → extract transactions from an uploaded statement.
//                   Accepts PDF/JPEG/PNG/WebP as base64 (file.data), or
//                   CSV/plain-text/Excel-converted-to-CSV as plain text
//                   (file.text) — Excel files are converted to CSV in the
//                   browser before upload, since Gemini doesn't read .xlsx
//                   directly.
//
// Requires GEMINI_API_KEY in Vercel env (same key as the other endpoints).

import { PDFDocument } from 'pdf-lib'

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

const ID_PARAM = { type: 'STRING', description: "The entry's id, taken from the finance data snapshot." }
const CHAT_TOOLS = [{
  functionDeclarations: [
    {
      name: 'add_finance_entry',
      description: 'Record a new expense or income directly from the conversation.',
      parameters: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', description: "'expense' or 'income'" },
          amount: { type: 'NUMBER' },
          category: { type: 'STRING', description: 'Food, Transport, Housing, Shopping, Entertainment, Health, Education, Salary, or Other' },
          description: { type: 'STRING' },
          entry_date: { type: 'STRING', description: 'YYYY-MM-DD, optional — defaults to today' },
        },
        required: ['kind', 'amount'],
      },
    },
    {
      name: 'delete_finance_entry',
      description: 'Delete a specific finance entry by id. The user will always be shown a confirmation before this actually happens, so it is safe to call whenever the user asks to remove/delete a transaction.',
      parameters: { type: 'OBJECT', properties: { id: ID_PARAM }, required: ['id'] },
    },
  ],
}]

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Set it in Vercel project settings.' })
  }

  const { mode, messages, context, file, pendingFunctionResults } = req.body || {}

  if (mode === 'parse') {
    return handleParse(req, res, apiKey, file)
  }
  return handleChat(req, res, apiKey, messages, context, pendingFunctionResults)
}

async function callGeminiRaw(apiKey, body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'Upstream API error')
  return data
}

async function callGemini(apiKey, body) {
  const data = await callGeminiRaw(apiKey, body)
  return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim()
}

async function handleChat(req, res, apiKey, messages, context, pendingFunctionResults) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' })
  }
  if (messages.length > 40) return res.status(400).json({ error: 'Too many messages' })
  for (const m of messages) {
    if (typeof m?.content !== 'string' || m.content.length > 8000) {
      return res.status(400).json({ error: 'Each message must be a string under 8000 characters' })
    }
  }
  if (pendingFunctionResults && (!Array.isArray(pendingFunctionResults) || pendingFunctionResults.length > 10)) {
    return res.status(400).json({ error: 'Invalid pendingFunctionResults' })
  }
  const systemInstruction = [
    "You are a financial assistant inside a personal dashboard app.",
    "Use the finance data snapshot below (each entry has an id) to answer questions about the user's spending, income, budgets, categories, trends, and profit-vs-spend. Give concrete numbers and short, practical insight. You are not a licensed financial advisor; for investment or tax decisions, add a brief reminder to consult a professional.",
    "You can add or delete finance entries directly using the available tools when the user asks — don't tell them to do it manually. Deletions are always confirmed with the user before they happen, so call delete_finance_entry directly rather than asking permission first in text.",
    "Be concise; plain text, minimal markdown.",
    context ? `\n\n--- Finance data snapshot ---\n${String(context).slice(0, 14000)}` : '',
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
    const raw = await callGeminiRaw(apiKey, {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: CHAT_TOOLS,
      generationConfig: { maxOutputTokens: 1200 },
    })
    const parts = raw.candidates?.[0]?.content?.parts || []
    const text = parts.filter(p => p.text).map(p => p.text).join('\n\n').trim()
    const functionCalls = parts.filter(p => p.functionCall).map(p => ({
      name: p.functionCall.name, args: p.functionCall.args || {}, thoughtSignature: p.thoughtSignature,
    }))
    return res.status(200).json({ text, functionCalls })
  } catch (e) {
    console.error('finance chat error', e)
    return res.status(500).json({ error: e.message || 'Failed to reach the AI service' })
  }
}

const CATEGORIES = 'Food, Transport, Housing, Shopping, Entertainment, Health, Education, Salary, Other'

function buildPrompt(isPartial) {
  return [
    "You are reading a financial statement (bank/card statement or receipt)" + (isPartial ? ", or a portion of one — some transactions before/after this excerpt may be missing, that's expected, just extract what's visible here." : "."),
    "Extract every transaction you can identify. For each, output kind ('expense' or 'income'), amount (positive number), a best-fit category from this list: " + CATEGORIES + ", a short description (merchant/payee), and entry_date in YYYY-MM-DD.",
    "Respond with ONLY valid minified JSON, no markdown, no preamble, in exactly this shape:",
    '{"entries":[{"kind":"expense","amount":12.50,"category":"Food","description":"Cafe","entry_date":"2026-01-05"}],"summary":"one short sentence"}',
    "If a date's year is ambiguous, infer it from context or use the current year. If you cannot read any transactions, return an empty entries array with a summary explaining why.",
  ].join(' ')
}

async function parseChunk(apiKey, { mimeType, base64Data, textData }, isPartial) {
  const dataPart = textData !== undefined
    ? { text: textData }
    : { inlineData: { mimeType, data: base64Data } }
  const text = await callGemini(apiKey, {
    contents: [{
      role: 'user',
      parts: [{ text: buildPrompt(isPartial) }, dataPart],
    }],
    generationConfig: { maxOutputTokens: 8000, responseMimeType: 'application/json' },
  })
  return parseEntriesJson(text)
}

// Splits a base64-encoded PDF into two halves by page count, so each half
// is small enough that Gemini can fully extract it without hitting the
// output token cap and truncating mid-array.
async function splitPdfInHalf(base64Data) {
  const bytes = Buffer.from(base64Data, 'base64')
  const src = await PDFDocument.load(bytes)
  const pageCount = src.getPageCount()
  if (pageCount < 2) return null // nothing to split

  const mid = Math.ceil(pageCount / 2)
  const [firstDoc, secondDoc] = await Promise.all([PDFDocument.create(), PDFDocument.create()])

  const firstIdx = Array.from({ length: mid }, (_, i) => i)
  const secondIdx = Array.from({ length: pageCount - mid }, (_, i) => i + mid)

  const [firstPages, secondPages] = await Promise.all([
    firstDoc.copyPages(src, firstIdx),
    secondDoc.copyPages(src, secondIdx),
  ])
  firstPages.forEach(p => firstDoc.addPage(p))
  secondPages.forEach(p => secondDoc.addPage(p))

  const [firstBytes, secondBytes] = await Promise.all([firstDoc.save(), secondDoc.save()])
  return [Buffer.from(firstBytes).toString('base64'), Buffer.from(secondBytes).toString('base64')]
}

async function handleParse(req, res, apiKey, file) {
  const hasBinary = !!(file?.data && file?.mimeType)
  const hasText = typeof file?.text === 'string' && file.text.trim().length > 0
  if (!hasBinary && !hasText) {
    return res.status(400).json({ error: 'file with either data+mimeType (PDF/image) or text (CSV/plain text) is required' })
  }

  if (hasText) {
    if (file.text.length > 400_000) {
      return res.status(400).json({ error: 'Text/CSV content is too large (max ~400,000 characters)' })
    }
    try {
      const parsed = await parseChunk(apiKey, { textData: file.text }, false)
      let entries = Array.isArray(parsed.entries) ? parsed.entries : []
      entries = entries.filter(e => ['expense', 'income'].includes(e.kind) && Number(e.amount) > 0).slice(0, 400)
      let summary = parsed.summary || `Found ${entries.length} transactions.`
      if (parsed.truncated) summary = `Found ${entries.length} transactions (the file was long enough to get cut off — check against the original to be safe).`
      return res.status(200).json({ entries, summary })
    } catch (e) {
      console.error('finance parse (text) error', e)
      return res.status(500).json({ error: e.message || 'Failed to read the file' })
    }
  }

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.mimeType)) {
    return res.status(400).json({ error: 'Only PDF, JPEG, PNG, WebP, CSV, plain text, or Excel statements are supported' })
  }
  // base64 payload guard (~10MB binary ≈ 13.7MB base64)
  if (file.data.length > 14_000_000) {
    return res.status(400).json({ error: 'File is too large (max ~10MB)' })
  }

  try {
    let halves = null
    if (file.mimeType === 'application/pdf') {
      try { halves = await splitPdfInHalf(file.data) }
      catch (e) { console.error('pdf split failed, falling back to single pass', e); halves = null }
    }

    let entries, summary, wasTruncated

    if (halves) {
      // Run both halves concurrently and merge — each half is small enough
      // to come back complete rather than truncated.
      const [a, b] = await Promise.all([
        parseChunk(apiKey, { mimeType: file.mimeType, base64Data: halves[0] }, true),
        parseChunk(apiKey, { mimeType: file.mimeType, base64Data: halves[1] }, true),
      ])
      const entriesA = Array.isArray(a.entries) ? a.entries : []
      const entriesB = Array.isArray(b.entries) ? b.entries : []
      entries = [...entriesA, ...entriesB]
      wasTruncated = !!a.truncated || !!b.truncated
      summary = `Found ${entries.length} transactions across the statement (processed in two parts).`
    } else {
      const parsed = await parseChunk(apiKey, { mimeType: file.mimeType, base64Data: file.data }, false)
      entries = Array.isArray(parsed.entries) ? parsed.entries : []
      wasTruncated = !!parsed.truncated
      summary = parsed.summary || `Found ${entries.length} transactions.`
    }

    entries = entries.filter(e => ['expense', 'income'].includes(e.kind) && Number(e.amount) > 0).slice(0, 400)
    if (wasTruncated) {
      summary = `Found ${entries.length} transactions (part of the statement was still long enough to get cut off — check against the original to be safe).`
    }

    return res.status(200).json({ entries, summary })
  } catch (e) {
    console.error('finance parse error', e)
    return res.status(500).json({ error: e.message || 'Failed to read the statement' })
  }
}

// Parses the model's JSON response, repairing truncated output (the model
// can be cut off mid-array on long statements) by dropping the last
// incomplete object rather than failing the whole import.
function parseEntriesJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    // Fall through to repair
  }
  const m = text.match(/\{[\s\S]*/)
  let candidate = m ? m[0] : text
  // Try trimming back to the last complete "}," or "}" before the cut point,
  // then close off the array/object.
  const lastGoodEntry = Math.max(candidate.lastIndexOf('},'), candidate.lastIndexOf('}]'))
  if (lastGoodEntry !== -1) {
    candidate = candidate.slice(0, lastGoodEntry + 1) + ']}'
    try {
      const repaired = JSON.parse(candidate)
      repaired.truncated = true
      return repaired
    } catch { /* still broken, give up below */ }
  }
  throw new Error('Could not parse the statement into structured data (response may have been too long — try a shorter document or fewer pages)')
}
