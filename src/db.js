import { supabase } from './supabase.js'

// ── App config ──────────────────────────────────────────────
export async function loadState() {
  const [
    { data: apps },
    { data: sections },
    { data: navItems },
    { data: tabs },
    { data: widgets },
    { data: buttons },
  ] = await Promise.all([
    supabase.from('app_config').select('*').limit(1).single(),
    supabase.from('nav_sections').select('*').order('sort_order'),
    supabase.from('nav_items').select('*').order('sort_order'),
    supabase.from('tabs').select('*').order('sort_order'),
    supabase.from('widgets').select('*').order('sort_order'),
    supabase.from('toolbar_buttons').select('*').order('sort_order'),
  ])
  return { app: apps, sections: sections || [], navItems: navItems || [], tabs: tabs || [], widgets: widgets || [], buttons: buttons || [] }
}

export async function updateAppName(id, name) {
  const { data } = await supabase.from('app_config').update({ name }).eq('id', id).select().single()
  return data
}

// ── Sections ────────────────────────────────────────────────
export async function createSection(appId, label) {
  const { data: existing } = await supabase.from('nav_sections').select('sort_order').eq('app_id', appId).order('sort_order', { ascending: false }).limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await supabase.from('nav_sections').insert({ app_id: appId, label, sort_order }).select().single()
  return data
}

export async function deleteSection(id) {
  await supabase.from('nav_sections').delete().eq('id', id)
}

export async function updateSection(id, patch) {
  const { data } = await supabase.from('nav_sections').update(patch).eq('id', id).select().single()
  return data
}

// ── Nav items ───────────────────────────────────────────────
export async function createNavItem(sectionId, { label, icon, badge }) {
  const { data: existing } = await supabase.from('nav_items').select('sort_order').eq('section_id', sectionId).order('sort_order', { ascending: false }).limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await supabase.from('nav_items').insert({ section_id: sectionId, label, icon: icon || 'ti-home', badge: badge || '', sort_order }).select().single()
  return data
}

export async function deleteNavItem(id) {
  await supabase.from('nav_items').delete().eq('id', id)
}

export async function updateNavItem(id, patch) {
  const { data } = await supabase.from('nav_items').update(patch).eq('id', id).select().single()
  return data
}

// ── Tabs ────────────────────────────────────────────────────
export async function createTab(pageId, { label, icon }) {
  const { data: existing } = await supabase.from('tabs').select('sort_order').eq('page_id', pageId).order('sort_order', { ascending: false }).limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await supabase.from('tabs').insert({ page_id: pageId, label, icon: icon || 'ti-layout-dashboard', sort_order }).select().single()
  return data
}

export async function deleteTab(id) {
  await supabase.from('tabs').delete().eq('id', id)
}

export async function updateTab(id, patch) {
  const { data } = await supabase.from('tabs').update(patch).eq('id', id).select().single()
  return data
}

// ── Widgets ─────────────────────────────────────────────────
export async function createWidget(pageId, payload, tabId) {
  const query = supabase.from('widgets').select('sort_order').eq('page_id', pageId)
  if (tabId) query.eq('tab_id', tabId)
  const { data: existing } = await query.order('sort_order', { ascending: false }).limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const insert = { page_id: pageId, ...payload, sort_order }
  if (tabId) insert.tab_id = tabId
  const { data } = await supabase.from('widgets').insert(insert).select().single()
  return data
}

export async function updateWidget(id, payload) {
  const { data } = await supabase.from('widgets').update(payload).eq('id', id).select().single()
  return data
}

export async function deleteWidget(id) {
  await supabase.from('widgets').delete().eq('id', id)
}

// ── Buttons ─────────────────────────────────────────────────
export async function createButton(appId, payload) {
  const { data: existing } = await supabase.from('toolbar_buttons').select('sort_order').eq('app_id', appId).order('sort_order', { ascending: false }).limit(1)
  const sort_order = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await supabase.from('toolbar_buttons').insert({ app_id: appId, ...payload, sort_order }).select().single()
  return data
}

export async function deleteButton(id) {
  await supabase.from('toolbar_buttons').delete().eq('id', id)
}
