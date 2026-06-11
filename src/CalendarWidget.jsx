import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, isSameDay, isSameMonth,
  toDateStr, formatTime, formatDate,
  getEventsForRange, layoutEventsForWeek, fetchHolidays
} from './calendarUtils.js'
import {
  loadCategories, loadEvents, createEvent, updateEvent, deleteEvent, createCategory, deleteCategory
} from './calendarDb.js'
import { EventModal, CategoryModal } from './EventModal.jsx'

const WEEKDAYS_LONG  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const WEEKDAYS_SHORT = ['S','M','T','W','T','F','S']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export function CalendarWidget({ appId, mobileOffset = 50 }) {
  const [view, setView] = useState('month')
  const [current, setCurrent] = useState(new Date())
  const [rawEvents, setRawEvents] = useState([])
  const [holidays, setHolidays] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventModal, setEventModal] = useState(null)
  const [catModal, setCatModal] = useState(false)
  const [showHolidays, setShowHolidays] = useState(true)
  const [dayPanel, setDayPanel] = useState(null) // { date, events } — day events panel
  const isMobile = useIsMobile()

  const today = new Date()

  useEffect(() => {
    if (!appId) return
    Promise.all([
      loadCategories(appId),
      loadEvents(appId,
        new Date(current.getFullYear() - 1, 0, 1).toISOString(),
        new Date(current.getFullYear() + 2, 11, 31).toISOString()
      ),
    ]).then(([cats, evs]) => {
      setCategories(cats)
      setRawEvents(evs)
      setLoading(false)
    })
  }, [appId])

  useEffect(() => {
    fetchHolidays(current.getFullYear(), 'SG').then(setHolidays)
    fetchHolidays(current.getFullYear() + 1, 'SG').then(h =>
      setHolidays(prev => [...prev.filter(x => !x.id.startsWith('holiday-' + (current.getFullYear()+1))), ...h])
    )
  }, [current.getFullYear()])

  const allEvents = showHolidays ? [...rawEvents, ...holidays] : rawEvents

  const getColor = (ev) => {
    if (ev._isHoliday) return '#6b7280'
    if (ev.color) return ev.color
    if (ev.category_id) {
      const cat = categories.find(c => c.id === (ev.event_categories?.id || ev.category_id))
      if (cat) return cat.color
    }
    return '#4f46e5'
  }

  const navigate = (dir) => {
    if (view === 'month') setCurrent(addMonths(current, dir))
    else setCurrent(addDays(current, dir * 7))
  }

  // Day click: open day events panel instead of directly creating event
  const handleDayClick = (date) => {
    const dayEvs = getEventsForRange(allEvents, date, addDays(date, 1))
      .filter(e => isSameDay(new Date(e.start_at), date))
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    setDayPanel({ date, events: dayEvs })
  }

  const openNewEvent = (date) => {
    const d = new Date(date); d.setHours(9, 0, 0, 0)
    const end = new Date(d); end.setHours(10)
    setDayPanel(null)
    setEventModal({ event: { start_at: d.toISOString(), end_at: end.toISOString() } })
  }

  const handleSaveEvent = async (payload, editId) => {
    if (editId) {
      const updated = await updateEvent(editId, payload)
      setRawEvents(prev => prev.map(e => e.id === editId ? updated : e))
    } else {
      const created = await createEvent(appId, payload)
      setRawEvents(prev => [...prev, created])
    }
  }

  const handleDeleteEvent = async (id) => {
    await deleteEvent(id)
    setRawEvents(prev => prev.filter(e => e.id !== id))
  }

  const handleCategoryUpdate = async (action, data) => {
    if (action === 'create') {
      const cat = await createCategory(appId, data)
      setCategories(prev => [...prev, cat])
    } else if (action === 'delete') {
      await deleteCategory(data)
      setCategories(prev => prev.filter(c => c.id !== data))
    }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, color:'var(--text-3)' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:24 }} />
    </div>
  )

  const headerTitle = view === 'month'
    ? current.toLocaleDateString([], isMobile ? { month:'short', year:'numeric' } : { month:'long', year:'numeric' })
    : `${formatDate(startOfWeek(current))} – ${formatDate(endOfWeek(current))}`

  return (
    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>

      {/* ── Header ── */}
      <div style={{ borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', padding: isMobile ? '8px 10px' : '10px 16px', gap:6 }}>
          <button onClick={() => navigate(-1)} style={navBtnStyle}><i className="ti ti-chevron-left" /></button>
          <button onClick={() => navigate(1)} style={navBtnStyle}><i className="ti ti-chevron-right" /></button>
          <button onClick={() => setCurrent(new Date())} style={{ ...navBtnStyle, fontSize:11, padding:'4px 8px' }}>Today</button>
          <span style={{ fontWeight:600, fontSize: isMobile ? 13 : 15, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {headerTitle}
          </span>
          <div style={{ display:'flex', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', overflow:'hidden', flexShrink:0 }}>
            {['month','week'].map((v) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: isMobile ? '4px 8px' : '4px 12px',
                border:'none', fontSize:12, cursor:'pointer', fontFamily:'inherit',
                background: view===v ? 'var(--accent)' : 'transparent',
                color: view===v ? '#fff' : 'var(--text-2)',
              }}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
          </div>
          {!isMobile && <>
            <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-2)', cursor:'pointer', flexShrink:0 }}>
              <input type="checkbox" checked={showHolidays} onChange={e => setShowHolidays(e.target.checked)} />
              Holidays
            </label>
            <button onClick={() => setCatModal(true)} style={navBtnStyle} title="Categories"><i className="ti ti-tags" /></button>
            <button onClick={() => setEventModal({})} style={{
              display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
              background:'var(--accent)', border:'none', borderRadius:'var(--radius)',
              color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500, flexShrink:0,
            }}><i className="ti ti-plus" style={{ fontSize:14 }} /> Event</button>
          </>}
        </div>

        {isMobile && (
          <div style={{ display:'flex', alignItems:'center', padding:'0 10px 8px', gap:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-2)', cursor:'pointer' }}>
              <input type="checkbox" checked={showHolidays} onChange={e => setShowHolidays(e.target.checked)} />
              Holidays
            </label>
            <div style={{ flex:1 }} />
            <button onClick={() => setCatModal(true)} style={{ ...navBtnStyle, fontSize:12 }} title="Categories"><i className="ti ti-tags" /></button>
            <button onClick={() => setEventModal({})} style={{
              display:'flex', alignItems:'center', gap:4, padding:'5px 10px',
              background:'var(--accent)', border:'none', borderRadius:'var(--radius)',
              color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
            }}><i className="ti ti-plus" style={{ fontSize:13 }} /> Event</button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {view === 'month'
        ? <MonthView current={current} allEvents={allEvents} today={today} getColor={getColor}
            onDayClick={handleDayClick} onEventClick={ev => !ev._isHoliday && setEventModal({ event: ev })}
            isMobile={isMobile} />
        : <WeekView current={current} allEvents={allEvents} today={today} getColor={getColor}
            onSlotClick={openNewEvent} onEventClick={ev => !ev._isHoliday && setEventModal({ event: ev })}
            isMobile={isMobile} />
      }

      {/* ── Day events panel ── */}
      {dayPanel && (
        <DayPanel
          date={dayPanel.date}
          events={dayPanel.events}
          getColor={getColor}
          onClose={() => setDayPanel(null)}
          onAddEvent={() => openNewEvent(dayPanel.date)}
          onEventClick={ev => { setDayPanel(null); setEventModal({ event: ev }) }}
          mobileOffset={mobileOffset}
          isMobile={isMobile}
        />
      )}

      {eventModal !== null && (
        <EventModal event={eventModal.event} categories={categories} appId={appId} offsetTop={mobileOffset}
          onClose={() => setEventModal(null)} onSave={handleSaveEvent} onDelete={handleDeleteEvent} />
      )}
      {catModal && (
        <CategoryModal appId={appId} categories={categories}
          onClose={() => setCatModal(false)} onUpdate={handleCategoryUpdate} />
      )}
    </div>
  )
}

// ── Day events panel ──────────────────────────────────────────

function DayPanel({ date, events, getColor, onClose, onAddEvent, onEventClick, mobileOffset, isMobile }) {
  const dateLabel = date.toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' })

  const panel = (
    <div style={{
      position: isMobile ? 'fixed' : 'absolute',
      ...(isMobile
        ? { top: mobileOffset, left:0, right:0, bottom:0, zIndex:500 }
        : { top:0, left:0, right:0, bottom:0, zIndex:50 }
      ),
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      ...(isMobile ? {} : { borderRadius: 'var(--radius-lg)' }),
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid var(--border)', gap:12 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:14, fontWeight:500, fontFamily:'inherit', padding:0 }}>
          ← Back
        </button>
        <span style={{ flex:1, fontWeight:600, fontSize:15, textAlign: isMobile ? 'center' : 'left' }}>{dateLabel}</span>
        <button onClick={onAddEvent} style={{
          display:'flex', alignItems:'center', gap:4, padding:'6px 12px',
          background:'var(--accent)', border:'none', borderRadius:'var(--radius)',
          color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
        }}>
          <i className="ti ti-plus" style={{ fontSize:13 }} /> Add
        </button>
      </div>

      {/* Events list */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
        {events.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:160, gap:12, color:'var(--text-3)' }}>
            <i className="ti ti-calendar-off" style={{ fontSize:32 }} />
            <span style={{ fontSize:13 }}>No events this day</span>
            <button onClick={onAddEvent} style={{
              padding:'8px 20px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)',
              color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
            }}>Add event</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {events.map(ev => {
              const start = new Date(ev.start_at)
              const end = new Date(ev.end_at)
              const color = getColor(ev)
              return (
                <div key={ev.id} style={{
                  display:'flex', alignItems:'stretch', gap:0,
                  background:'var(--bg-2)', borderRadius:'var(--radius)',
                  border:'1px solid var(--border)', overflow:'hidden', cursor:'pointer',
                }}
                  onClick={() => onEventClick(ev)}
                >
                  {/* Colour strip */}
                  <div style={{ width:4, background:color, flexShrink:0 }} />
                  <div style={{ flex:1, padding:'10px 12px', minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{ev.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {ev.all_day ? 'All day' : `${formatTime(start)} – ${formatTime(end)}`}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </div>
                    {ev.description && (
                      <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.description}</div>
                    )}
                  </div>
                  {/* Edit button */}
                  {!ev._isHoliday && (
                    <button onClick={e => { e.stopPropagation(); onEventClick(ev) }} style={{
                      background:'none', border:'none', borderLeft:'1px solid var(--border)',
                      padding:'0 14px', color:'var(--text-3)', cursor:'pointer', flexShrink:0, fontSize:14,
                    }}>
                      <i className="ti ti-chevron-right" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  return isMobile ? createPortal(panel, document.body) : panel
}

// ── Month view ────────────────────────────────────────────────

function MonthView({ current, allEvents, today, getColor, onDayClick, onEventClick, isMobile }) {
  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart)
  const DAYS = isMobile ? WEEKDAYS_SHORT : WEEKDAYS_LONG

  const weeks = []
  let day = new Date(gridStart)
  while (day <= monthEnd || weeks.length < 5) {
    const week = []
    for (let i = 0; i < 7; i++) { week.push(new Date(day)); day = addDays(day, 1) }
    weeks.push(week)
    if (day > monthEnd && weeks.length >= 4) break
  }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)' }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ padding: isMobile ? '4px 2px' : '6px 8px', fontSize: isMobile ? 10 : 11, fontWeight:600, color:'var(--text-3)', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const weekStart = week[0]
        const weekEnd = week[6]
        const weekEvents = getEventsForRange(allEvents, weekStart, addDays(weekEnd, 1))
        const rows = layoutEventsForWeek(weekEvents, weekStart)

        return (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom: wi < weeks.length-1 ? '1px solid var(--border)' : 'none', position:'relative' }}>
            {week.map((d, di) => {
              const isToday = isSameDay(d, today)
              const isCurrentMonth = isSameMonth(d, current)

              // Mobile: show 1 pill + "+N more" — never expand the cell
              const allDayEvs = isMobile
                ? getEventsForRange(allEvents, d, addDays(d, 1))
                    .filter(e => isSameDay(new Date(e.start_at), d))
                : []
              const dayEvents = allDayEvs.slice(0, 1)
              const moreCount = allDayEvs.length - 1

              return (
                <div key={di} onClick={() => onDayClick(d)} style={{
                  height: isMobile ? 62 : undefined, minHeight: isMobile ? undefined : 72,
                  padding: isMobile ? '3px 2px 4px' : '4px 6px',
                  borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                  background: isToday ? 'var(--accent-bg)' : 'transparent',
                  cursor:'pointer',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: isMobile ? 22 : 24, height: isMobile ? 22 : 24,
                    borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: isMobile ? 11 : 12, fontWeight: isToday ? 700 : 400,
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : isCurrentMonth ? 'var(--text)' : 'var(--text-3)',
                    margin: isMobile ? '0 auto 3px' : '0 0 2px',
                  }}>{d.getDate()}</div>

                  {/* Mobile: 1 pill + "+N more" badge */}
                  {isMobile && allDayEvs.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {dayEvents.map((ev, ei) => (
                        <div key={ei} style={{
                          background: getColor(ev), color:'#fff',
                          fontSize: 9, fontWeight: 600,
                          padding: '1px 3px', borderRadius: 3,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          opacity: ev._isHoliday ? 0.75 : 1,
                          maxWidth: '100%',
                        }} title={ev.title}>{ev.title}</div>
                      ))}
                      {moreCount > 0 && (
                        <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:600, paddingLeft:2 }}>+{moreCount}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Desktop: event text pills overlaid */}
            {!isMobile && (
              <div style={{ position:'absolute', top:28, left:0, right:0, pointerEvents:'none' }}>
                {rows.map((row, ri) => (
                  <div key={ri} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:2 }}>
                    {Array.from({ length: 7 }, (_, ci) => {
                      const cell = row[ci]
                      if (!cell || cell === 'filled') return <div key={ci} />
                      const ev = cell.ev
                      const color = getColor(ev)
                      return (
                        <div key={ci} style={{
                          gridColumn: `${cell.startCol+1} / span ${cell.span}`,
                          background: color, color:'#fff', fontSize:11,
                          padding:'1px 5px',
                          borderRadius: cell.continuesFrom ? '0 3px 3px 0' : cell.continues ? '3px 0 0 3px' : 3,
                          cursor: ev._isHoliday ? 'default' : 'pointer',
                          pointerEvents:'all', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                          opacity: ev._isHoliday ? 0.75 : 1,
                        }}
                          onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                          title={ev.title}
                        >
                          {cell.continuesFrom ? '◂ ' : ''}{!ev.all_day ? `${formatTime(new Date(ev.start_at))} ` : ''}{ev.title}{cell.continues ? ' ▸' : ''}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Week view (desktop only, 7-day) ───────────────────────────

function WeekView({ current, allEvents, today, getColor, onSlotClick, onEventClick, isMobile }) {
  const viewStart = startOfWeek(current)
  const days = Array.from({ length: 7 }, (_, i) => addDays(viewStart, i))
  const viewEnd = days[6]

  const weekEvents = getEventsForRange(allEvents, viewStart, addDays(viewEnd, 1))
  const allDayEvents = weekEvents.filter(e => e.all_day || e._isHoliday)
  const timedEvents = weekEvents.filter(e => !e.all_day && !e._isHoliday)

  const gutterW = 48
  const COL_W = `calc((100% - ${gutterW}px) / 7)`
  const ROW_H = 28

  return (
    <div style={{ overflow:'auto', maxHeight:420 }}>
      <div style={{ position:'sticky', top:0, background:'var(--bg)', zIndex:10, borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'grid', gridTemplateColumns:`${gutterW}px repeat(7, 1fr)` }}>
          <div />
          {days.map((d, i) => {
            const isToday = isSameDay(d, today)
            return (
              <div key={i} style={{ padding:'5px 2px', textAlign:'center', borderLeft:'1px solid var(--border)' }}>
                <div style={{ fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {WEEKDAYS_LONG[d.getDay()]}
                </div>
                <div style={{
                  width:28, height:28, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:700,
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)',
                }}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>

        {allDayEvents.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:`${gutterW}px repeat(7, 1fr)`, borderTop:'1px solid var(--border)', minHeight:24 }}>
            <div style={{ fontSize:9, color:'var(--text-3)', padding:'4px 2px 0', textAlign:'right' }}>all‑day</div>
            {days.map((d, i) => {
              const dayEvs = allDayEvents.filter(e => isSameDay(new Date(e.start_at), d))
              return (
                <div key={i} style={{ borderLeft:'1px solid var(--border)', padding:'2px 2px' }}>
                  {dayEvs.map(ev => (
                    <div key={ev.id} onClick={() => onEventClick(ev)} style={{
                      background: getColor(ev), color:'#fff', fontSize:11,
                      padding:'1px 4px', borderRadius:3, marginBottom:1,
                      cursor: ev._isHoliday ? 'default' : 'pointer',
                      overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                      opacity: ev._isHoliday ? 0.75 : 1,
                    }} title={ev.title}>{ev.title}</div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ position:'relative', display:'grid', gridTemplateColumns:`${gutterW}px repeat(7, 1fr)` }}>
        {HOURS.map(h => (
          <div key={h} style={{ display:'contents' }}>
            <div style={{ height:ROW_H, borderBottom:'1px solid var(--border)', padding:'1px 3px 0 0', textAlign:'right', fontSize:9, color:'var(--text-3)' }}>
              {h === 0 ? '' : `${h}:00`}
            </div>
            {days.map((d, di) => (
              <div key={di}
                onClick={() => { const dt = new Date(d); dt.setHours(h,0,0,0); onSlotClick(dt) }}
                style={{ height:ROW_H, borderLeft:'1px solid var(--border)', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              />
            ))}
          </div>
        ))}

        {timedEvents.map(ev => {
          const s = new Date(ev.start_at)
          const e = new Date(ev.end_at)
          const dayIdx = days.findIndex(d => isSameDay(d, s))
          if (dayIdx === -1) return null
          const top = (s.getHours() + s.getMinutes()/60) * ROW_H
          const height = Math.max(ROW_H, ((e - s) / 3600000) * ROW_H)
          const color = getColor(ev)
          return (
            <div key={ev.id} onClick={() => onEventClick(ev)} style={{
              position:'absolute',
              top: 48 + top,
              left: `calc(${gutterW}px + ${dayIdx} * ${COL_W} + 2px)`,
              width: `calc(${COL_W} - 4px)`,
              height, background: color, color:'#fff',
              fontSize:11, borderRadius:4, padding:'2px 4px',
              overflow:'hidden', cursor:'pointer', zIndex:2,
              boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} title={ev.title}>
              <div style={{ fontWeight:600, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.title}</div>
              <div style={{ opacity:0.85 }}>{formatTime(s)} – {formatTime(e)}</div>
            </div>
          )
        })}

        {(() => {
          const now = new Date()
          const dayIdx = days.findIndex(d => isSameDay(d, today))
          if (dayIdx === -1) return null
          const top = 48 + (now.getHours() + now.getMinutes()/60) * ROW_H
          return (
            <div style={{
              position:'absolute', top,
              left: `calc(${gutterW}px + ${dayIdx} * ${COL_W})`,
              width: COL_W, height:2,
              background:'var(--danger)', zIndex:5, pointerEvents:'none',
            }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--danger)', marginTop:-2.5, marginLeft:-3.5 }} />
            </div>
          )
        })()}
      </div>
    </div>
  )
}

const navBtnStyle = {
  background:'none', border:'1px solid var(--border-2)', borderRadius:'var(--radius)',
  color:'var(--text-2)', cursor:'pointer', padding:'4px 8px', fontSize:14,
  display:'flex', alignItems:'center', flexShrink:0,
}
