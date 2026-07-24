// Sends a daily push notification digest of due-today/overdue reminders to
// every subscribed user. Triggered by Vercel Cron (see vercel.json) — on
// the Hobby plan this can only run once per day and isn't guaranteed to
// fire at an exact minute, so this is a daily digest, not real-time
// per-reminder alerts. Upgrading to Pro would allow finer scheduling if
// that's ever needed.
//
// Requires: VAPID_PRIVATE_KEY, VITE_VAPID_PUBLIC_KEY (already set for the
// client), SUPABASE_URL/SUPABASE_ANON_KEY are NOT enough here — this needs
// SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard → Settings → API →
// service_role secret) since it reads across all users, bypassing RLS.
// Vercel provides CRON_SECRET automatically to verify the request is
// really from Vercel Cron and not a public hit on this URL.

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const required = ['VAPID_PRIVATE_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })

  webpush.setVapidDetails('mailto:notifications@example.com', process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const today = new Date().toISOString().slice(0, 10)

  const { data: subs, error: subsErr } = await supabase.from('push_subscriptions').select('*')
  if (subsErr) return res.status(500).json({ error: subsErr.message })
  if (!subs?.length) return res.status(200).json({ sent: 0, note: 'No subscribers' })

  const userIds = [...new Set(subs.map(s => s.user_id))]
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks').select('user_id,title,due_date,priority')
    .in('user_id', userIds).eq('completed', false).lte('due_date', today).not('due_date', 'is', null)
  if (tasksErr) return res.status(500).json({ error: tasksErr.message })

  const byUser = {}
  for (const t of tasks || []) (byUser[t.user_id] ||= []).push(t)

  let sent = 0, removed = 0
  for (const sub of subs) {
    const due = byUser[sub.user_id] || []
    if (!due.length) continue
    const overdue = due.filter(t => t.due_date < today).length
    const dueToday = due.length - overdue
    const bits = []
    if (overdue) bits.push(`${overdue} overdue`)
    if (dueToday) bits.push(`${dueToday} due today`)
    const payload = JSON.stringify({
      title: 'Reminders',
      body: `You have ${bits.join(' and ')}.`,
      url: '/',
      tag: 'reminders-digest',
    })
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        removed++
      } else {
        console.error('push send error', sub.id, e.message)
      }
    }
  }

  return res.status(200).json({ sent, removed, totalSubscribers: subs.length })
}
