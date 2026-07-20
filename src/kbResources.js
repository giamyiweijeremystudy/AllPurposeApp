import { supabase } from './supabase.js'

export function fmtBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

export function youtubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2]
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2]
    }
  } catch { /* not a valid URL */ }
  return null
}

export function kindForMime(mime, name = '') {
  if (mime?.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime?.startsWith('video/')) return 'video'
  if (/\.(docx?|xlsx?|pptx?|txt|csv|eml)$/i.test(name)) return 'document'
  return 'file'
}

export const DOC_ICONS = {
  image: 'ti-photo', pdf: 'ti-file-type-pdf', video: 'ti-video', youtube: 'ti-brand-youtube',
  link: 'ti-link', document: 'ti-file-text', file: 'ti-file',
}

// Uploads a File directly to Cloudinary (free tier: 25 credits/month, no
// card required) via a signed upload — the file goes straight from the
// browser to Cloudinary, our server only ever sees a short-lived signature.
export async function uploadKbFile(userId, file) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')

  const signRes = await fetch('/api/cloudinary-sign', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const sign = await signRes.json()
  if (!signRes.ok) throw new Error(sign.error || 'Could not start the upload')

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sign.apiKey)
  form.append('timestamp', sign.timestamp)
  form.append('signature', sign.signature)
  form.append('folder', sign.folder)

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`, { method: 'POST', body: form })
  const result = await uploadRes.json()
  if (!uploadRes.ok) throw new Error(result?.error?.message || 'Upload failed')

  return {
    url: result.secure_url,
    storage_path: `${result.resource_type}:${result.public_id}`, // encodes resource_type, needed to delete later
    mime_type: file.type || null,
    size_bytes: result.bytes || file.size,
  }
}

export async function deleteKbFile(storagePath) {
  if (!storagePath) return
  const [resourceType, publicId] = storagePath.includes(':') ? storagePath.split(/:(.+)/) : ['image', storagePath]
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return
  await fetch('/api/cloudinary-delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ publicId, resourceType }),
  }).catch(() => {})
}
