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

  try {
    if (userId) {
      const { data: kb } = await supabase
        .from('kb_nodes').select('id,parent_id,kind,title,content')
        .eq('app_id', appId).eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (kb?.length) {
        const byId = Object.fromEntries(kb.map(n => [n.id, n]))
        const pathOf = n => {
          const parts = [n.title]
          let p = n.parent_id
          while (p && byId[p]) { parts.unshift(byId[p].title); p = byId[p].parent_id }
          return parts.join(' / ')
        }
        const pages = kb.filter(n => n.kind === 'page').slice(0, 30)
        const folders = kb.filter(n => n.kind === 'folder')
        parts.push(
          `Knowledge base — organized as books/sections/subsections/pages:\n` +
          `Folders: ${folders.map(f => pathOf(f)).join(', ') || 'none yet'}\n` +
          `Pages (most recently updated first):\n` +
          pages.map(p => `- [id:${p.id}] ${pathOf(p)}: ${(p.content || '').slice(0, 150)}${(p.content || '').length > 150 ? '…' : ''}`).join('\n')
        )
      }
    }
  } catch (e) { /* kb_nodes table may not exist yet — ignore */ }

  try {
    if (userId) {
      const monthStart = new Date(); monthStart.setDate(1)
      const { data: fin } = await supabase
        .from('finance_entries').select('id,kind,amount,category,description,entry_date')
        .eq('app_id', appId).eq('user_id', userId)
        .gte('entry_date', monthStart.toISOString().slice(0, 10))
        .order('entry_date', { ascending: false }).limit(50)
      if (fin?.length) {
        const income = fin.filter(f => f.kind === 'income').reduce((s, f) => s + Number(f.amount), 0)
        const expense = fin.filter(f => f.kind === 'expense').reduce((s, f) => s + Number(f.amount), 0)
        parts.push(
          `Finance (this month: income ${income.toFixed(2)}, expenses ${expense.toFixed(2)}, net ${(income - expense).toFixed(2)}):\n` +
          fin.slice(0, 30).map(f => `- [id:${f.id}] ${f.kind} ${Number(f.amount).toFixed(2)} ${f.category}${f.description ? ` — ${f.description}` : ''} (${f.entry_date})`).join('\n')
        )
      }
    }
  } catch (e) { /* finance_entries table may not exist yet — ignore */ }

  try {
    if (userId) {
      const { data: wo } = await supabase
        .from('workouts').select('id,exercise,custom_name,performed_at,sets,reps,weight_kg,duration_min,distance_km')
        .eq('app_id', appId).eq('user_id', userId)
        .order('performed_at', { ascending: false }).limit(30)
      if (wo?.length) {
        parts.push(
          `Recent workouts:\n` +
          wo.map(w => {
            const bits = []
            if (w.sets && w.reps) bits.push(`${w.sets}x${w.reps}`)
            if (w.weight_kg) bits.push(`${w.weight_kg}kg`)
            if (w.distance_km) bits.push(`${Number(w.distance_km).toFixed(1)}km`)
            if (w.duration_min) bits.push(`${w.duration_min}min`)
            return `- [id:${w.id}] ${w.performed_at.slice(0, 10)} ${w.custom_name || w.exercise}: ${bits.join(' ') || 'logged'}`
          }).join('\n')
        )
      }
    }
  } catch (e) { /* workouts table may not exist yet — ignore */ }

  return parts.join('\n\n')
}
