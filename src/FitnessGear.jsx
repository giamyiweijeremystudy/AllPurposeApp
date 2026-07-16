import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'
import { fmtDur } from './fitnessUtils.js'

const SHOE_TYPES = ['Road', 'Trail', 'Racing', 'Walking', 'Other']
const MAINT_ITEMS = ['Chain', 'Brakes', 'Tires', 'Drivetrain', 'Suspension']

export function FitnessGear({ appId, userId, activities, onChanged }) {
  const [shoes, setShoes] = useState([])
  const [bikes, setBikes] = useState([])
  const [maint, setMaint] = useState([])
  const [loading, setLoading] = useState(true)
  const [shoeModal, setShoeModal] = useState(null)
  const [bikeModal, setBikeModal] = useState(null)
  const [maintModal, setMaintModal] = useState(null) // { bike }

  const load = async () => {
    const [s, b, m] = await Promise.all([
      supabase.from('shoes').select('*').eq('app_id', appId).eq('user_id', userId).order('created_at'),
      supabase.from('bikes').select('*').eq('app_id', appId).eq('user_id', userId).order('created_at'),
      supabase.from('bike_maintenance').select('*').eq('user_id', userId).order('done_at', { ascending: false }),
    ])
    setShoes(s.data || []); setBikes(b.data || []); setMaint(m.data || []); setLoading(false)
  }
  useEffect(() => { if (appId && userId) load() }, [appId, userId])

  // Mileage per shoe / bike from linked activities
  const shoeKm = useMemo(() => {
    const map = {}
    for (const a of activities) if (a.shoe_id && a.distance_km) map[a.shoe_id] = (map[a.shoe_id] || 0) + Number(a.distance_km)
    return map
  }, [activities])
  const bikeStats = useMemo(() => {
    const map = {}
    for (const a of activities) {
      if (!a.bike_id) continue
      const s = map[a.bike_id] || { km: 0, sec: 0, rides: 0, last: null }
      s.km += Number(a.distance_km) || 0
      s.sec += a.moving_sec || 0
      s.rides++
      if (!s.last || new Date(a.start_at) > new Date(s.last)) s.last = a.start_at
      map[a.bike_id] = s
    }
    return map
  }, [activities])

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 20 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Shoes ── */}
      <section>
        <SectionHeader icon="ti-shoe" title="Shoes" onAdd={() => setShoeModal({})} />
        {shoes.length === 0 && <Empty text="Add your running shoes to track their mileage automatically from linked runs." />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shoes.map(s => {
            const km = shoeKm[s.id] || 0
            const pct = Math.min(100, (km / Number(s.lifespan_km || 700)) * 100)
            const remaining = Math.max(0, Number(s.lifespan_km || 700) - km)
            return (
              <button key={s.id} className="module-card" onClick={() => setShoeModal(s)} style={{ padding: 14, textAlign: 'left', opacity: s.retired ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                      {[s.brand, s.model].filter(Boolean).join(' ') || 'Unnamed shoe'}
                      {s.retired && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--bg-3)', color: 'var(--text-3)', borderRadius: 5, padding: '2px 6px', fontWeight: 600 }}>RETIRED</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.shoe_type}{s.purchase_date ? ` · since ${s.purchase_date}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{km.toFixed(0)} km</div>
                    <div style={{ fontSize: 10.5, color: pct >= 90 ? 'var(--danger)' : 'var(--text-3)' }}>
                      {pct >= 100 ? 'Replace recommended' : `${remaining.toFixed(0)} km left`}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', transition: 'width 0.6s var(--ease-out)',
                    background: pct >= 90 ? 'var(--danger)' : pct >= 70 ? '#f59e0b' : 'var(--accent-grad)',
                  }} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Bikes ── */}
      <section>
        <SectionHeader icon="ti-bike" title="Bikes" onAdd={() => setBikeModal({})} />
        {bikes.length === 0 && <Empty text="Add a bike to track mileage, ride time, and maintenance." />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bikes.map(b => {
            const st = bikeStats[b.id] || { km: 0, sec: 0, rides: 0, last: null }
            const bMaint = maint.filter(m => m.bike_id === b.id)
            const due = bMaint.filter(m => isMaintDue(m, st.km)).length
            return (
              <div key={b.id} className="module-card" style={{ padding: 14, cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{[b.brand, b.model].filter(Boolean).join(' ') || 'Unnamed bike'}{b.year ? ` (${b.year})` : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      {st.rides} rides · {st.km.toFixed(0)} km · {fmtDur(st.sec)}
                      {st.last && ` · last ${new Date(st.last).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                    </div>
                  </div>
                  <button onClick={() => setMaintModal({ bike: b, stats: st })} style={{
                    position: 'relative', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
                    background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <i className="ti ti-tool" /> Maintenance
                    {due > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--danger)', color: '#fff', borderRadius: 9, minWidth: 17, height: 17, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{due}</span>}
                  </button>
                  <button onClick={() => setBikeModal(b)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 12.5, cursor: 'pointer' }}>
                    <i className="ti ti-pencil" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {shoeModal && <GearModal kind="shoe" appId={appId} userId={userId} initial={shoeModal} onClose={() => setShoeModal(null)} onSaved={() => { setShoeModal(null); load(); onChanged() }} />}
      {bikeModal && <GearModal kind="bike" appId={appId} userId={userId} initial={bikeModal} onClose={() => setBikeModal(null)} onSaved={() => { setBikeModal(null); load(); onChanged() }} />}
      {maintModal && <MaintenanceModal bike={maintModal.bike} stats={maintModal.stats} userId={userId} entries={maint.filter(m => m.bike_id === maintModal.bike.id)} onClose={() => setMaintModal(null)} onSaved={load} />}
    </div>
  )
}

function isMaintDue(m, currentKm) {
  if (m.interval_km && m.mileage_at_km != null && currentKm - Number(m.mileage_at_km) >= Number(m.interval_km)) return true
  if (m.interval_days && (Date.now() - new Date(m.done_at)) / 864e5 >= m.interval_days) return true
  return false
}

function SectionHeader({ icon, title, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, flex: 1 }}>
        <i className={`ti ${icon}`} /> {title}
      </div>
      <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', borderRadius: 8, padding: '6px 11px', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        <i className="ti ti-plus" /> Add
      </button>
    </div>
  )
}
function Empty({ text }) {
  return <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.6, border: '1px dashed var(--border-2)', borderRadius: 12, marginBottom: 8 }}>{text}</div>
}

// ── Shared add/edit modal for shoes and bikes ────────────────
function GearModal({ kind, appId, userId, initial, onClose, onSaved }) {
  const isEdit = !!initial.id
  const isShoe = kind === 'shoe'
  const [d, setD] = useState(isShoe ? {
    brand: initial.brand || '', model: initial.model || '', shoe_type: initial.shoe_type || 'Road',
    purchase_date: initial.purchase_date || '', price: initial.price ?? '', lifespan_km: initial.lifespan_km ?? 700,
    notes: initial.notes || '', retired: initial.retired || false,
  } : {
    brand: initial.brand || '', model: initial.model || '', year: initial.year ?? '', weight_kg: initial.weight_kg ?? '',
    wheel_size: initial.wheel_size || '', notes: initial.notes || '',
  })
  const [confirming, setConfirming] = useState(false)
  const set = (k, v) => setD(x => ({ ...x, [k]: v }))
  const table = isShoe ? 'shoes' : 'bikes'
  const num = v => v === '' || v == null ? null : Number(v)

  const save = async () => {
    const payload = isShoe
      ? { brand: d.brand.trim(), model: d.model.trim(), shoe_type: d.shoe_type, purchase_date: d.purchase_date || null, price: num(d.price), lifespan_km: num(d.lifespan_km) || 700, notes: d.notes.trim(), retired: d.retired }
      : { brand: d.brand.trim(), model: d.model.trim(), year: num(d.year), weight_kg: num(d.weight_kg), wheel_size: d.wheel_size.trim(), notes: d.notes.trim() }
    const q = isEdit ? supabase.from(table).update(payload).eq('id', initial.id) : supabase.from(table).insert({ app_id: appId, user_id: userId, ...payload })
    const { error } = await q
    if (!error) onSaved()
  }
  const del = async () => { await supabase.from(table).delete().eq('id', initial.id); onSaved() }

  return (
    <Modal title={`${isEdit ? 'Edit' : 'Add'} ${isShoe ? 'shoe' : 'bike'}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input placeholder="Brand" value={d.brand} onChange={e => set('brand', e.target.value)} style={inp} />
        <input placeholder="Model" value={d.model} onChange={e => set('model', e.target.value)} style={inp} />
        {isShoe ? (
          <>
            <select value={d.shoe_type} onChange={e => set('shoe_type', e.target.value)} style={inp}>
              {SHOE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={d.purchase_date} onChange={e => set('purchase_date', e.target.value)} style={inp} />
            <input type="number" placeholder="Price" value={d.price} onChange={e => set('price', e.target.value)} style={inp} />
            <input type="number" placeholder="Lifespan (km)" value={d.lifespan_km} onChange={e => set('lifespan_km', e.target.value)} style={inp} />
          </>
        ) : (
          <>
            <input type="number" placeholder="Year" value={d.year} onChange={e => set('year', e.target.value)} style={inp} />
            <input type="number" placeholder="Weight (kg)" value={d.weight_kg} onChange={e => set('weight_kg', e.target.value)} style={inp} />
            <input placeholder="Wheel size" value={d.wheel_size} onChange={e => set('wheel_size', e.target.value)} style={{ ...inp, gridColumn: '1 / -1' }} />
          </>
        )}
      </div>
      <textarea placeholder="Notes" value={d.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} />
      {isShoe && isEdit && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.retired} onChange={e => set('retired', e.target.checked)} /> Retired
        </label>
      )}
      <ModalActions isEdit={isEdit} confirming={confirming} setConfirming={setConfirming} onDelete={del} onCancel={onClose} onSave={save} />
    </Modal>
  )
}

// ── Maintenance modal ────────────────────────────────────────
function MaintenanceModal({ bike, stats, userId, entries, onClose, onSaved }) {
  const [item, setItem] = useState('Chain')
  const [customItem, setCustomItem] = useState('')
  const [intervalKm, setIntervalKm] = useState('')
  const [intervalDays, setIntervalDays] = useState('')

  const add = async () => {
    const name = item === 'custom' ? customItem.trim() : item
    if (!name) return
    await supabase.from('bike_maintenance').insert({
      bike_id: bike.id, user_id: userId, item: name,
      mileage_at_km: stats?.km ?? null,
      interval_km: intervalKm ? Number(intervalKm) : null,
      interval_days: intervalDays ? Number(intervalDays) : null,
    })
    setCustomItem(''); setIntervalKm(''); setIntervalDays('')
    onSaved()
  }
  const remove = async (id) => { await supabase.from('bike_maintenance').delete().eq('id', id); onSaved() }

  return (
    <Modal title={`Maintenance — ${[bike.brand, bike.model].filter(Boolean).join(' ') || 'bike'}`} onClose={onClose}>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: -4 }}>Current mileage: {(stats?.km || 0).toFixed(0)} km. Log a service now, optionally with a reminder interval.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select value={item} onChange={e => setItem(e.target.value)} style={{ ...inp, gridColumn: item === 'custom' ? undefined : '1 / -1' }}>
          {MAINT_ITEMS.map(m => <option key={m} value={m}>{m}</option>)}
          <option value="custom">Custom…</option>
        </select>
        {item === 'custom' && <input placeholder="Item name" value={customItem} onChange={e => setCustomItem(e.target.value)} style={inp} />}
        <input type="number" placeholder="Remind every … km" value={intervalKm} onChange={e => setIntervalKm(e.target.value)} style={inp} />
        <input type="number" placeholder="…or every … days" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} style={inp} />
      </div>
      <button onClick={add} style={{ border: 'none', borderRadius: 8, padding: '9px 0', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Log service</button>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {entries.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center' }}>No maintenance logged yet.</div>}
        {entries.map(m => {
          const due = isMaintDue(m, stats?.km || 0)
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <i className={`ti ${due ? 'ti-alert-triangle' : 'ti-circle-check'}`} style={{ color: due ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{m.item}{due && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> — due</span>}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {m.done_at}{m.mileage_at_km != null && ` @ ${Number(m.mileage_at_km).toFixed(0)} km`}
                  {m.interval_km && ` · every ${m.interval_km} km`}{m.interval_days && ` · every ${m.interval_days} days`}
                </div>
              </div>
              <button onClick={() => remove(m.id)} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 4 }}><i className="ti ti-x" /></button>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Shared modal chrome ──────────────────────────────────────
function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)',
        padding: 18, boxShadow: 'var(--shadow-lg)', animation: 'module-enter 0.22s var(--ease-out)', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer' }}><i className="ti ti-x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
function ModalActions({ isEdit, confirming, setConfirming, onDelete, onCancel, onSave }) {
  if (confirming) return (
    <div style={{ border: '1px solid var(--danger)', borderRadius: 8, padding: 10, background: 'var(--danger-bg)', fontSize: 12.5 }}>
      <div style={{ marginBottom: 8 }}>Delete this? This can't be undone.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDelete} style={{ border: 'none', borderRadius: 7, padding: '7px 12px', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
        <button onClick={() => setConfirming(false)} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {isEdit && <button onClick={() => setConfirming(true)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 15 }}><i className="ti ti-trash" /></button>}
      <button onClick={onCancel} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
      <button onClick={onSave} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '9px 0', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
    </div>
  )
}

const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }
