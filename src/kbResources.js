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

// Uploads a File directly to Cloudflare R2 via a presigned URL (the file
// never passes through our server, so there's no Vercel body-size limit).
// onProgress(fraction) is optional, useful for larger files.
export async function uploadKbFile(userId, file, onProgress) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')

  const presignRes = await fetch('/api/r2-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
  })
  const presign = await presignRes.json()
  if (!presignRes.ok) throw new Error(presign.error || 'Could not start the upload')

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presign.uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Upload failed — network error'))
    xhr.send(file)
  })

  return { url: presign.publicUrl, storage_path: presign.key, mime_type: file.type || null, size_bytes: file.size }
}

export async function deleteKbFile(storagePath) {
  if (!storagePath) return
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return
  await fetch('/api/r2-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ key: storagePath }),
  }).catch(() => {})
}
