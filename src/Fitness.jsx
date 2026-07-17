import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'
import { FitnessActivities } from './FitnessActivities.jsx'
import { FitnessGear } from './FitnessGear.jsx'
import { FitnessCoach } from './FitnessCoach.jsx'
import { fmtKm, fmtDur } from './fitnessUtils.js'

export const EXERCISES = [
  { id: 'pushups', label: 'Push-ups', icon: 'ti-hand-stop', fields: ['sets', 'reps'] },
  { id: 'situps', label: 'Sit-ups', icon: 'ti-seedling', fields: ['sets', 'reps'] },
  { id: 'pullups', label: 'Pull-ups', icon: 'ti-arrow-bar-up', fields: ['sets', 'reps'] },
  { id: 'running', label: 'Running', icon: 'ti-run', fields: ['distance_km', 'duration_min'] },
  { id: 'cycling', label: 'Cycling', icon: 'ti-bike', fields: ['distance_km', 'duration_min'] },
  { id: 'strength', label: 'Strength', icon: 'ti-barbell', fields: ['custom_name', 'sets', 'reps', 'weight_kg'] },
  { id: 'custom', label: 'Custom', icon: 'ti-star', fields: ['custom_name', 'sets', 'reps', 'weight_kg', 'duration_min', 'distance_km'] },
]
const exMeta = id => EXERCISES.find(e => e.id === id) || EXERCISES[6]

function pad(n) { return String(n).padStart(2, '0') }
function dstr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { id: 'activities', label: 'Activities', icon: 'ti-route' },
  { id: 'gear', label: 'Gear', icon: 'ti-shoe' },
  { id: 'coach', label: 'AI Coach', icon: 'ti-sparkles' },
]

export function Fitness({ appId, userId }) {
  const [tab, setTab] = useState('dashboard')
  const [workouts, setWorkouts] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [logModal, setLogModal] = useState(null) // null | {} | {...workout}

  const reload = async () => {
    const [w, a] = await Promise.all([
      supabase.from('workouts').select('*').eq('app_id', appId).eq('user_id', userId).order('performed_at', { ascending: false }).limit(1000),
      supabase.from('fitness_activities').select('id,source,strava_id,name,type,start_at,distance_km,moving_sec,elapsed_sec,elevation_m,avg_speed_kmh,avg_hr,calories,shoe_id,bike_id,notes,gpx').eq('app_id', appId).eq('user_id', userId).order('start_at', { ascending: false }).limit(500),
    ])
    setWorkouts(w.data || [])
    setActivities(a.data || [])
    setLoading(false)
  }
  useEffect(() => { if (appId && userId) reload() }, [appId, userId])

  if (loading) return <FitnessSkeleton />

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 24 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', borderRadius: 12, padding: 4, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 9,
            padding: '9px 10px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t.id ? 'var(--bg)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-3)',
            boxShadow: tab === t.id ? 'var(--shadow)' : 'none',
          }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard workouts={workouts} activities={activities} onLog={ex => setLogModal({ exercise: ex })} onEdit={w => setLogModal(w)} />}
      {tab === 'activities' && <FitnessActivities appId={appId} userId={userId} activities={activities} onChanged={reload} />}
      {tab === 'gear' && <FitnessGear appId={appId} userId={userId} activities={activities} onChanged={reload} />}
      {tab === 'coach' && <FitnessCoach appId={appId} userId={userId} workouts={workouts} activities={activities} onChanged={reload} />}

      {logModal && (
        <LogModal
          appId={appId} userId={userId} initial={logModal}
          onClose={() => setLogModal(null)}
          onSaved={() => { setLogModal(null); reload() }}
        />
      )}
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────
function Dashboard({ workouts, activities, onLog, onEdit }) {
  const today = dstr(new Date())
  const stats = useMemo(() => computeStats(workouts, activities), [workouts, activities])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Streak + week summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <StatCard kicker="Streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} icon="ti-flame" tone={stats.streak > 0 ? 'warn' : undefined} />
        <StatCard kicker="This week" value={`${stats.week.count} workouts`} sub={`${fmtDur(stats.week.sec)} · ${stats.week.km.toFixed(1)} km`} icon="ti-calendar-week" />
        <StatCard kicker="This month" value={`${stats.month.count} workouts`} sub={`${fmtDur(stats.month.sec)} · ${stats.month.km.toFixed(1)} km`} icon="ti-calendar-month" />
        <StatCard kicker="This year" value={`${stats.year.count} workouts`} sub={`${fmtDur(stats.year.sec)} · ${stats.year.km.toFixed(1)} km`} icon="ti-calendar" />
      </div>

      {/* Weekly activity chart */}
      <WeeklyChart workouts={workouts} activities={activities} />

      {/* Exercise cards */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 10 }}>Log an exercise</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {EXERCISES.map(ex => {
            const pb = stats.pbs[ex.id]
            return (
              <button key={ex.id} className="module-card" onClick={() => onLog(ex.id)} style={{ padding: '14px 14px 12px' }}>
                <div className="module-kicker"><i className={`ti ${ex.icon}`} style={{ fontSize: 13 }} /> {ex.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {pb ? <><i className="ti ti-trophy" style={{ color: '#f59e0b', fontSize: 12 }} /> {pb}</> : <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>Tap to log</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent logs */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
          Recent workouts
        </div>
        {workouts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>
            No workouts yet.<br />Tap an exercise card above (or the + button) to log your first one.
          </div>
        ) : workouts.slice(0, 12).map(w => {
          const meta = exMeta(w.exercise)
          const bits = []
          if (w.sets && w.reps) bits.push(`${w.sets}×${w.reps}`)
          else if (w.reps) bits.push(`${w.reps} reps`)
          if (w.weight_kg) bits.push(`${Number(w.weight_kg)} kg`)
          if (w.distance_km) bits.push(`${Number(w.distance_km).toFixed(2)} km`)
          if (w.duration_min) bits.push(`${Number(w.duration_min)} min`)
          return (
            <button key={w.id} onClick={() => onEdit(w)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none',
              borderBottom: '1px solid var(--border)', padding: '10px 14px', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
            }}>
              <i className={`ti ${meta.icon}`} style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{w.custom_name || meta.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{new Date(w.performed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{bits.join(' · ') || '—'}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ kicker, value, sub, icon, tone }) {
  return (
    <div className="module-card" style={{ cursor: 'default', padding: '14px 14px 12px' }}>
      <div className="module-kicker"><i className={`ti ${icon}`} style={{ fontSize: 13, color: tone === 'warn' ? '#f97316' : undefined }} /> {kicker}</div>
      <div className="module-value" style={{ fontSize: 19 }}>{value}</div>
      {sub && <div className="module-sub">{sub}</div>}
    </div>
  )
}

// Last 7 days: minutes of activity per day
function WeeklyChart({ workouts, activities }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t) }, [])
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.push({ key: dstr(d), label: d.toLocaleDateString([], { weekday: 'narrow' }), min: 0 })
  }
  for (const w of workouts) {
    const b = days.find(x => x.key === dstr(new Date(w.performed_at)))
    if (b) b.min += Number(w.duration_min) || 15 // assume ~15 min for rep-only logs
  }
  for (const a of activities) {
    const b = days.find(x => x.key === dstr(new Date(a.start_at)))
    if (b && a.moving_sec) b.min += a.moving_sec / 60
  }
  const max = Math.max(30, ...days.map(d => d.min))
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>Active minutes — last 7 days</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
        {days.map((d, i) => (
          <div key={d.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, opacity: d.min > 0 ? 1 : 0 }}>{Math.round(d.min)}</div>
            <div style={{
              width: '100%', maxWidth: 38, borderRadius: '6px 6px 0 0',
              height: mounted ? `${(d.min / max) * 100}%` : '0%', minHeight: d.min > 0 ? 4 : 0,
              background: 'var(--accent-grad)', transition: `height 0.6s var(--ease-out) ${i * 0.05}s`,
            }} />
            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Streaks, weekly/monthly/yearly stats, PB strings per exercise
function computeStats(workouts, activities) {
  const daysWithActivity = new Set([
    ...workouts.map(w => dstr(new Date(w.performed_at))),
    ...activities.map(a => dstr(new Date(a.start_at))),
  ])
  let streak = 0
  const d = new Date()
  if (!daysWithActivity.has(dstr(d))) d.setDate(d.getDate() - 1)
  while (daysWithActivity.has(dstr(d))) { streak++; d.setDate(d.getDate() - 1) }

  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const bucket = () => ({ count: 0, sec: 0, km: 0 })
  const week = bucket(), month = bucket(), year = bucket()
  const addTo = (b, sec, km) => { b.count++; b.sec += sec; b.km += km }
  for (const w of workouts) {
    const t = new Date(w.performed_at)
    const sec = (Number(w.duration_min) || 0) * 60, km = Number(w.distance_km) || 0
    if (t >= weekStart) addTo(week, sec, km)
    if (t >= monthStart) addTo(month, sec, km)
    if (t >= yearStart) addTo(year, sec, km)
  }
  for (const a of activities) {
    const t = new Date(a.start_at)
    const sec = a.moving_sec || 0, km = Number(a.distance_km) || 0
    if (t >= weekStart) addTo(week, sec, km)
    if (t >= monthStart) addTo(month, sec, km)
    if (t >= yearStart) addTo(year, sec, km)
  }

  // Personal bests
  const pbs = {}
  const best = (arr, fn) => arr.reduce((m, x) => Math.max(m, fn(x) || 0), 0)
  const of = ex => workouts.filter(w => w.exercise === ex)
  const repPB = ex => { const b = best(of(ex), w => w.reps); return b > 0 ? `${b} reps` : null }
  pbs.pushups = repPB('pushups'); pbs.situps = repPB('situps'); pbs.pullups = repPB('pullups')
  const runs = [...of('running'), ...activities.filter(a => /run/i.test(a.type)).map(a => ({ distance_km: a.distance_km }))]
  const rides = [...of('cycling'), ...activities.filter(a => /ride|bike|cycl/i.test(a.type)).map(a => ({ distance_km: a.distance_km }))]
  const runBest = best(runs, r => Number(r.distance_km))
  const rideBest = best(rides, r => Number(r.distance_km))
  if (runBest > 0) pbs.running = `${runBest.toFixed(1)} km`
  if (rideBest > 0) pbs.cycling = `${rideBest.toFixed(1)} km`
  const strBest = best(of('strength'), w => Number(w.weight_kg))
  if (strBest > 0) pbs.strength = `${strBest} kg`
  return { streak, week, month, year, pbs }
}

// ── Log / edit modal ─────────────────────────────────────────
function LogModal({ appId, userId, initial, onClose, onSaved }) {
  const isEdit = !!initial.id
  const [ex, setEx] = useState(initial.exercise || 'pushups')
  const meta = exMeta(ex)
  const nowLocal = () => {
    const d = initial.performed_at ? new Date(initial.performed_at) : new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [data, setData] = useState({
    custom_name: initial.custom_name || '', sets: initial.sets ?? '', reps: initial.reps ?? '',
    weight_kg: initial.weight_kg ?? '', duration_min: initial.duration_min ?? '', distance_km: initial.distance_km ?? '',
    performed_at: nowLocal(), notes: initial.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))
  const num = v => v === '' || v == null ? null : Number(v)

  const save = async () => {
    setSaving(true)
    const payload = {
      exercise: ex, custom_name: data.custom_name.trim(),
      sets: num(data.sets), reps: num(data.reps), weight_kg: num(data.weight_kg),
      duration_min: num(data.duration_min), distance_km: num(data.distance_km),
      performed_at: new Date(data.performed_at).toISOString(), notes: data.notes.trim(),
    }
    const q = isEdit
      ? supabase.from('workouts').update(payload).eq('id', initial.id)
      : supabase.from('workouts').insert({ app_id: appId, user_id: userId, ...payload })
    const { error } = await q
    setSaving(false)
    if (!error) onSaved()
  }
  const del = async () => {
    await supabase.from('workouts').delete().eq('id', initial.id)
    onSaved()
  }

  const fieldDefs = {
    custom_name: { label: 'Exercise name', type: 'text' },
    sets: { label: 'Sets', type: 'number' },
    reps: { label: 'Reps', type: 'number' },
    weight_kg: { label: 'Weight (kg)', type: 'number' },
    duration_min: { label: 'Duration (min)', type: 'number' },
    distance_km: { label: 'Distance (km)', type: 'number' },
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)',
        padding: 18, boxShadow: 'var(--shadow-lg)', animation: 'module-enter 0.22s var(--ease-out)', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>{isEdit ? 'Edit workout' : 'Log workout'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer' }}><i className="ti ti-x" /></button>
        </div>

        <select value={ex} onChange={e => setEx(e.target.value)} style={inp}>
          {EXERCISES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {meta.fields.map(f => (
            <input key={f} type={fieldDefs[f].type} inputMode={fieldDefs[f].type === 'number' ? 'decimal' : undefined}
              placeholder={fieldDefs[f].label} value={data[f]}
              onChange={e => set(f, e.target.value)}
              style={{ ...inp, gridColumn: f === 'custom_name' ? '1 / -1' : undefined }} />
          ))}
        </div>

        <input type="datetime-local" value={data.performed_at} onChange={e => set('performed_at', e.target.value)} style={inp} />
        <textarea placeholder="Notes (optional)" value={data.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} />

        {confirmingDelete ? (
          <div style={{ border: '1px solid var(--danger)', borderRadius: 8, padding: 10, background: 'var(--danger-bg)', fontSize: 12.5 }}>
            <div style={{ marginBottom: 8 }}>Delete this workout?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={del} style={{ border: 'none', borderRadius: 7, padding: '7px 12px', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setConfirmingDelete(false)} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {isEdit && (
              <button onClick={() => setConfirmingDelete(true)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 15 }}>
                <i className="ti ti-trash" />
              </button>
            )}
            <button onClick={onClose} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '9px 0', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FitnessSkeleton() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[44, 90, 160, 220].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 14, background: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)', backgroundSize: '200% 100%', animation: 'rail-sweep 1.4s linear infinite' }} />
      ))}
    </div>
  )
}

const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }
