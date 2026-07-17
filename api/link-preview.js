// Fetches a URL server-side and extracts <title>, og:image, and favicon so
// pasted links can render as a proper preview card instead of a bare URL.
// No API key needed — plain HTML fetch + regex extraction (kept lightweight
// on purpose; this isn't a general scraper, just enough for a preview).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { url } = req.body || {}
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' })

  let parsed
  try { parsed = new URL(url) } catch { return res.status(400).json({ error: 'Invalid URL' }) }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'Only http(s) URLs are supported' })

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = (await r.text()).slice(0, 200_000)
    const pick = (re) => html.match(re)?.[1]?.trim()
    const title = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || pick(/<title[^>]*>([^<]+)<\/title>/i)
      || parsed.hostname
    const image = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    return res.status(200).json({
      title: decodeEntities(title), description: description ? decodeEntities(description) : null,
      image: image || null, domain: parsed.hostname, favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
    })
  } catch (e) {
    return res.status(200).json({ title: parsed.hostname, description: null, image: null, domain: parsed.hostname, favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64` })
  }
}

function decodeEntities(s) {
  if (!s) return s
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
