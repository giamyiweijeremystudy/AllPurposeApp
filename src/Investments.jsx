import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'

const KINDS = ['stock', 'etf', 'crypto', 'bond', 'fund', 'other']
function fmtMoney(n) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }

export function Investments({ appId, userId }) {
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', ticker: '', kind: 'stock', quantity: '', cost_basis: '', current_price: '' })
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editPrice, setEditPrice] = useState('')

  useEffect(() => {
    if (!appId || !userId) return
    supabase.from('investments').select('*').eq('app_id', appId).eq('user_id', userId).order('created_at')
      .then(({ data }) => { setHoldings(data || []); setLoading(false) })
  }, [appId, userId])

  const totals = useMemo(() => {
    let value = 0, cost = 0
    for (const h of holdings) { value += Number(h.quantity) * Number(h.current_price); cost += Number(h.quantity) * Number(h.cost_basis) }
    return { value, cost, gain: value - cost, pct: cost > 0 ? ((value - cost) / cost) * 100 : 0 }
  }, [holdings])

  const addHolding = async () => {
    if (!form.name.trim() || !parseFloat(form.quantity)) return
    setAdding(true)
    const { data, error } = await supabase.from('investments').insert({
      app_id: appId, user_id: userId, name: form.name.trim(), ticker: form.ticker.trim().toUpperCase(),
      kind: form.kind, quantity: parseFloat(form.quantity) || 0,
      cost_basis: parseFloat(form.cost_basis) || 0, current_price: parseFloat(form.current_price) || parseFloat(form.cost_basis) || 0,
    }).select().single()
    setAdding(false)
    if (error) return
    setHoldings(prev => [...prev, data])
    setForm({ name: '', ticker: '', kind: 'stock', quantity: '', cost_basis: '', current_price: '' })
  }
  const savePrice = async (id) => {
    const price = parseFloat(editPrice)
    if (isNaN(price)) { setEditId(null); return }
    await supabase.from('investments').update({ current_price: price, updated_at: new Date().toISOString() }).eq('id', id)
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, current_price: price } : h))
    setEditId(null)
  }
  const deleteHolding = async (id) => {
    await supabase.from('investments').delete().eq('id', id)
    setHoldings(prev => prev.filter(h => h.id !== id))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
      {/* Portfolio hero */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px', background: 'var(--bg)', boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent-grad)' }} />
        <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Portfolio value</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', marginTop: 2 }}>{fmtMoney(totals.value)}</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: totals.gain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          <i className={`ti ${totals.gain >= 0 ? 'ti-trending-up' : 'ti-trending-down'}`} /> {fmtMoney(totals.gain)} ({fmtPct(totals.pct)})
          <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · cost {fmtMoney(totals.cost)}</span>
        </div>
      </div>

      {/* Allocation bar */}
      {holdings.length > 0 && totals.value > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 10 }}>Allocation</div>
          <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            {holdings.map((h, i) => {
              const v = Number(h.quantity) * Number(h.current_price)
              const pct = (v / totals.value) * 100
              const hue = (i * 47) % 360
              return <div key={h.id} title={`${h.ticker || h.name} ${pct.toFixed(1)}%`} style={{ width: `${pct}%`, background: `hsl(${hue} 70% 55%)`, transition: 'width 0.7s var(--ease-out)' }} />
            })}
          </div>
        </div>
      )}

      {/* Add holding */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input placeholder="Name (e.g. Apple)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...inp, flex: '2 1 140px' }} />
          <input placeholder="Ticker" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} style={{ ...inp, flex: '1 1 80px' }} />
          <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} style={{ ...inp, flex: '1 1 90px' }}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="number" inputMode="decimal" placeholder="Quantity" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={{ ...inp, flex: '1 1 90px' }} />
          <input type="number" inputMode="decimal" placeholder="Avg cost / unit" value={form.cost_basis} onChange={e => setForm(f => ({ ...f, cost_basis: e.target.value }))} style={{ ...inp, flex: '1 1 110px' }} />
          <input type="number" inputMode="decimal" placeholder="Current price" value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} style={{ ...inp, flex: '1 1 110px' }} />
          <button onClick={addHolding} disabled={adding || !form.name.trim() || !parseFloat(form.quantity)} style={{
            border: 'none', borderRadius: 8, padding: '0 16px', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600,
            cursor: (adding || !form.name.trim() || !parseFloat(form.quantity)) ? 'default' : 'pointer', opacity: (adding || !form.name.trim() || !parseFloat(form.quantity)) ? 0.5 : 1,
          }}>Add</button>
        </div>
      </div>

      {/* Holdings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {holdings.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 12 }}>No holdings yet. Add one above to track your portfolio.</div>}
        {holdings.map(h => {
          const value = Number(h.quantity) * Number(h.current_price)
          const cost = Number(h.quantity) * Number(h.cost_basis)
          const gain = value - cost
          const pct = cost > 0 ? (gain / cost) * 100 : 0
          return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.ticker || h.name} <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12 }}>{h.ticker ? h.name : h.kind}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {Number(h.quantity)} @ {fmtMoney(h.cost_basis)} →{' '}
                  {editId === h.id ? (
                    <input autoFocus value={editPrice} onChange={e => setEditPrice(e.target.value)} onBlur={() => savePrice(h.id)} onKeyDown={e => e.key === 'Enter' && savePrice(h.id)}
                      type="number" style={{ width: 74, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 5px', fontSize: 11.5, background: 'var(--bg)', color: 'var(--text)' }} />
                  ) : (
                    <button onClick={() => { setEditId(h.id); setEditPrice(String(h.current_price)) }} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11.5, padding: 0, textDecoration: 'underline' }}>{fmtMoney(h.current_price)}</button>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtMoney(value)}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: gain >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtPct(pct)}</div>
              </div>
              <button onClick={() => deleteHolding(h.id)} title="Delete" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 15, padding: 6 }}><i className="ti ti-x" /></button>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
        Prices are entered manually — tap any current price to update it. This tracker is for your own record-keeping, not financial advice.
      </div>
    </div>
  )
}

const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }
