// Vercel serverless function — AI financial assistant backed by Gemini.
// Two modes:
//   mode: 'chat'  → answer questions about the user's finance data
//   mode: 'parse' → extract transactions from an uploaded statement
//                   (PDF/JPEG/PNG passed as base64) into structured JSON
//
// Requires GEMINI_API_KEY in Vercel env (same key as the other endpoints).

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

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

  const { mode, messages, context, file } = req.body || {}

  if (mode === 'parse') {
    return handleParse(req, res, apiKey, file, context)
  }
  return handleChat(req, res, apiKey, messages, context)
}

async function callGemini(apiKey, body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || 'Upstream API error')
  return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim()
}

async function handleChat(req, res, apiKey, messages, context) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' })
  }
  if (messages.length > 40) return res.status(400).json({ error: 'Too many messages' })
  for (const m of messages) {
    if (typeof m?.content !== 'string' || m.content.length > 8000) {
      return res.status(400).json({ error: 'Each message must be a string under 8000 characters' })
    }
  }
  const systemInstruction = [
    "You are a financial assistant inside a personal dashboard app.",
    "Use the finance data snapshot below to answer questions about the user's spending, income, budgets, categories, trends, and profit-vs-spend. Give concrete numbers and short, practical insight. You are not a licensed financial advisor; for investment or tax decisions, add a brief reminder to consult a professional. Be concise; plain text, minimal markdown.",
    context ? `\n\n--- Finance data snapshot ---\n${String(context).slice(0, 14000)}` : '',
  ].join(' ')

  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  try {
    const text = await callGemini(apiKey, {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { maxOutputTokens: 1200 },
    })
    return res.status(200).json({ text: text || '(no response)' })
  } catch (e) {
    console.error('finance chat error', e)
    return res.status(500).json({ error: e.message || 'Failed to reach the AI service' })
  }
}

async function handleParse(req, res, apiKey, file, context) {
  if (!file?.data || !file?.mimeType) {
    return res.status(400).json({ error: 'file with data (base64) and mimeType is required' })
  }
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.mimeType)) {
    return res.status(400).json({ error: 'Only PDF, JPEG, PNG, or WebP statements are supported' })
  }
  // base64 payload guard (~10MB binary ≈ 13.7MB base64)
  if (file.data.length > 14_000_000) {
    return res.status(400).json({ error: 'File is too large (max ~10MB)' })
  }

  const categories = 'Food, Transport, Housing, Shopping, Entertainment, Health, Education, Salary, Other'
  const prompt = [
    "You are reading a financial statement (bank/card statement or receipt).",
    "Extract every transaction you can identify. For each, output kind ('expense' or 'income'), amount (positive number), a best-fit category from this list: " + categories + ", a short description (merchant/payee), and entry_date in YYYY-MM-DD.",
    "Respond with ONLY valid minified JSON, no markdown, no preamble, in exactly this shape:",
    '{"entries":[{"kind":"expense","amount":12.50,"category":"Food","description":"Cafe","entry_date":"2026-01-05"}],"summary":"one short sentence"}',
    "If a date's year is ambiguous, infer it from context or use the current year. If you cannot read any transactions, return an empty entries array with a summary explaining why.",
  ].join(' ')

  try {
    const text = await callGemini(apiKey, {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: file.mimeType, data: file.data } },
        ],
      }],
      generationConfig: { maxOutputTokens: 4000, responseMimeType: 'application/json' },
    })
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Could not parse the statement into structured data')
      parsed = JSON.parse(m[0])
    }
    const entries = Array.isArray(parsed.entries) ? parsed.entries.filter(e =>
      ['expense', 'income'].includes(e.kind) && Number(e.amount) > 0
    ).slice(0, 200) : []
    return res.status(200).json({ entries, summary: parsed.summary || `Found ${entries.length} transactions.` })
  } catch (e) {
    console.error('finance parse error', e)
    return res.status(500).json({ error: e.message || 'Failed to read the statement' })
  }
}
