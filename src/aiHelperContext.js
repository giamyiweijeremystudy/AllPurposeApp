import { supabase } from './supabase.js'

// Builds a compact text snapshot of the user's app data (tasks, upcoming
// events, notes, and page layout) to hand to the AI as context, so it can
// answer questions about what's actually in the app.
export async function buildAppContext(appId, userId, state) {
  const parts = []

  parts.push(`App name: ${state?.app?.name || 'My App'}`)

  const pages = (state?.navItems || [])
    .map(n => n.label)
    .filter(Boolean)
  if (pages.length) parts.push(`Pages: ${pages.join(', ')}`)

  const notes = (state?.widgets || [])
    .filter(w => w.type === 'note' && w.note)
    .map(w => `- ${w.label}: ${w.note}`)
  if (notes.length) parts.push(`Notes:\n${notes.join('\n')}`)

  try {
    if (userId) {
      const { data: tasks } = await supabase
        .from('tasks').select('title,completed,due_date')
        .eq('app_id', appId).eq('user_id', userId).order('sort_order')
      if (tasks?.length) {
        const open = tasks.filter(t => !t.completed)
        const done = tasks.filter(t => t.completed)
        parts.push(
          `Tasks (${open.length} open, ${done.length} completed):\n` +
          open.slice(0, 40).map(t => `- [ ] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n')
        )
      }
    }
  } catch (e) { /* tasks table may not exist yet for this app — ignore */ }

  try {
    if (userId) {
      const now = new Date()
      const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const { data: events } = await supabase
        .from('events')
        .select('title,start_at,end_at')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .gte('start_at', now.toISOString())
        .lte('start_at', in14.toISOString())
        .order('start_at')
        .limit(30)
      if (events?.length) {
        parts.push(
          `Upcoming events (next 14 days):\n` +
          events.map(e => `- ${e.title} — ${new Date(e.start_at).toLocaleString()}`).join('\n')
        )
      }
    }
  } catch (e) { /* events table may not exist yet for this app — ignore */ }

  return parts.join('\n\n')
}
