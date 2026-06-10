import { supabase } from './supabase.js'

export async function loadCategories(appId) {
  const { data } = await supabase
    .from('event_categories')
    .select('*')
    .eq('app_id', appId)
    .order('sort_order')
  return data || []
}

export async function createCategory(appId, { name, color }) {
  const { data: existing } = await supabase
    .from('event_categories')
    .select('sort_order')
    .eq('app_id', appId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await supabase
    .from('event_categories')
    .insert({ app_id: appId, name, color, sort_order })
    .select().single()
  return data
}

export async function updateCategory(id, patch) {
  const { data } = await supabase
    .from('event_categories')
    .update(patch).eq('id', id).select().single()
  return data
}

export async function deleteCategory(id) {
  await supabase.from('event_categories').delete().eq('id', id)
}

export async function loadEvents(appId, fromDate, toDate) {
  const { data } = await supabase
    .from('events')
    .select('*, event_categories(id,name,color)')
    .eq('app_id', appId)
    .or(`and(start_at.gte.${fromDate},start_at.lte.${toDate}),recurrence.neq.none`)
  return data || []
}

export async function createEvent(appId, payload) {
  const { data } = await supabase
    .from('events')
    .insert({ app_id: appId, ...payload })
    .select('*, event_categories(id,name,color)').single()
  return data
}

export async function updateEvent(id, payload) {
  const { data } = await supabase
    .from('events')
    .update(payload).eq('id', id)
    .select('*, event_categories(id,name,color)').single()
  return data
}

export async function deleteEvent(id) {
  await supabase.from('events').delete().eq('id', id)
}
