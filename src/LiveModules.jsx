import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

function pad(n) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function fmtMoney(n) {
  const v = Number(n)
  return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Live summary modules for the Overview dashboard. Each pulls a small
// slice of real data from its feature and deep-links to the page.
export function LiveModules({ appId, userId, navItems, onNavigate }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!appId || !userId) return
    const today = todayStr()
    const monthStart = today.slice(0, 8) + '01'
    const now = new Date().toISOString()
    const weekOut = new Date(Date.now() + 7 * 864e5).toISOString()

    Promise.all([
      supabase.from('tasks').select('title,due_date,completed').eq('app_id', appId).eq('user_id', userId).eq('completed', false),
      supabase.from('events').select('title,start_at').eq('app_id', appId).eq('user_id', userId).gte('start_at', now).lte('start_at', weekOut).order('start_at').limit(1),
      supabase.from('finance_entries').select('kind,amount').eq('app_id', appId).eq('user_id', userId).gte('entry_date', monthStart),
      supabase.from('kb_entries').select('title,updated_at').eq('app_id', appId).eq('user_id', userId).order('updated_at', { ascending: false }).limit(1),
    ].map(p => p.then(r => r, () => ({ data: null })))).then(([tasks, events, fin, kb]) => {
      const openTasks = tasks.data || []
      const dueToday = openTasks.filter(t => t.due_date === today).length
      const overdue = openTasks.filter(t => t.due_date && t.due_date < today).length
      const income = (fin.data || []).filter(f => f.kind === 'income').reduce((s, f) => s + Number(f.amount), 0)
      const expense = (fin.data || []).filter(f => f.kind === 'expense').reduce((s, f) => s + Number(f.amount), 0)
      setData({
        openTasks: openTasks.length, dueToday, overdue,
        nextEvent: events.data?.[0] || null,
        net: income - expense, hasFinance: (fin.data || []).length > 0,
        latestKb: kb.data?.[0] || null,
      })
    })
  }, [appId, userId])

  if (!data) return null

  const goTo = (label) => {
    const item = navItems.find(i => i.label === label)
    if (item) onNavigate(item.id)
  }

  const modules = []

  modules.push({
    key: 'tasks', kicker: 'Reminders', icon: 'ti-checkbox', target: 'Reminders',
    value: String(data.openTasks),
    sub: data.overdue > 0 ? `${data.overdue} overdue · ${data.dueToday} due today` : `${data.dueToday} due today`,
    alert: data.overdue > 0,
  })

  modules.push({
    key: 'event', kicker: 'Next event', icon: 'ti-calendar', target: 'Schedule',
    value: data.nextEvent ? data.nextEvent.title : 'Nothing scheduled',
    small: true,
    sub: data.nextEvent
      ? new Date(data.nextEvent.start_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
      : 'Next 7 days are clear',
  })

  modules.push({
    key: 'finance', kicker: 'This month', icon: 'ti-wallet', target: 'Finance',
    value: data.hasFinance ? fmtMoney(data.net) : '—',
    sub: data.hasFinance ? (data.net >= 0 ? 'Net positive' : 'Net negative') : 'No entries yet',
    tone: !data.hasFinance ? undefined : data.net >= 0 ? 'success' : 'danger',
  })

  modules.push({
    key: 'kb', kicker: 'Knowledge', icon: 'ti-notebook', target: 'Knowledge',
    value: data.latestKb ? data.latestKb.title : 'Start a note',
    small: true,
    sub: data.latestKb ? `Updated ${new Date(data.latestKb.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Capture what you\'re learning',
  })

  return (
    <div className="module-grid">
      {modules.map(m => (
        <button key={m.key} className="module-card" onClick={() => goTo(m.target)}>
          <div className="module-kicker">
            <i className={`ti ${m.icon}`} style={{ fontSize: 13 }} /> {m.kicker}
          </div>
          <div className={m.small ? 'module-value module-value--sm' : 'module-value'} style={{
            color: m.tone === 'success' ? 'var(--success)' : m.tone === 'danger' ? 'var(--danger)' : undefined,
          }}>
            {m.value}
          </div>
          <div className="module-sub" style={{ color: m.alert ? 'var(--danger)' : undefined }}>{m.sub}</div>
        </button>
      ))}
    </div>
  )
}
