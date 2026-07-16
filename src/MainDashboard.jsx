import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { getEventsForRange, isSameDay, addDays, formatTime } from './calendarUtils.js'
import { EventModal } from './EventModal.jsx'
import { PAGE_ILLUSTRATIONS, PAGE_COLORS, PAGE_BG } from './Overview.jsx'
import { LiveModules } from './LiveModules.jsx'

function pad(n) { return String(n).padStart(2,'0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

// ── Quick Access tab ──────────────────────────────────────────
export function QuickAccessTab({ navItems, sections, activeNavId, onNavigate }) {
  const otherPages = navItems.filter(i => i.id !== activeNavId)
  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = today.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' })

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:24, fontWeight:700, fontFamily:'var(--font-display)', letterSpacing:'-0.01em' }}>{greeting}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>{dateLabel}</div>
      </div>

      {sections.sort((a,b) => a.sort_order - b.sort_order).map(sec => {
        const pages = otherPages.filter(p => p.section_id === sec.id).sort((a,b) => a.sort_order - b.sort_order)
        if (pages.length === 0) return null
        return (
          <div key={sec.id} style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>{sec.label}</div>
            <div className="overview-grid">
              {pages.map(page => {
                const color = PAGE_COLORS[page.icon] || PAGE_COLORS.default
                const bg    = PAGE_BG[page.icon]    || PAGE_BG.default
                const svg   = PAGE_ILLUSTRATIONS[page.icon] || PAGE_ILLUSTRATIONS.default
                return (
                  <button key={page.id} onClick={() => onNavigate(page.id)} className="overview-card" style={{ '--ov-color': color, '--ov-bg': bg }}>
                    <div className="overview-card-img">{svg}</div>
                    <div className="overview-card-label">{page.label}</div>
                    {page.badge && <span className="overview-card-badge" style={{ background: color+'22', color }}>{page.badge}</span>}
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

// ── Quick Info tab ────────────────────────────────────────────
export function QuickInfoTab({ navItems, appId, userId, onNavigate }) {
  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:24, fontWeight:700, fontFamily:'var(--font-display)', letterSpacing:'-0.01em' }}>Quick info</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>A live snapshot across the app</div>
      </div>
      <LiveModules appId={appId} userId={userId} navItems={navItems} onNavigate={onNavigate} />
    </div>
  )
}

// ── Schedule summary tab ──────────────────────────────────────
export function ScheduleSummaryTab({ appId, mobileOffset, onNavigateToSchedule }) {
  const [userId, setUserId] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id || null))
  }, [])
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventModal, setEventModal] = useState(null)
  const [quickTask, setQuickTask] = useState('')
  const [taskSaved, setTaskSaved] = useState(false)

  const today = new Date()
  const tomorrow = addDays(today, 1)

  useEffect(() => {
    if (!appId) return
    Promise.all([
      userId ? supabase.from('events').select('*, event_categories(id,name,color)').eq('app_id', appId).eq('user_id', userId) : supabase.from('events').select('*').eq('user_id','none'),
      userId ? supabase.from('tasks').select('*').eq('app_id', appId).eq('user_id', userId).eq('completed', false).order('sort_order') : supabase.from('tasks').select('*').eq('user_id','none').eq('completed', false).order('sort_order'),
      userId ? supabase.from('event_categories').select('*').eq('app_id', appId).eq('user_id', userId) : supabase.from('event_categories').select('*').eq('user_id','none'),
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

  const pendingTasks = tasks.filter(t => !t.completed).slice(0, 6)
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < todayStr())

  const getColor = (ev) => {
    if (ev._isHoliday) return '#6b7280'
    if (ev.color) return ev.color
    return ev.event_categories?.color || '#4f46e5'
  }

  const saveQuickTask = async () => {
    if (!quickTask.trim()) return
    const { data } = await supabase.from('tasks').insert({ app_id: appId, user_id: userId, title: quickTask.trim(), sort_order: tasks.length }).select().single()
    setTasks(prev => [...prev, data])
    setQuickTask('')
    setTaskSaved(true)
    setTimeout(() => setTaskSaved(false), 1800)
  }

  const completeTask = async (id) => {
    await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleSaveEvent = async (payload, editId) => {
    if (editId) {
      const { data } = await supabase.from('events').update(payload).eq('id', editId).select('*, event_categories(id,name,color)').single()
      setEvents(prev => prev.map(e => e.id === editId ? data : e))
    } else {
      const { data } = await supabase.from('events').insert({ app_id: appId, user_id: userId, ...payload }).select('*, event_categories(id,name,color)').single()
      setEvents(prev => [...prev, data])
    }
  }

  const handleDeleteEvent = async (id) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, color:'var(--text-3)' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:22 }} />
    </div>
  )

  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      {/* Summary cards */}
      <div className="dash-summary-grid" style={{ marginBottom:20 }}>
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

      {/* Today + Tomorrow */}
      <div className="dash-today-grid" style={{ marginBottom:12 }}>
        <SummaryPanel title="Today's events"
          action={{ label:'Open Schedule →', onClick: onNavigateToSchedule }}>
          {todayEvents.length === 0
            ? <Empty>No events today</Empty>
            : todayEvents.map(ev => <EventRow key={ev.id} ev={ev} color={getColor(ev)} onClick={() => !ev._isHoliday && setEventModal({ event: ev })} />)
          }
          <button onClick={() => setEventModal({})} style={addBtnStyle}>+ Add event</button>
        </SummaryPanel>

        <SummaryPanel title="Tomorrow"
          action={{ label: tomorrow.toLocaleDateString([], { weekday:'long' }), plain:true }}>
          {tomorrowEvents.length === 0
            ? <Empty>Nothing scheduled</Empty>
            : tomorrowEvents.map(ev => <EventRow key={ev.id} ev={ev} color={getColor(ev)} onClick={() => !ev._isHoliday && setEventModal({ event: ev })} />)
          }
        </SummaryPanel>
      </div>

      {/* Bottom row: quick task + tasks list */}
      <div className="dash-bottom-grid">
        <SummaryPanel title="Quick task">
          <textarea
            value={quickTask}
            onChange={e => setQuickTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveQuickTask() } }}
            placeholder="Add a quick task…&#10;Press Enter to save"
            style={{ width:'100%', minHeight:90, padding:'8px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit', resize:'none', lineHeight:1.55 }}
          />
          <button onClick={saveQuickTask} style={{
            marginTop:8, width:'100%', padding:'7px',
            background: taskSaved ? 'var(--success)' : 'var(--accent)',
            border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500, transition:'background 0.2s',
          }}>{taskSaved ? '✓ Task added' : 'Add task'}</button>
        </SummaryPanel>

        <SummaryPanel title="Tasks" action={{ label:'Open Schedule →', onClick: onNavigateToSchedule }}>
          {pendingTasks.length === 0
            ? <Empty>No pending tasks</Empty>
            : pendingTasks.map((task, i) => (
              <div key={task.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 0', borderBottom: i < pendingTasks.length-1 ? '1px solid var(--border)' : 'none' }}>
                <button onClick={() => completeTask(task.id)} style={{
                  width:16, height:16, borderRadius:'50%', flexShrink:0,
                  border:`2px solid ${task.priority==='high' ? 'var(--danger)' : task.priority==='low' ? 'var(--success)' : '#d97706'}`,
                  background:'transparent', cursor:'pointer',
                }} />
                <span style={{ flex:1, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                {task.due_date && (
                  <span style={{ fontSize:10, flexShrink:0, color: task.due_date < todayStr() ? 'var(--danger)' : task.due_date === todayStr() ? '#d97706' : 'var(--text-3)' }}>
                    {new Date(task.due_date+'T00:00:00').toLocaleDateString([],{month:'short',day:'numeric'})}
                  </span>
                )}
              </div>
            ))
          }
        </SummaryPanel>

        {/* Upcoming 7 days */}
        <SummaryPanel title="Upcoming (7 days)" action={{ label:'Open Schedule →', onClick: onNavigateToSchedule }}>
          {(() => {
            const next7 = getEventsForRange(events, addDays(today,1), addDays(today,7))
              .sort((a,b) => new Date(a.start_at) - new Date(b.start_at))
              .slice(0, 8)
            if (next7.length === 0) return <Empty>Nothing coming up</Empty>
            return next7.map((ev, i) => (
              <EventRow key={ev.id} ev={ev} color={getColor(ev)}
                compact dateLabel={new Date(ev.start_at).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}
                isLast={i === next7.length - 1}
                onClick={() => !ev._isHoliday && setEventModal({ event: ev })}
              />
            ))
          })()}
        </SummaryPanel>
      </div>

      {eventModal !== null && (
        <EventModal event={eventModal.event} categories={categories} appId={appId}
          offsetTop={mobileOffset} onClose={() => setEventModal(null)}
          onSave={handleSaveEvent} onDelete={handleDeleteEvent} />
      )}
    </div>
  )
}

// ── Files summary tab ─────────────────────────────────────────
export function FilesSummaryTab({ onNavigateToFiles }) {
  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:32, textAlign:'center' }}>
        <i className="ti ti-folder" style={{ fontSize:40, color:'#d97706', marginBottom:12, display:'block' }} />
        <div style={{ fontWeight:600, fontSize:16, marginBottom:8 }}>Files</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>Your files summary will appear here once you start adding content.</div>
        <button onClick={onNavigateToFiles} style={{
          padding:'9px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)',
          color:'#fff', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
        }}>Open Files →</button>
      </div>
    </div>
  )
}

// ── Shared UI pieces ──────────────────────────────────────────
function SummaryPanel({ title, action, children }) {
  return (
    <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontWeight:600, fontSize:12 }}>{title}</span>
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
      <span style={{ width:3, height: compact ? 24 : 32, borderRadius:2, background:color, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
        {compact && dateLabel && <div style={{ fontSize:10, color:'var(--text-3)' }}>{dateLabel}{!ev.all_day ? ` · ${formatTime(start)}` : ''}</div>}
        {!compact && <div style={{ fontSize:11, color:'var(--text-3)' }}>{ev.all_day ? 'All day' : formatTime(start)}{ev.location ? ` · ${ev.location}` : ''}</div>}
      </div>
    </div>
  )
}

const addBtnStyle = {
  marginTop:8, width:'100%', padding:'6px',
  border:'1px dashed var(--border-2)', borderRadius:'var(--radius)',
  background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit',
}
