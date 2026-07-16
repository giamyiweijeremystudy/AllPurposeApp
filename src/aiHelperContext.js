import { supabase } from './supabase.js'

// Builds a compact text snapshot of the user's app data (tasks, upcoming
// events, notes, and page layout) to hand to the AI as context. Includes
// each item's id so the model can reference specific records when asked
// to update or delete something, not just create new ones.
export async function buildAppContext(appId, userId, state) {
  const parts = []

  parts.push(`App name: ${state?.app?.name || 'My App'}`)

  const pages = (state?.navItems || [])
    .map(n => `- [id:${n.id}] ${n.label}`)
  if (pages.length) parts.push(`Pages (sidebar):\n${pages.join('\n')}`)

  const notes = (state?.widgets || [])
    .filter(w => w.type === 'note' && w.note)
    .map(w => `- [id:${w.id}] ${w.label}: ${w.note}`)
  if (notes.length) parts.push(`Notes:\n${notes.join('\n')}`)

  try {
    if (userId) {
      const { data: tasks } = await supabase
        .from('tasks').select('id,title,completed,due_date')
        .eq('app_id', appId).eq('user_id', userId).order('sort_order')
      if (tasks?.length) {
        const open = tasks.filter(t => !t.completed)
        const done = tasks.filter(t => t.completed)
        parts.push(
          `Tasks (${open.length} open, ${done.length} completed):\n` +
          open.slice(0, 40).map(t => `- [id:${t.id}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n')
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
        .select('id,title,start_at,end_at')
        .eq('app_id', appId)
        .eq('user_id', userId)
        .gte('start_at', now.toISOString())
        .lte('start_at', in14.toISOString())
        .order('start_at')
        .limit(30)
      if (events?.length) {
        parts.push(
          `Upcoming events (next 14 days):\n` +
          events.map(e => `- [id:${e.id}] ${e.title} — ${new Date(e.start_at).toLocaleString()}`).join('\n')
        )
      }
    }
  } catch (e) { /* events table may not exist yet for this app — ignore */ }

  return parts.join('\n\n')
}
