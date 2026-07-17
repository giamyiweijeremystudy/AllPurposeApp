// Generates a presigned PUT URL so the browser can upload directly to
// Cloudflare R2 — bypassing Vercel's serverless function body-size limits
// entirely, which is what actually allows larger file uploads. The file
// bytes never pass through this function.
//
// Requires these Vercel env vars:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
//   R2_PUBLIC_URL (the bucket's public base URL — either the r2.dev URL
//     from R2 dashboard > bucket > Settings > Public Access, or a custom
//     domain you've connected)
// Also requires SUPABASE_URL and SUPABASE_ANON_KEY (same values as
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, just without the VITE_ prefix
// so this server function can read them) to verify the caller's identity.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@supabase/supabase-js'

const MAX_BYTES = 500 * 1024 * 1024 // 500MB per file — raise if you need more

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

async function verifyUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) return res.status(500).json({ error: `R2 is not configured yet — missing env vars: ${missing.join(', ')}` })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server is missing SUPABASE_URL / SUPABASE_ANON_KEY (needed to verify who is uploading).' })
  }

  const userId = await verifyUser(req)
  if (!userId) return res.status(401).json({ error: 'Not signed in' })

  const { filename, contentType, sizeBytes } = req.body || {}
  if (!filename) return res.status(400).json({ error: 'filename is required' })
  if (sizeBytes && sizeBytes > MAX_BYTES) return res.status(400).json({ error: `File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` })

  const ext = filename.includes('.') ? filename.split('.').pop().replace(/[^a-z0-9]/gi, '') : 'bin'
  const key = `${userId}/${crypto.randomUUID()}.${ext}`

  try {
    const client = r2Client()
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME, Key: key,
      ContentType: contentType || 'application/octet-stream',
    })
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 })
    const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
    return res.status(200).json({ uploadUrl, publicUrl, key })
  } catch (e) {
    console.error('r2-presign error', e)
    return res.status(500).json({ error: 'Failed to create upload URL' })
  }
}
