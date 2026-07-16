import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'
import { FinanceAssistant } from './FinanceAssistant.jsx'

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Entertainment', 'Health', 'Education', 'Salary', 'Other']
const CAT_COLORS = {
  Food: '#5b5bf6', Transport: '#22d3ee', Housing: '#f59e0b', Shopping: '#ec4899',
  Entertainment: '#8b5cf6', Health: '#10b981', Education: '#3b82f6', Salary: '#30a46c', Other: '#94a3b8',
}

function pad(n) { return String(n).padStart(2, '0') }
function dstr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function todayStr() { return dstr(new Date()) }
function fmtMoney(n) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtShort(n) {
  const a = Math.abs(n)
  if (a >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(Math.round(n))
}

// Range helpers -------------------------------------------------
function startOfWeek(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x }
function rangeFor(period, anchor) {
  const a = new Date(anchor)
  if (period === 'week') {
    const s = startOfWeek(a); const e = new Date(s); e.setDate(s.getDate() + 6)
    return { start: s, end: e }
  }
  if (period === 'month') {
    return { start: new Date(a.getFullYear(), a.getMonth(), 1), end: new Date(a.getFullYear(), a.getMonth() + 1, 0) }
  }
  return { start: new Date(a.getFullYear(), 0, 1), end: new Date(a.getFullYear(), 11, 31) }
}
function shiftAnchor(period, anchor, dir) {
  const a = new Date(anchor)
  if (period === 'week') a.setDate(a.getDate() + dir * 7)
  else if (period === 'month') a.setMonth(a.getMonth() + dir)
  else a.setFullYear(a.getFullYear() + dir)
  return a
}
function rangeLabel(period, anchor) {
  const { start, end } = rangeFor(period, anchor)
  if (period === 'week') return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
  if (period === 'month') return start.toLocaleDateString([], { month: 'long', year: 'numeric' })
  return String(start.getFullYear())
}
function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
function weekKey(d) { return dstr(startOfWeek(d)) }

// Animated number ----------------------------------------------
function useCountUp(target, ms = 600) {
  const [val, setVal] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    const from = ref.current, start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (target - from) * eased
      setVal(v); ref.current = v
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

export function Finance({ appId, userId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [anchor, setAnchor] = useState(new Date())
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [form, setForm] = useState({ kind: 'expense', amount: '', category: 'Food', description: '', entry_date: todayStr() })
  const [adding, setAdding] = useState(false)

  const reload = () => {
    supabase.from('finance_entries').select('*')
      .eq('app_id', appId).eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }
  useEffect(() => { if (appId && userId) reload() }, [appId, userId])

  const { start, end } = useMemo(() => rangeFor(period, anchor), [period, anchor])
  const inRange = useMemo(() => {
    const s = dstr(start), e = dstr(end)
    return entries.filter(x => x.entry_date >= s && x.entry_date <= e)
  }, [entries, start, end])

  const totals = useMemo(() => {
    const income = inRange.filter(e => e.kind === 'income').reduce((s, e) => s + Number(e.amount), 0)
    const expense = inRange.filter(e => e.kind === 'expense').reduce((s, e) => s + Number(e.amount), 0)
    const byCategory = {}
    for (const e of inRange.filter(e => e.kind === 'expense')) byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
    return { income, expense, net: income - expense, byCategory }
  }, [inRange])

  // Time-series buckets for the bar chart
  const series = useMemo(() => buildSeries(period, anchor, inRange), [period, anchor, inRange])

  // Picker option lists — always include the current period, plus any period that has entries
  const monthOptions = useMemo(() => {
    const set = new Set(entries.map(e => e.entry_date.slice(0, 7)))
    set.add(monthKey(new Date()))
    return [...set].sort().reverse()
  }, [entries])
  const yearOptions = useMemo(() => {
    const set = new Set(entries.map(e => e.entry_date.slice(0, 4)))
    set.add(String(new Date().getFullYear()))
    return [...set].sort().reverse()
  }, [entries])
  const weekOptions = useMemo(() => {
    const set = new Map()
    for (const e of entries) { const wk = weekKey(new Date(e.entry_date + 'T00:00:00')); set.set(wk, wk) }
    set.set(weekKey(new Date()), weekKey(new Date()))
    return [...set.keys()].sort().reverse()
  }, [entries])

  // Last 6 months of expense totals, for the comparison chart
  const monthComparison = useMemo(() => {
    const months = []
    const a = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(a.getFullYear(), a.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: d.toLocaleDateString([], { month: 'short' }), value: 0 })
    }
    for (const e of entries) {
      if (e.kind !== 'expense') continue
      const k = e.entry_date.slice(0, 7)
      const b = months.find(m => m.key === k)
      if (b) b.value += Number(e.amount)
    }
    return months
  }, [entries])

  const animIncome = useCountUp(totals.income)
  const animExpense = useCountUp(totals.expense)
  const animNet = useCountUp(totals.net)

  const addEntry = async () => {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    setAdding(true)
    const { data, error } = await supabase.from('finance_entries').insert({
      app_id: appId, user_id: userId, kind: form.kind, amount,
      category: form.category, description: form.description.trim(), entry_date: form.entry_date,
    }).select().single()
    setAdding(false)
    if (error) return
    setEntries(prev => [data, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date)))
    setForm(f => ({ ...f, amount: '', description: '' }))
  }
  const deleteEntry = async (id) => {
    await supabase.from('finance_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
      {/* Period switcher + AI button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-2)', borderRadius: 10, padding: 3 }}>
          {['week', 'month', 'year'].map(p => (
            <button key={p} onClick={() => { setPeriod(p); setAnchor(new Date()) }} style={{
              border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              textTransform: 'capitalize', background: period === p ? 'var(--bg)' : 'transparent',
              color: period === p ? 'var(--text)' : 'var(--text-3)', boxShadow: period === p ? 'var(--shadow)' : 'none',
            }}>{p}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCompareOpen(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
          background: compareOpen ? 'var(--accent-soft)' : 'var(--bg)', color: compareOpen ? 'var(--accent)' : 'var(--text-2)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-chart-bar" /> Compare
        </button>
        <button onClick={() => setAssistantOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '9px 14px',
          background: 'var(--accent-grad)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--glow)',
        }}>
          <i className="ti ti-sparkles" /> AI assistant
        </button>
      </div>

      {compareOpen && <MonthCompare data={monthComparison} />}

      {/* Range nav with jump-to picker */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <button onClick={() => setAnchor(a => shiftAnchor(period, a, -1))} style={navBtn}><i className="ti ti-chevron-left" /></button>
        <button onClick={() => setPickerOpen(v => !v)} style={{
          border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', minWidth: 160, justifyContent: 'center', color: 'var(--text)',
        }}>
          {rangeLabel(period, anchor)} <i className="ti ti-chevron-down" style={{ fontSize: 13, color: 'var(--text-3)', transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        <button onClick={() => setAnchor(a => shiftAnchor(period, a, 1))} style={navBtn}><i className="ti ti-chevron-right" /></button>

        {pickerOpen && (
          <PeriodPicker
            period={period} anchor={anchor}
            monthOptions={monthOptions} yearOptions={yearOptions} weekOptions={weekOptions}
            onPick={(d) => { setAnchor(d); setPickerOpen(false) }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { label: 'Income', value: animIncome, color: 'var(--success)' },
          { label: 'Expenses', value: animExpense, color: 'var(--danger)' },
          { label: 'Net', value: animNet, color: totals.net >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map(c => (
          <div key={c.label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: c.color, marginTop: 2 }}>{fmtMoney(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Trend bar chart */}
      <BarChart series={series} title={period === 'week' ? 'Daily spending' : period === 'month' ? 'Spending by week' : 'Monthly spending'} />

      {/* Category donut + legend */}
      {Object.keys(totals.byCategory).length > 0 && (
        <DonutChart byCategory={totals.byCategory} total={totals.expense} />
      )}

      {/* Add entry */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['expense', 'income'].map(k => (
            <button key={k} onClick={() => setForm(f => ({ ...f, kind: k }))} style={{
              flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
              background: form.kind === k ? 'var(--accent)' : 'transparent', color: form.kind === k ? '#fff' : 'var(--text)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{k}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="number" inputMode="decimal" placeholder="Amount" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            style={{ ...inp, flex: '1 1 100px' }} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, flex: '1 1 110px' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} style={{ ...inp, flex: '1 1 130px' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="Description (optional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addEntry()} style={{ ...inp, flex: 1 }} />
          <button onClick={addEntry} disabled={adding || !parseFloat(form.amount)} style={{
            border: 'none', borderRadius: 8, padding: '0 16px', background: 'var(--accent)', color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: adding || !parseFloat(form.amount) ? 'default' : 'pointer',
            opacity: adding || !parseFloat(form.amount) ? 0.5 : 1,
          }}>Add</button>
        </div>
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {inRange.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 12 }}>No entries in this {period}.</div>}
        {inRange.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: CAT_COLORS[e.category] || CAT_COLORS.Other, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || e.category}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{e.category} · {e.entry_date}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: e.kind === 'income' ? 'var(--success)' : 'var(--text)' }}>
              {e.kind === 'income' ? '+' : '−'}{fmtMoney(e.amount)}
            </div>
            <button onClick={() => deleteEntry(e.id)} title="Delete" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 15, padding: 6 }}>
              <i className="ti ti-x" />
            </button>
          </div>
        ))}
      </div>

      {assistantOpen && (
        <FinanceAssistant appId={appId} userId={userId} entries={entries} onClose={() => setAssistantOpen(false)} onEntriesAdded={reload} />
      )}
    </div>
  )
}

// Build time-series buckets --------------------------------------
function buildSeries(period, anchor, inRange) {
  const buckets = []
  if (period === 'week') {
    const s = startOfWeek(anchor)
    for (let i = 0; i < 7; i++) { const d = new Date(s); d.setDate(s.getDate() + i); buckets.push({ label: d.toLocaleDateString([], { weekday: 'narrow' }), key: dstr(d), value: 0 }) }
    for (const e of inRange) if (e.kind === 'expense') { const b = buckets.find(x => x.key === e.entry_date); if (b) b.value += Number(e.amount) }
  } else if (period === 'month') {
    const a = new Date(anchor)
    const daysInMonth = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate()
    const weeks = Math.ceil(daysInMonth / 7)
    for (let i = 0; i < weeks; i++) buckets.push({ label: `W${i + 1}`, value: 0 })
    for (const e of inRange) if (e.kind === 'expense') { const day = Number(e.entry_date.slice(8)); const wi = Math.min(weeks - 1, Math.floor((day - 1) / 7)); buckets[wi].value += Number(e.amount) }
  } else {
    for (let m = 0; m < 12; m++) buckets.push({ label: new Date(2000, m, 1).toLocaleDateString([], { month: 'narrow' }), value: 0 })
    for (const e of inRange) if (e.kind === 'expense') { const mi = Number(e.entry_date.slice(5, 7)) - 1; buckets[mi].value += Number(e.amount) }
  }
  return buckets
}

// Animated bar chart --------------------------------------------
function BarChart({ series, title }) {
  const max = Math.max(1, ...series.map(s => s.value))
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
        {series.map((s, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, opacity: s.value > 0 ? 1 : 0 }}>{fmtShort(s.value)}</div>
            <div style={{
              width: '100%', maxWidth: 42, borderRadius: '6px 6px 0 0',
              height: mounted ? `${(s.value / max) * 100}%` : '0%',
              minHeight: s.value > 0 ? 4 : 0,
              background: 'var(--accent-grad)',
              transition: `height 0.7s var(--ease-out) ${i * 0.04}s`,
            }} />
            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Animated donut chart ------------------------------------------
function DonutChart({ byCategory, total }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])
  const items = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const R = 54, C = 2 * Math.PI * R
  let offset = 0
  const segments = items.map(([cat, amt]) => {
    const frac = amt / total
    const seg = { cat, amt, frac, dash: frac * C, offset: offset * C, color: CAT_COLORS[cat] || CAT_COLORS.Other }
    offset += frac
    return seg
  })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'var(--bg)', boxShadow: 'var(--shadow)', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 70 70)">
          {segments.map((s, i) => (
            <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="18"
              strokeDasharray={`${mounted ? s.dash : 0} ${C}`} strokeDashoffset={-s.offset}
              style={{ transition: `stroke-dasharray 0.8s var(--ease-out) ${i * 0.06}s` }} />
          ))}
        </g>
        <text x="70" y="66" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-3)' }}>Spent</text>
        <text x="70" y="82" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--text)', fontFamily: 'var(--font-display)' }}>{fmtShort(total)}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.cat}</span>
            <span style={{ color: 'var(--text-3)' }}>{Math.round(s.frac * 100)}%</span>
            <span style={{ fontWeight: 600, width: 76, textAlign: 'right' }}>{fmtMoney(s.amt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }
const navBtn = { border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', color: 'var(--text-2)', fontSize: 15 }

// Dropdown / calendar-style jump-to picker for week, month, or year -----
function PeriodPicker({ period, anchor, monthOptions, yearOptions, weekOptions, onPick, onClose }) {
  const current = period === 'year' ? String(new Date(anchor).getFullYear()) : period === 'month' ? monthKey(new Date(anchor)) : weekKey(new Date(anchor))
  const options = period === 'year' ? yearOptions : period === 'month' ? monthOptions : weekOptions

  const labelFor = (key) => {
    if (period === 'year') return key
    if (period === 'month') { const [y, m] = key.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }) }
    const s = new Date(key + 'T00:00:00'); const e = new Date(s); e.setDate(s.getDate() + 6)
    return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
  }
  const toDate = (key) => {
    if (period === 'year') return new Date(Number(key), 0, 1)
    if (period === 'month') { const [y, m] = key.split('-'); return new Date(Number(y), Number(m) - 1, 1) }
    return new Date(key + 'T00:00:00')
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8, zIndex: 41,
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)',
        padding: 6, minWidth: 200, maxHeight: 260, overflowY: 'auto', animation: 'module-enter 0.18s var(--ease-out)',
      }}>
        {options.map(key => (
          <button key={key} onClick={() => onPick(toDate(key))} style={{
            display: 'block', width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: '8px 10px',
            fontSize: 13, cursor: 'pointer', background: key === current ? 'var(--accent-soft)' : 'transparent',
            color: key === current ? 'var(--accent)' : 'var(--text)', fontWeight: key === current ? 600 : 400,
          }}>{labelFor(key)}</button>
        ))}
      </div>
    </>
  )
}

// Last-6-months comparison bar chart -------------------------------------
function MonthCompare({ data }) {
  const max = Math.max(1, ...data.map(d => d.value))
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 14 }}>Last 6 months compared</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
        {data.map((d, i) => (
          <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600, opacity: d.value > 0 ? 1 : 0 }}>{fmtShort(d.value)}</div>
            <div style={{
              width: '100%', maxWidth: 40, borderRadius: '6px 6px 0 0',
              height: mounted ? `${(d.value / max) * 100}%` : '0%', minHeight: d.value > 0 ? 4 : 0,
              background: i === data.length - 1 ? 'var(--accent-grad)' : 'var(--bg-3)',
              border: i === data.length - 1 ? 'none' : '1px solid var(--border-2)',
              transition: `height 0.7s var(--ease-out) ${i * 0.05}s`,
            }} />
            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
