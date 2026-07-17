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

// Uploads a File to the kb-files storage bucket under the user's own
// folder, and returns { url, storage_path, mime_type, size_bytes }.
export async function uploadKbFile(userId, file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('kb-files').upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  const { data } = supabase.storage.from('kb-files').getPublicUrl(path)
  return { url: data.publicUrl, storage_path: path, mime_type: file.type || null, size_bytes: file.size }
}

export async function deleteKbFile(storagePath) {
  if (!storagePath) return
  await supabase.storage.from('kb-files').remove([storagePath])
}
