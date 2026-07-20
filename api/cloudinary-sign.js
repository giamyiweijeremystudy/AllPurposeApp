// Generates a signed upload payload so the browser can upload directly to
// Cloudinary (no card required on their free tier — 25 credits/month,
// roughly 25GB pooled storage+bandwidth). The API secret never leaves this
// server; only a short-lived signature is handed to the client.
//
// Requires: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// (from cloudinary.com dashboard, no card needed for the free plan).
// Also requires SUPABASE_URL and SUPABASE_ANON_KEY (same values as your
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, without the VITE_ prefix) to
// verify who's uploading.

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
  if (missing.length) return res.status(500).json({ error: `Cloudinary is not configured yet — missing env vars: ${missing.join(', ')}` })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server is missing SUPABASE_URL / SUPABASE_ANON_KEY (needed to verify who is uploading).' })
  }

  const userId = await verifyUser(req)
  if (!userId) return res.status(401).json({ error: 'Not signed in' })

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = `kb/${userId}`
  // Params to sign must be sorted alphabetically, joined as key=value&key=value, with the secret appended.
  const toSign = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`
  const signature = createHash('sha1').update(toSign).digest('hex')

  return res.status(200).json({
    timestamp, folder, signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  })
}
