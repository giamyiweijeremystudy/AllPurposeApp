import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Entertainment', 'Health', 'Education', 'Salary', 'Other']

function pad(n) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function monthKey(dateStr) { return dateStr?.slice(0, 7) }
function fmtMoney(n) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export function Finance({ appId, userId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(monthKey(todayStr()))
  const [form, setForm] = useState({ kind: 'expense', amount: '', category: 'Food', description: '', entry_date: todayStr() })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!appId || !userId) return
    supabase.from('finance_entries').select('*')
      .eq('app_id', appId).eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [appId, userId])

  const monthEntries = useMemo(() => entries.filter(e => monthKey(e.entry_date) === month), [entries, month])

  const totals = useMemo(() => {
    const income = monthEntries.filter(e => e.kind === 'income').reduce((s, e) => s + Number(e.amount), 0)
    const expense = monthEntries.filter(e => e.kind === 'expense').reduce((s, e) => s + Number(e.amount), 0)
    const byCategory = {}
    for (const e of monthEntries.filter(e => e.kind === 'expense')) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
    }
    return { income, expense, net: income - expense, byCategory }
  }, [monthEntries])

  const months = useMemo(() => {
    const set = new Set(entries.map(e => monthKey(e.entry_date)))
    set.add(monthKey(todayStr()))
    return [...set].sort().reverse()
  }, [entries])

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

  const monthLabel = new Date(month + '-01T00:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {/* Month selector + summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{
          border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5,
          background: 'var(--bg)', color: 'var(--text)', fontWeight: 600,
        }}>
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01T00:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' })}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { label: 'Income', value: totals.income, color: 'var(--success, #22c55e)' },
          { label: 'Expenses', value: totals.expense, color: 'var(--danger, #ef4444)' },
          { label: 'Net', value: totals.net, color: totals.net >= 0 ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)' },
        ].map(c => (
          <div key={c.label} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{fmtMoney(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {Object.keys(totals.byCategory).length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--bg)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {monthLabel} spending by category
          </div>
          {Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{cat}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (amt / totals.expense) * 100)}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, width: 80, textAlign: 'right' }}>{fmtMoney(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add entry */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <input
            type="number" inputMode="decimal" placeholder="Amount" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            style={{ flex: '1 1 100px', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }}
          />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ flex: '1 1 110px', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="date" value={form.entry_date}
            onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
            style={{ flex: '1 1 130px', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            placeholder="Description (optional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addEntry()}
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }}
          />
          <button onClick={addEntry} disabled={adding || !parseFloat(form.amount)} style={{
            border: 'none', borderRadius: 8, padding: '0 16px', background: 'var(--accent)', color: '#fff',
            fontSize: 13.5, fontWeight: 600, cursor: adding || !parseFloat(form.amount) ? 'default' : 'pointer',
            opacity: adding || !parseFloat(form.amount) ? 0.5 : 1,
          }}>Add</button>
        </div>
      </div>

      {/* Entries list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {monthEntries.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 12 }}>No entries for {monthLabel}.</div>}
        {monthEntries.map(e => (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 12px', background: 'var(--bg)',
          }}>
            <i className={`ti ${e.kind === 'income' ? 'ti-arrow-down-left' : 'ti-arrow-up-right'}`} style={{
              fontSize: 16, color: e.kind === 'income' ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)', flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.description || e.category}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{e.category} · {e.entry_date}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: e.kind === 'income' ? 'var(--success, #22c55e)' : 'var(--text)' }}>
              {e.kind === 'income' ? '+' : '−'}{fmtMoney(e.amount)}
            </div>
            <button onClick={() => deleteEntry(e.id)} title="Delete" style={{
              border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 15, padding: 6,
            }}>
              <i className="ti ti-x" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
