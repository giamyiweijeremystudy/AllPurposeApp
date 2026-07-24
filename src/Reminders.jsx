import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { NotificationsCard } from './NotificationsCard.jsx'

function pad(n) { return String(n).padStart(2, '0') }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const PRIORITY_COLOR = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }

export function Reminders({ appId, userId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [modal, setModal] = useState(null) // null | {} | {...task}

  const reload = () => {
    supabase.from('tasks').select('*').eq('app_id', appId).eq('user_id', userId).order('sort_order')
      .then(({ data }) => { setTasks(data || []); setLoading(false) })
  }
  useEffect(() => { if (appId && userId) reload() }, [appId, userId])

  const today = todayStr()
  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  // Urgent = high priority, regardless of scheduling. Everything else splits
  // by whether it has a due date.
  const urgent = pending.filter(t => t.priority === 'high').sort((a, b) => (a.due_date || '9999') > (b.due_date || '9999') ? 1 : -1)
  const scheduled = pending.filter(t => t.priority !== 'high' && t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const unscheduled = pending.filter(t => t.priority !== 'high' && !t.due_date)

  const saveTask = async (data) => {
    if (!data.title?.trim()) return
    const payload = { title: data.title.trim(), due_date: data.due_date || null, priority: data.priority || 'medium', notes: data.notes?.trim() || '' }
    if (data.id) {
      await supabase.from('tasks').update(payload).eq('id', data.id)
      setTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...payload } : t))
    } else {
      const { data: created } = await supabase.from('tasks').insert({ app_id: appId, user_id: userId, ...payload, sort_order: tasks.length }).select().single()
      if (created) setTasks(prev => [...prev, created])
      if (payload.due_date) {
        await supabase.from('events').insert({
          app_id: appId, title: payload.title, start_at: payload.due_date + 'T00:00:00', end_at: payload.due_date + 'T23:59:59',
          all_day: true, color: PRIORITY_COLOR[payload.priority], description: 'Task due date',
        })
      }
    }
    setModal(null)
  }
  const toggleComplete = async (t) => {
    const completed = !t.completed
    await supabase.from('tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', t.id)
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, completed, completed_at: completed ? new Date().toISOString() : null } : x))
  }
  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setModal(null)
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading…</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>Reminders</div>
        <button onClick={() => setModal({})} style={{
          display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '9px 14px',
          background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-plus" /> New reminder
        </button>
      </div>

      <NotificationsCard appId={appId} userId={userId} />

      <Section title="Urgent" icon="ti-alert-triangle" iconColor="#dc2626" tasks={urgent} today={today} onOpen={setModal} onToggle={toggleComplete}
        empty="Nothing urgent right now." />
      <Section title="Scheduled" icon="ti-calendar-event" iconColor="var(--accent)" tasks={scheduled} today={today} onOpen={setModal} onToggle={toggleComplete}
        empty="No scheduled reminders — tap New reminder and set a due date." />
      <Section title="To-do" icon="ti-list-check" iconColor="var(--text-3)" tasks={unscheduled} today={today} onOpen={setModal} onToggle={toggleComplete}
        empty="Nothing on your unscheduled to-do list." />

      {completed.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowCompleted(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className={`ti ti-chevron-${showCompleted ? 'down' : 'right'}`} /> Completed ({completed.length})
          </button>
          {showCompleted && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg)' }}>
              {completed.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < completed.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <button onClick={() => toggleComplete(t)} style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', background: 'var(--accent)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-check" style={{ fontSize: 10, color: '#fff' }} />
                  </button>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-3)', textDecoration: 'line-through' }}>{t.title}</span>
                  <button onClick={() => deleteTask(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, padding: 2 }}><i className="ti ti-trash" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && <ReminderModal initial={modal} onClose={() => setModal(null)} onSave={saveTask} onDelete={modal.id ? () => deleteTask(modal.id) : null} />}
    </div>
  )
}

function Section({ title, icon, iconColor, tasks, today, onOpen, onToggle, empty }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <i className={`ti ${icon}`} style={{ color: iconColor, fontSize: 14 }} />
        <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{title} {tasks.length > 0 && `(${tasks.length})`}</div>
      </div>
      {tasks.length === 0 ? (
        <div style={{ padding: '14px 16px', color: 'var(--text-3)', fontSize: 12.5, border: '1px dashed var(--border-2)', borderRadius: 10 }}>{empty}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
          {tasks.map((t, i) => {
            const isOverdue = t.due_date && t.due_date < today
            const isToday = t.due_date === today
            const color = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <button onClick={() => onToggle(t)} style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${color}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                <button onClick={() => onOpen(t)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                  {(t.due_date || t.notes) && (
                    <div style={{ fontSize: 11.5, color: isOverdue ? 'var(--danger)' : 'var(--text-3)', marginTop: 2 }}>
                      {t.due_date && (isOverdue ? `Overdue · ${t.due_date}` : isToday ? 'Due today' : `Due ${t.due_date}`)}
                      {t.due_date && t.notes && ' · '}
                      {t.notes && t.notes.slice(0, 50)}
                    </div>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReminderModal({ initial, onClose, onSave, onDelete }) {
  const [data, setData] = useState({ title: initial.title || '', due_date: initial.due_date || '', priority: initial.priority || 'medium', notes: initial.notes || '' })
  const [confirming, setConfirming] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 400, borderRadius: 'var(--radius-lg)', padding: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>{initial.id ? 'Edit reminder' : 'New reminder'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer' }}><i className="ti ti-x" /></button>
        </div>
        <input autoFocus value={data.title} onChange={e => set('title', e.target.value)} placeholder="What do you need to do?"
          onKeyDown={e => e.key === 'Enter' && data.title.trim() && onSave({ ...data, id: initial.id })}
          style={inp} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={data.due_date} onChange={e => set('due_date', e.target.value)} style={{ ...inp, flex: 1 }} />
          <select value={data.priority} onChange={e => set('priority', e.target.value)} style={{ ...inp, flex: 1 }}>
            <option value="high">Urgent</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <textarea value={data.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes (optional)" rows={2} style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} />
        {confirming ? (
          <div style={{ border: '1px solid var(--danger)', borderRadius: 8, padding: 10, background: 'var(--danger-bg)', fontSize: 12.5 }}>
            <div style={{ marginBottom: 8 }}>Delete this reminder?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onDelete} style={{ border: 'none', borderRadius: 7, padding: '7px 12px', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setConfirming(false)} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {onDelete && <button onClick={() => setConfirming(true)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0 12px', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 15 }}><i className="ti ti-trash" /></button>}
            <button onClick={onClose} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => data.title.trim() && onSave({ ...data, id: initial.id })} disabled={!data.title.trim()} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '9px 0', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: data.title.trim() ? 1 : 0.5 }}>Save</button>
          </div>
        )}
      </div>
    </div>
  )
}

const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }
