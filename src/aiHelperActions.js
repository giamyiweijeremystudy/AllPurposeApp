import { supabase } from './supabase.js'
import * as db from './db.js'

// Executes a function call the AI requested, using the signed-in user's own
// Supabase session — so normal RLS rules apply, same as any other write in
// the app. Returns { ok, summary, data? } for both success and failure so
// the model can report back to the user either way.
export async function runFunctionCall(fc, { appId, userId, state }) {
  const { name, args = {} } = fc
  try {
    if (name === 'add_task') {
      if (!args.title?.trim()) throw new Error('Missing task title')
      const { data, error } = await supabase.from('tasks').insert({
        app_id: appId, user_id: userId, title: args.title.trim(),
        due_date: args.due_date || null,
        priority: ['low', 'medium', 'high'].includes(args.priority) ? args.priority : 'medium',
        sort_order: 9999,
      }).select().single()
      if (error) throw error
      return { ok: true, summary: `Added task "${args.title.trim()}"`, data }
    }

    if (name === 'add_page') {
      if (!args.label?.trim()) throw new Error('Missing page label')
      const sections = state?.sections || []
      let section = sections.find(s => s.label.toLowerCase() === (args.section || 'main').toLowerCase())
      if (!section) section = await db.createSection(appId, args.section?.trim() || 'Main')
      const item = await db.createNavItem(section.id, {
        label: args.label.trim(),
        icon: args.icon?.trim() || 'ti-star',
      })
      return { ok: true, summary: `Added page "${args.label.trim()}" to the sidebar`, data: item }
    }

    if (name === 'add_note') {
      if (!args.label?.trim() || !args.note?.trim()) throw new Error('Missing note label or content')
      const overview = (state?.navItems || []).find(n => n.label === 'Overview')
      if (!overview) throw new Error('No Overview page found to attach the note to')
      const widget = await db.createWidget(overview.id, {
        type: 'note', label: args.label.trim(), note: args.note.trim(),
      })
      return { ok: true, summary: `Added note "${args.label.trim()}" to Overview`, data: widget }
    }

    if (name === 'add_event') {
      if (!args.title?.trim() || !args.start_at) throw new Error('Missing event title or start time')
      const { data, error } = await supabase.from('events').insert({
        app_id: appId, user_id: userId, title: args.title.trim(),
        start_at: args.start_at, end_at: args.end_at || args.start_at,
        all_day: !!args.all_day,
      }).select().single()
      if (error) throw error
      return { ok: true, summary: `Added event "${args.title.trim()}"`, data }
    }

    return { ok: false, summary: `Unknown action requested: ${name}` }
  } catch (e) {
    return { ok: false, summary: `Couldn't complete "${name}": ${e.message || e}` }
  }
}
