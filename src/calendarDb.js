import { supabase } from './supabase.js'

export async function loadCategories(appId, userId) {
  let q = supabase
    .from('event_categories')
    .select('*')
    .eq('app_id', appId)
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q.order('sort_order')
  return data || []
}

export async function createCategory(appId, { name, color }, userId) {
  const { data: existing } = await supabase
    .from('event_categories')
    .select('sort_order')
    .eq('app_id', appId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await supabase
    .from('event_categories')
    .insert({ app_id: appId, user_id: userId || null, name, color, sort_order })
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

export async function loadEvents(appId, fromDate, toDate, userId) {
  let q = supabase
    .from('events')
    .select('*, event_categories(id,name,color)')
    .eq('app_id', appId)
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
    .or(`and(start_at.gte.${fromDate},start_at.lte.${toDate}),recurrence.neq.none`)
  return data || []
}

export async function createEvent(appId, payload, userId) {
  const { data } = await supabase
    .from('events')
    .insert({ app_id: appId, user_id: userId || null, ...payload })
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
