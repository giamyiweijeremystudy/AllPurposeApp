// Deletes an object from R2. Verifies the caller owns the object (key must
// be prefixed with their own user id) before deleting — same env vars as
// api/r2-presign.js.

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

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
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) return res.status(500).json({ error: `R2 is not configured — missing env vars: ${missing.join(', ')}` })

  const userId = await verifyUser(req)
  if (!userId) return res.status(401).json({ error: 'Not signed in' })

  const { key } = req.body || {}
  if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key is required' })
  if (!key.startsWith(`${userId}/`)) return res.status(403).json({ error: "You don't own this file" })

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    })
    await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('r2-delete error', e)
    return res.status(500).json({ error: 'Failed to delete file' })
  }
}
