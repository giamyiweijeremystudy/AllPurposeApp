import { supabase } from './supabase.js'
import * as db from './db.js'

// Executes a function call the AI requested, using the signed-in user's own
// Supabase session — so normal RLS rules apply, same as any other write in
// the app. Returns { ok, summary, data? } for both success and failure so
// the model can report back to the user either way.
//
// Full CRUD is supported for tasks, calendar events, notes, and sidebar
// pages — matching everything buildAppContext() exposes to the model.
export async function runFunctionCall(fc, { appId, userId, state }) {
  const { name, args = {} } = fc
  try {
    switch (name) {
      // ── Tasks ──────────────────────────────────────────
      case 'add_task': {
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
      case 'update_task': {
        if (!args.id) throw new Error('Missing task id')
        const patch = {}
        if (args.title !== undefined) patch.title = args.title
        if (args.due_date !== undefined) patch.due_date = args.due_date || null
        if (args.priority !== undefined && ['low', 'medium', 'high'].includes(args.priority)) patch.priority = args.priority
        if (args.completed !== undefined) { patch.completed = !!args.completed; patch.completed_at = args.completed ? new Date().toISOString() : null }
        const { data, error } = await supabase.from('tasks').update(patch).eq('id', args.id).select().single()
        if (error) throw error
        return { ok: true, summary: `Updated task "${data?.title || args.id}"`, data }
      }
      case 'delete_task': {
        if (!args.id) throw new Error('Missing task id')
        const { data: existing } = await supabase.from('tasks').select('title').eq('id', args.id).single()
        const { error } = await supabase.from('tasks').delete().eq('id', args.id)
        if (error) throw error
        return { ok: true, summary: `Deleted task "${existing?.title || args.id}"` }
      }

      // ── Calendar events ──────────────────────────────────
      case 'add_event': {
        if (!args.title?.trim() || !args.start_at) throw new Error('Missing event title or start time')
        const { data, error } = await supabase.from('events').insert({
          app_id: appId, user_id: userId, title: args.title.trim(),
          start_at: args.start_at, end_at: args.end_at || args.start_at,
          all_day: !!args.all_day,
        }).select().single()
        if (error) throw error
        return { ok: true, summary: `Added event "${args.title.trim()}"`, data }
      }
      case 'update_event': {
        if (!args.id) throw new Error('Missing event id')
        const patch = {}
        if (args.title !== undefined) patch.title = args.title
        if (args.start_at !== undefined) patch.start_at = args.start_at
        if (args.end_at !== undefined) patch.end_at = args.end_at
        if (args.all_day !== undefined) patch.all_day = !!args.all_day
        const { data, error } = await supabase.from('events').update(patch).eq('id', args.id).select().single()
        if (error) throw error
        return { ok: true, summary: `Updated event "${data?.title || args.id}"`, data }
      }
      case 'delete_event': {
        if (!args.id) throw new Error('Missing event id')
        const { data: existing } = await supabase.from('events').select('title').eq('id', args.id).single()
        const { error } = await supabase.from('events').delete().eq('id', args.id)
        if (error) throw error
        return { ok: true, summary: `Deleted event "${existing?.title || args.id}"` }
      }

      // ── Notes ──────────────────────────────────────────
      case 'add_note': {
        if (!args.label?.trim() || !args.note?.trim()) throw new Error('Missing note label or content')
        const overview = (state?.navItems || []).find(n => n.label === 'Overview')
        if (!overview) throw new Error('No Overview page found to attach the note to')
        const widget = await db.createWidget(overview.id, { type: 'note', label: args.label.trim(), note: args.note.trim() })
        return { ok: true, summary: `Added note "${args.label.trim()}" to Overview`, data: widget }
      }
      case 'update_note': {
        if (!args.id) throw new Error('Missing note id')
        const patch = {}
        if (args.label !== undefined) patch.label = args.label
        if (args.note !== undefined) patch.note = args.note
        const data = await db.updateWidget(args.id, patch)
        return { ok: true, summary: `Updated note "${data?.label || args.id}"`, data }
      }
      case 'delete_note': {
        if (!args.id) throw new Error('Missing note id')
        const existing = (state?.widgets || []).find(w => w.id === args.id)
        await db.deleteWidget(args.id)
        return { ok: true, summary: `Deleted note "${existing?.label || args.id}"` }
      }

      // ── Sidebar pages ────────────────────────────────────
      case 'add_page': {
        if (!args.label?.trim()) throw new Error('Missing page label')
        const sections = state?.sections || []
        let section = sections.find(s => s.label.toLowerCase() === (args.section || 'main').toLowerCase())
        if (!section) section = await db.createSection(appId, args.section?.trim() || 'Main')
        const item = await db.createNavItem(section.id, { label: args.label.trim(), icon: args.icon?.trim() || 'ti-star' })
        return { ok: true, summary: `Added page "${args.label.trim()}" to the sidebar`, data: item }
      }
      case 'update_page': {
        if (!args.id) throw new Error('Missing page id')
        const patch = {}
        if (args.label !== undefined) patch.label = args.label
        if (args.icon !== undefined) patch.icon = args.icon
        const data = await db.updateNavItem(args.id, patch)
        return { ok: true, summary: `Updated page "${data?.label || args.id}"`, data }
      }
      case 'delete_page': {
        if (!args.id) throw new Error('Missing page id')
        const existing = (state?.navItems || []).find(n => n.id === args.id)
        await db.deleteNavItem(args.id)
        return { ok: true, summary: `Removed page "${existing?.label || args.id}" from the sidebar` }
      }

      default:
        return { ok: false, summary: `Unknown action requested: ${name}` }
    }
  } catch (e) {
    return { ok: false, summary: `Couldn't complete "${name}": ${e.message || e}` }
  }
}
