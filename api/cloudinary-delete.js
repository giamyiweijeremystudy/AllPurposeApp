// Deletes a Cloudinary asset. Verifies the caller owns it (public_id must
// be under kb/{their user id}/...) before deleting. Same env vars as
// api/cloudinary-sign.js.

import { createHash } from 'crypto'
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
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) return res.status(500).json({ error: `Cloudinary is not configured — missing env vars: ${missing.join(', ')}` })

  const userId = await verifyUser(req)
  if (!userId) return res.status(401).json({ error: 'Not signed in' })

  const { publicId, resourceType } = req.body || {}
  if (!publicId) return res.status(400).json({ error: 'publicId is required' })
  if (!publicId.startsWith(`kb/${userId}/`)) return res.status(403).json({ error: "You don't own this file" })

  const timestamp = Math.floor(Date.now() / 1000)
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`
  const signature = createHash('sha1').update(toSign).digest('hex')

  try {
    const type = resourceType || 'image'
    const r = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${type}/destroy`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ public_id: publicId, timestamp, signature, api_key: process.env.CLOUDINARY_API_KEY }),
    })
    const data = await r.json()
    return res.status(200).json({ ok: data.result === 'ok' || data.result === 'not found' })
  } catch (e) {
    console.error('cloudinary-delete error', e)
    return res.status(500).json({ error: 'Failed to delete file' })
  }
}
