import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase.js'

function pad(n) { return String(n).padStart(2, '0') }
function dstr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function lastNDays(n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    out.push(dstr(d))
  }
  return out
}
function streakOf(dates) {
  // Count consecutive days ending today (or yesterday, so a streak isn't
  // "broken" before the day is over).
  const set = new Set(dates)
  let streak = 0
  const d = new Date()
  if (!set.has(dstr(d))) d.setDate(d.getDate() - 1)
  while (set.has(dstr(d))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

export function Habits({ appId, userId }) {
  const [habits, setHabits] = useState([])
  const [checks, setChecks] = useState([]) // { habit_id, check_date }
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const days = useMemo(() => lastNDays(7), [])
  const today = days[days.length - 1]

  useEffect(() => {
    if (!appId || !userId) return
    Promise.all([
      supabase.from('habits').select('*').eq('app_id', appId).eq('user_id', userId).order('created_at'),
      supabase.from('habit_checks').select('habit_id,check_date').eq('user_id', userId),
    ]).then(([h, c]) => {
      setHabits(h.data || [])
      setChecks(c.data || [])
      setLoading(false)
    })
  }, [appId, userId])

  const addHabit = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase.from('habits').insert({
      app_id: appId, user_id: userId, name: newName.trim(),
    }).select().single()
    if (error) return
    setHabits(prev => [...prev, data])
    setNewName('')
  }

  const deleteHabit = async (id) => {
    if (!confirm('Delete this habit and its history?')) return
    await supabase.from('habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setChecks(prev => prev.filter(c => c.habit_id !== id))
  }

  const toggleCheck = async (habitId, date) => {
    const existing = checks.find(c => c.habit_id === habitId && c.check_date === date)
    if (existing) {
      setChecks(prev => prev.filter(c => !(c.habit_id === habitId && c.check_date === date)))
      await supabase.from('habit_checks').delete().eq('habit_id', habitId).eq('check_date', date)
    } else {
      setChecks(prev => [...prev, { habit_id: habitId, check_date: date }])
      await supabase.from('habit_checks').insert({ habit_id: habitId, user_id: userId, check_date: date })
    }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      {/* Add habit */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addHabit()}
          placeholder="New habit (e.g. Read 20 minutes)…"
          style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }}
        />
        <button onClick={addHabit} disabled={!newName.trim()} style={{
          border: 'none', borderRadius: 10, padding: '0 16px', background: 'var(--accent)', color: '#fff',
          fontSize: 13.5, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'default', opacity: newName.trim() ? 1 : 0.5,
        }}>Add</button>
      </div>

      {habits.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 16 }}>
          No habits yet — add one above to start tracking.
        </div>
      )}

      {habits.map(h => {
        const habitDates = checks.filter(c => c.habit_id === h.id).map(c => c.check_date)
        const streak = streakOf(habitDates)
        return (
          <div key={h.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {streak > 0 ? <><i className="ti ti-flame" style={{ color: '#f97316' }} /> {streak}-day streak</> : 'No current streak'}
                </div>
              </div>
              <button onClick={() => deleteHabit(h.id)} title="Delete habit" style={{
                border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 15, padding: 6,
              }}>
                <i className="ti ti-trash" />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
              {days.map(d => {
                const done = habitDates.includes(d)
                const dayNum = d.slice(8)
                const isToday = d === today
                return (
                  <button key={d} onClick={() => toggleCheck(h.id, d)} style={{
                    flex: 1, maxWidth: 64, aspectRatio: '1', borderRadius: 10, cursor: 'pointer',
                    border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: done ? 'var(--accent)' : 'transparent',
                    color: done ? '#fff' : 'var(--text-3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, gap: 2, minHeight: 44,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{dayNum}</span>
                    {done && <i className="ti ti-check" style={{ fontSize: 12 }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
