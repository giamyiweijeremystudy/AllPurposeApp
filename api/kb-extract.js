// Reads an uploaded file (PDF, image, plain text, or an .eml email — Word/
// Excel are converted to text client-side before reaching here) and turns
// it into organized notes for a Knowledge page, via Gemini. Requires
// GEMINI_API_KEY in Vercel env (shared with the other AI endpoints).

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' })

  const { file } = req.body || {}
  const hasBinary = !!(file?.data && file?.mimeType)
  const hasText = typeof file?.text === 'string' && file.text.trim().length > 0
  if (!hasBinary && !hasText) return res.status(400).json({ error: 'file with either data+mimeType or text is required' })
  if (hasBinary && !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType)) {
    return res.status(400).json({ error: 'Only PDF, JPEG, PNG, or WebP are supported as binary uploads (Word/Excel/text/email are read as text)' })
  }
  if (hasBinary && file.data.length > 14_000_000) return res.status(400).json({ error: 'File is too large (max ~10MB)' })
  if (hasText && file.text.length > 400_000) return res.status(400).json({ error: 'Text content is too large (max ~400,000 characters)' })

  const prompt = [
    "You are extracting information from an uploaded file (which may be a document, PDF, image, plain text, or an email in .eml format) to save as a page in the user's personal knowledge base.",
    "Read the content and produce well-organized notes capturing the key information — use headings and bullet points where that helps, but synthesize into useful reference notes rather than transcribing everything verbatim. If it's an email, note the sender, subject, date, and key points/action items.",
    "Also come up with a short, descriptive title for this page.",
    "Respond with ONLY valid minified JSON, no markdown, no preamble, in exactly this shape:",
    '{"title":"Short descriptive title","content":"The organized notes as plain text with line breaks"}',
  ].join(' ')

  const parts = [{ text: prompt }]
  if (hasBinary) parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } })
  else parts.push({ text: `\n\n--- File content ---\n${file.text}` })

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { maxOutputTokens: 4000, responseMimeType: 'application/json' },
        }),
      }
    )
    const data = await r.json()
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Upstream API error' })
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim()
    let parsed
    try { parsed = JSON.parse(text) } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Could not parse the extracted content')
      parsed = JSON.parse(m[0])
    }
    return res.status(200).json({ title: parsed.title || 'Untitled', content: parsed.content || '' })
  } catch (e) {
    console.error('kb-extract error', e)
    return res.status(500).json({ error: e.message || 'Failed to read the file' })
  }
}
