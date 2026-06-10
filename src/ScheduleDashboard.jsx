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
  const [quickNote, setQuickNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  const today = new Date()
  const tomorrow = addDays(today, 1)

  useEffect(() => {
    if (!appId) return
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

  // Upcoming = next 7 days excluding today (events + timed tasks with due_date)
  const next7Start = addDays(today, 1)
  const next7End = addDays(today, 7)
  const upcomingEvents = getEventsForRange(events, next7Start, next7End)
    .sort((a,b) => new Date(a.start_at) - new Date(b.start_at))

  // Timed tasks = tasks that have a due_date (they show as all-day events on calendar too)
  const timedTasks = tasks.filter(t => t.due_date && t.due_date >= todayStr())
    .sort((a,b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8)

  const pendingTasks = tasks.filter(t => !t.completed).slice(0, 8)
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < todayStr())

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

  const saveQuickNote = async () => {
    if (!quickNote.trim()) return
    const { data } = await supabase.from('tasks').insert({
      app_id: appId, title: quickNote.trim(), sort_order: tasks.length,
    }).select().single()
    setTasks(prev => [...prev, data])
    setQuickNote('')
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 1800)
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
    <div style={{ maxWidth:1000, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:600, color:'var(--text)' }}>{greeting}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{dateLabel}</div>
      </div>

      {/* Summary cards */}
      <div className="dash-summary-grid">
        {[
          { label:'Today', value: todayEvents.length, icon:'ti-calendar-event', color:'var(--accent)' },
          { label:'Tomorrow', value: tomorrowEvents.length, icon:'ti-calendar', color:'#16a34a' },
          { label:'Pending tasks', value: pendingTasks.length, icon:'ti-checkbox', color:'#d97706' },
          { label:'Overdue', value: overdueTasks.length, icon:'ti-alert-circle', color: overdueTasks.length ? 'var(--danger)' : 'var(--text-3)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background:'var(--bg-2)', borderRadius:'var(--radius-lg)', padding:'12px 14px', border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
              <i className={`ti ${icon}`} style={{ fontSize:14, color }} />
              <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
            </div>
            <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Today + Tomorrow row */}
      <div className="dash-today-grid">
        <Panel title="Today's events" action={{ label:'View calendar →', onClick:() => onSwitchTab('calendar') }}>
          {todayEvents.length === 0
            ? <Empty>No events today</Empty>
            : todayEvents.map(ev => <EventRow key={ev.id} ev={ev} color={getColor(ev)} onClick={() => !ev._isHoliday && setEventModal({ event: ev })} />)
          }
          <button onClick={() => setEventModal({})} style={addBtnStyle}>+ Add event</button>
        </Panel>

        <Panel title="Tomorrow" action={{ label: tomorrow.toLocaleDateString([], { weekday:'long' }), plain:true }}>
          {tomorrowEvents.length === 0
            ? <Empty>Nothing scheduled</Empty>
            : tomorrowEvents.map(ev => <EventRow key={ev.id} ev={ev} color={getColor(ev)} onClick={() => !ev._isHoliday && setEventModal({ event: ev })} />)
          }
        </Panel>
      </div>

      {/* Bottom 3-col row */}
      <div className="dash-bottom-grid">

        {/* Quick note */}
        <Panel title="Quick note">
          <textarea
            value={quickNote}
            onChange={e => setQuickNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveQuickNote() } }}
            placeholder="Jot something down…&#10;Press Enter to save"
            style={{
              width:'100%', minHeight:100, padding:'8px 10px',
              border:'1px solid var(--border-2)', borderRadius:'var(--radius)',
              background:'var(--bg)', color:'var(--text)', fontSize:13,
              outline:'none', fontFamily:'inherit', resize:'none',
              lineHeight:1.55,
            }}
          />
          <button onClick={saveQuickNote} style={{
            marginTop:8, width:'100%', padding:'6px',
            background: noteSaved ? 'var(--success)' : 'var(--accent)',
            border:'none', borderRadius:'var(--radius)',
            color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
            transition:'background 0.2s',
          }}>
            {noteSaved ? '✓ Saved as task' : 'Save as task'}
          </button>
        </Panel>

        {/* Tasks */}
        <Panel title="Tasks" action={{ label:'View all →', onClick:() => onSwitchTab('tasks') }}>
          {pendingTasks.length === 0
            ? <Empty>No pending tasks</Empty>
            : pendingTasks.map((task, i) => (
              <div key={task.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 0', borderBottom: i < pendingTasks.length-1 ? '1px solid var(--border)' : 'none' }}>
                <button onClick={() => completeTask(task.id)} style={{
                  width:16, height:16, borderRadius:'50%', flexShrink:0,
                  border:`2px solid ${task.priority==='high' ? 'var(--danger)' : task.priority==='low' ? 'var(--success)' : '#d97706'}`,
                  background:'transparent', cursor:'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity='0.6'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}
                />
                <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                {task.due_date && (
                  <span style={{ fontSize:10, flexShrink:0, color: task.due_date < todayStr() ? 'var(--danger)' : task.due_date === todayStr() ? '#d97706' : 'var(--text-3)' }}>
                    {new Date(task.due_date+'T00:00:00').toLocaleDateString([],{month:'short',day:'numeric'})}
                  </span>
                )}
              </div>
            ))
          }
        </Panel>

        {/* Upcoming — events + timed tasks merged */}
        <Panel title="Upcoming (7 days)" action={{ label:'View calendar →', onClick:() => onSwitchTab('calendar') }}>
          {upcomingEvents.length === 0 && timedTasks.length === 0
            ? <Empty>Nothing coming up</Empty>
            : (() => {
                // merge events and timed tasks into one sorted list
                const combined = [
                  ...upcomingEvents.map(e => ({ type:'event', date: new Date(e.start_at), data:e })),
                  ...timedTasks.map(t => ({ type:'task', date: new Date(t.due_date+'T00:00:00'), data:t })),
                ].sort((a,b) => a.date - b.date).slice(0, 10)

                return combined.map((item, i) => {
                  const isLast = i === combined.length - 1
                  if (item.type === 'event') {
                    const ev = item.data
                    return <EventRow key={ev.id} ev={ev} color={getColor(ev)} compact
                      onClick={() => !ev._isHoliday && setEventModal({ event: ev })}
                      dateLabel={item.date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}
                      isLast={isLast}
                    />
                  } else {
                    const task = item.data
                    const pColors = { high:'var(--danger)', medium:'#d97706', low:'var(--success)' }
                    return (
                      <div key={task.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <i className="ti ti-checkbox" style={{ fontSize:13, color: pColors[task.priority]||'#d97706', flexShrink:0 }} />
                        <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                        <span style={{ fontSize:10, color:'var(--text-3)', flexShrink:0 }}>
                          {item.date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}
                        </span>
                      </div>
                    )
                  }
                })
              })()
          }
        </Panel>
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

function Panel({ title, action, children }) {
  return (
    <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontWeight:600, fontSize:12, color:'var(--text)' }}>{title}</span>
        {action && !action.plain && (
          <button onClick={action.onClick} style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>{action.label}</button>
        )}
        {action?.plain && <span style={{ fontSize:11, color:'var(--text-3)' }}>{action.label}</span>}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'12px 0' }}>{children}</div>
}

function EventRow({ ev, color, onClick, compact, dateLabel, isLast }) {
  const start = new Date(ev.start_at)
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8,
      padding: compact ? '5px 0' : '7px 0',
      borderBottom: isLast === false || isLast === undefined ? '1px solid var(--border)' : 'none',
      cursor: ev._isHoliday ? 'default' : 'pointer',
    }}
      onMouseEnter={e => { if (!ev._isHoliday) e.currentTarget.style.opacity='0.75' }}
      onMouseLeave={e => e.currentTarget.style.opacity='1'}
    >
      <span style={{ width:3, height:compact ? 24 : 32, borderRadius:2, background:color, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
        {!compact && <div style={{ fontSize:11, color:'var(--text-3)' }}>{ev.all_day ? 'All day' : formatTime(start)}{ev.location ? ` · ${ev.location}` : ''}</div>}
        {compact && dateLabel && <div style={{ fontSize:10, color:'var(--text-3)' }}>{dateLabel}{!ev.all_day ? ` · ${formatTime(start)}` : ''}</div>}
      </div>
    </div>
  )
}

const addBtnStyle = {
  marginTop:8, width:'100%', padding:'6px',
  border:'1px dashed var(--border-2)', borderRadius:'var(--radius)',
  background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit',
}
