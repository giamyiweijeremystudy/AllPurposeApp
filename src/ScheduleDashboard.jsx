import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { getEventsForRange, isSameDay, addDays, formatTime } from './calendarUtils.js'
import { EventModal } from './EventModal.jsx'

function pad(n) { return String(n).padStart(2,'0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export function ScheduleDashboard({ appId, onSwitchTab }) {
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventModal, setEventModal] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const today = new Date()
  const tomorrow = addDays(today, 1)

  useEffect(() => {
    if (!appId) return
    const rangeStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const rangeEnd = addDays(today, 30)

    Promise.all([
      supabase.from('events').select('*, event_categories(id,name,color)').eq('app_id', appId),
      supabase.from('tasks').select('*').eq('app_id', appId).eq('completed', false).order('sort_order'),
      supabase.from('event_categories').select('*').eq('app_id', appId),
    ]).then(([{ data: evs }, { data: tks }, { data: cats }]) => {
      setEvents(evs || [])
      setTasks(tks || [])
      setCategories(cats || [])
      setLoading(false)
    })
  }, [appId])

  const todayEvents = getEventsForRange(events, today, addDays(today, 1))
    .filter(e => isSameDay(new Date(e.start_at), today))
    .sort((a,b) => new Date(a.start_at) - new Date(b.start_at))

  const tomorrowEvents = getEventsForRange(events, tomorrow, addDays(tomorrow, 1))
    .filter(e => isSameDay(new Date(e.start_at), tomorrow))
    .sort((a,b) => new Date(a.start_at) - new Date(b.start_at))

  const upcomingTasks = tasks.filter(t => !t.completed).slice(0, 5)
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < todayStr() && !t.completed)

  const getColor = (ev) => {
    if (ev._isHoliday) return '#6b7280'
    if (ev.color) return ev.color
    const cat = ev.event_categories
    return cat?.color || '#4f46e5'
  }

  const handleSaveEvent = async (payload, editId) => {
    if (editId) {
      const { data } = await supabase.from('events').update(payload).eq('id', editId).select('*, event_categories(id,name,color)').single()
      setEvents(prev => prev.map(e => e.id === editId ? data : e))
    } else {
      const { data } = await supabase.from('events').insert({ app_id: appId, ...payload }).select('*, event_categories(id,name,color)').single()
      setEvents(prev => [...prev, data])
    }
  }

  const handleDeleteEvent = async (id) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const addQuickTask = async () => {
    if (!newTaskTitle.trim()) return
    const { data } = await supabase.from('tasks').insert({ app_id: appId, title: newTaskTitle.trim(), sort_order: tasks.length }).select().single()
    setTasks(prev => [...prev, data])
    setNewTaskTitle('')
  }

  const completeTask = async (id) => {
    await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, color:'var(--text-3)' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:22 }} />
    </div>
  )

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = today.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' })

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:22, fontWeight:600, color:'var(--text)' }}>{greeting}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{dateLabel}</div>
      </div>

      {/* Summary row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
        {[
          { label:'Today', value: todayEvents.length, icon:'ti-calendar-event', color:'var(--accent)' },
          { label:'Tomorrow', value: tomorrowEvents.length, icon:'ti-calendar', color:'#16a34a' },
          { label:'Pending tasks', value: upcomingTasks.length, icon:'ti-checkbox', color:'#d97706' },
          { label:'Overdue', value: overdueTasks.length, icon:'ti-alert-circle', color: overdueTasks.length ? 'var(--danger)' : 'var(--text-3)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background:'var(--bg-2)', borderRadius:'var(--radius-lg)', padding:'14px 16px', border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <i className={`ti ${icon}`} style={{ fontSize:16, color }} />
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Today's events */}
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontWeight:600, fontSize:13 }}>Today's events</span>
            <button onClick={() => onSwitchTab('calendar')} style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>View calendar →</button>
          </div>
          {todayEvents.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>No events today</div>
          ) : (
            todayEvents.map(ev => (
              <EventRow key={ev.id} ev={ev} color={getColor(ev)} onClick={() => !ev._isHoliday && setEventModal({ event: ev })} />
            ))
          )}
          <button onClick={() => setEventModal({})} style={{
            marginTop:10, width:'100%', padding:'7px', border:'1px dashed var(--border-2)', borderRadius:'var(--radius)',
            background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit',
          }}>+ Add event</button>
        </div>

        {/* Tomorrow's events */}
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontWeight:600, fontSize:13 }}>Tomorrow</span>
            <span style={{ fontSize:11, color:'var(--text-3)' }}>{tomorrow.toLocaleDateString([], { weekday:'long' })}</span>
          </div>
          {tomorrowEvents.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>No events tomorrow</div>
          ) : (
            tomorrowEvents.map(ev => (
              <EventRow key={ev.id} ev={ev} color={getColor(ev)} onClick={() => !ev._isHoliday && setEventModal({ event: ev })} />
            ))
          )}
        </div>
      </div>

      {/* Quick task add + pending tasks */}
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontWeight:600, fontSize:13 }}>Quick tasks</span>
          <button onClick={() => onSwitchTab('tasks')} style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>View all →</button>
        </div>

        {/* Quick add */}
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addQuickTask()}
            placeholder="Add a task…"
            style={{ flex:1, padding:'7px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit' }}
          />
          <button onClick={addQuickTask} style={{ padding:'7px 14px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>Add</button>
        </div>

        {upcomingTasks.length === 0 ? (
          <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'8px 0' }}>No pending tasks</div>
        ) : (
          upcomingTasks.map(task => (
            <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
              <button onClick={() => completeTask(task.id)} style={{
                width:18, height:18, borderRadius:'50%', border:'2px solid var(--border-2)',
                background:'transparent', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-2)'; e.currentTarget.style.background='transparent' }}
              />
              <span style={{ flex:1, fontSize:13, color:'var(--text)' }}>{task.title}</span>
              {task.due_date && (
                <span style={{ fontSize:11, color: task.due_date < todayStr() ? 'var(--danger)' : 'var(--text-3)', flexShrink:0 }}>
                  {new Date(task.due_date + 'T00:00:00').toLocaleDateString([], { month:'short', day:'numeric' })}
                </span>
              )}
              <PriorityBadge priority={task.priority} />
            </div>
          ))
        )}
      </div>

      {eventModal !== null && (
        <EventModal
          event={eventModal.event}
          categories={categories}
          appId={appId}
          onClose={() => setEventModal(null)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  )
}

function EventRow({ ev, color, onClick }) {
  const start = new Date(ev.start_at)
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'7px 0',
      borderBottom:'1px solid var(--border)', cursor: ev._isHoliday ? 'default' : 'pointer',
    }}
      onMouseEnter={e => { if (!ev._isHoliday) e.currentTarget.style.opacity='0.75' }}
      onMouseLeave={e => e.currentTarget.style.opacity='1'}
    >
      <span style={{ width:3, height:32, borderRadius:2, background:color, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
        <div style={{ fontSize:11, color:'var(--text-3)' }}>
          {ev.all_day ? 'All day' : `${formatTime(start)}${ev.location ? ` · ${ev.location}` : ''}`}
        </div>
      </div>
    </div>
  )
}

function PriorityBadge({ priority }) {
  const styles = {
    high:   { bg:'#fef2f2', color:'#dc2626', label:'High' },
    medium: { bg:'#fffbeb', color:'#d97706', label:'Med' },
    low:    { bg:'#f0fdf4', color:'#16a34a', label:'Low' },
  }
  const s = styles[priority] || styles.medium
  return (
    <span style={{ fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:4, background:s.bg, color:s.color, flexShrink:0 }}>{s.label}</span>
  )
}
