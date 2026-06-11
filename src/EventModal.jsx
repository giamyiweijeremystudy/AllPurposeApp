import { useState } from 'react'
import { Field, Input, Textarea, Select, Btn } from './ui.jsx'
import { toDateStr, formatTime, formatDate } from './calendarUtils.js'

const COLORS = [
  '#4f46e5','#7c3aed','#db2777','#dc2626','#d97706',
  '#16a34a','#0891b2','#0284c7','#6b7280','#1e293b',
]

// ── Router ───────────────────────────────────────────────────
export function EventModal({ event, categories, appId, onClose, onSave, onDelete }) {
  const isNew = !event?.id
  const [mode, setMode] = useState(isNew ? 'edit' : 'view')
  if (mode === 'view') return <EventViewPage event={event} categories={categories} onClose={onClose} onEdit={() => setMode('edit')} onDelete={onDelete} />
  return <EventEditPage event={event} categories={categories} onClose={onClose} onSave={onSave} onDelete={onDelete} onViewMode={isNew ? onClose : () => setMode('view')} isNew={isNew} />
}

// ── Shared full-page wrapper ──────────────────────────────────
function PageWrapper({ onBack, backLabel = '← Back', title, children, footer }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px', height: 52, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--accent)',
          cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
          fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, padding: 0,
        }}>
          {backLabel}
        </button>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1, textAlign: 'center' }}>{title}</span>
        <div style={{ width: 60 }} />{/* spacer to centre title */}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '20px 20px 0', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{
          padding: '16px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--bg)', position: 'sticky', bottom: 0,
          maxWidth: 560, width: '100%', margin: '0 auto',
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

// ── Read-only view ───────────────────────────────────────────
function EventViewPage({ event, categories, onClose, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const cat = categories.find(c => c.id === event.category_id) || event.event_categories
  const color = event.color || cat?.color || '#4f46e5'
  const timeLabel = event.all_day ? 'All day' : `${formatTime(start)} – ${formatTime(end)}`
  const dateLabel = event.all_day ? formatDate(start) : `${formatDate(start)}${!isSameDayFn(start, end) ? ` – ${formatDate(end)}` : ''}`
  const recurrenceLabel = { daily:'Repeats daily', weekly:'Repeats weekly', monthly:'Repeats monthly', yearly:'Repeats yearly' }[event.recurrence]

  const del = async () => {
    if (!confirm('Delete this event?')) return
    setDeleting(true)
    await onDelete(event._originalId || event.id)
    onClose()
  }

  return (
    <PageWrapper onBack={onClose} backLabel="← Close" title="Event"
      footer={
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Btn variant="danger" loading={deleting} onClick={del}>Delete</Btn>
          <Btn variant="primary" onClick={onEdit} style={{ minWidth:100 }}>Edit</Btn>
        </div>
      }
    >
      {/* Colour bar + title */}
      <div style={{ background: color, borderRadius: 'var(--radius-lg)', padding: '20px 20px 18px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: '#fff', lineHeight: 1.3 }}>{event.title}</div>
        {cat && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{cat.name}</div>}
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <DetailRow icon="ti-calendar" label="Date" value={dateLabel} />
        <DetailRow icon="ti-clock" label="Time" value={timeLabel} />
        {event.location && <DetailRow icon="ti-map-pin" label="Location" value={event.location} />}
        {recurrenceLabel && <DetailRow icon="ti-refresh" label="Recurrence" value={`${recurrenceLabel}${event.recurrence_end ? ` until ${formatDate(new Date(event.recurrence_end))}` : ''}`} />}
        {event.description && (
          <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Notes</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{event.description}</div>
          </div>
        )}
      </div>
      <div style={{ height: 20 }} />
    </PageWrapper>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: 'var(--text-2)' }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  )
}

function isSameDayFn(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ── Edit / New form ──────────────────────────────────────────
function EventEditPage({ event, categories, onClose, onSave, onDelete, onViewMode, isNew }) {
  const isEdit = !isNew

  const defaultStart = event?.start_at ? new Date(event.start_at) : (() => { const d = new Date(); d.setMinutes(0,0,0); return d })()
  const defaultEnd   = event?.end_at   ? new Date(event.end_at)   : (() => { const d = new Date(defaultStart); d.setHours(d.getHours()+1); return d })()

  const [title,        setTitle]        = useState(event?.title        || '')
  const [desc,         setDesc]         = useState(event?.description  || '')
  const [location,     setLocation]     = useState(event?.location     || '')
  const [allDay,       setAllDay]       = useState(event?.all_day      || false)
  const [startDate,    setStartDate]    = useState(toDateStr(defaultStart))
  const [startTime,    setStartTime]    = useState(defaultStart.toTimeString().slice(0,5))
  const [endDate,      setEndDate]      = useState(toDateStr(defaultEnd))
  const [endTime,      setEndTime]      = useState(defaultEnd.toTimeString().slice(0,5))
  const [categoryId,   setCategoryId]   = useState(event?.category_id  || '')
  const [color,        setColor]        = useState(event?.color        || '')
  const [recurrence,   setRecurrence]   = useState(event?.recurrence   || 'none')
  const [recurrenceEnd,setRecurrenceEnd]= useState(event?.recurrence_end || '')
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const start_at = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`
      const end_at   = allDay ? `${endDate}T23:59:59`   : `${endDate}T${endTime}:00`
      await onSave({
        title: title.trim(), description: desc, location,
        all_day: allDay, start_at, end_at,
        category_id: categoryId || null, color, recurrence,
        recurrence_end: recurrenceEnd || null,
      }, isEdit ? (event._originalId || event.id) : null)
      onClose()
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!confirm('Delete this event?')) return
    setDeleting(true)
    try { await onDelete(event._originalId || event.id); onClose() }
    finally { setDeleting(false) }
  }

  return (
    <PageWrapper
      onBack={onViewMode}
      backLabel={isNew ? '← Cancel' : '← Back'}
      title={isNew ? 'New Event' : 'Edit Event'}
      footer={
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>{isEdit && <Btn variant="danger" loading={deleting} onClick={del}>Delete</Btn>}</div>
          <Btn variant="primary" loading={saving} onClick={save} style={{ minWidth:100 }}>
            {isNew ? 'Create' : 'Save'}
          </Btn>
        </div>
      }
    >
      <Field label="Title">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" autoFocus />
      </Field>

      <Field label="All day">
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <div onClick={() => setAllDay(v => !v)} style={{
            width:44, height:26, borderRadius:13, background: allDay ? 'var(--accent)' : 'var(--bg-3)',
            border:'1.5px solid ' + (allDay ? 'var(--accent)' : 'var(--border-2)'),
            position:'relative', transition:'background 0.2s, border-color 0.2s', cursor:'pointer', flexShrink:0,
          }}>
            <div style={{
              position:'absolute', top:3, left: allDay ? 20 : 3,
              width:16, height:16, borderRadius:'50%', background:'#fff',
              transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize:14, color:'var(--text-2)' }}>{allDay ? 'Yes' : 'No'}</span>
        </label>
      </Field>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if(e.target.value > endDate) setEndDate(e.target.value) }} />
        </Field>
        {!allDay && (
          <Field label="Start time">
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </Field>
        )}
        <Field label="End date">
          <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
        </Field>
        {!allDay && (
          <Field label="End time">
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </Field>
        )}
      </div>

      <Field label="Category">
        <Select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>

      <Field label="Color">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingTop:4 }}>
          <button type="button" onClick={() => setColor('')} style={{
            width:32, height:32, borderRadius:'50%', cursor:'pointer', fontFamily:'inherit',
            border: !color ? '2.5px solid var(--text)' : '2px solid var(--border-2)',
            background:'var(--bg-3)', fontSize:12, color:'var(--text-3)',
          }}>✕</button>
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)} style={{
              width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer', border:'none',
              outline: color===c ? `3px solid ${c}` : 'none',
              outlineOffset: color===c ? '2px' : '0',
            }} />
          ))}
        </div>
      </Field>

      <Field label="Recurrence">
        <Select value={recurrence} onChange={e => setRecurrence(e.target.value)}>
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </Field>

      {recurrence !== 'none' && (
        <Field label="Repeat until">
          <Input type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)} />
        </Field>
      )}

      <Field label="Location">
        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Add location" />
      </Field>

      <Field label="Notes">
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add notes…" />
      </Field>

      <div style={{ height:24 }} />
    </PageWrapper>
  )
}

// ── Category manager (still a modal — simpler) ───────────────
import { Modal, BtnRow } from './ui.jsx'

export function CategoryModal({ appId, categories, onClose, onUpdate }) {
  const [cats, setCats] = useState(categories)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#4f46e5')
  return (
    <Modal title="Manage categories" onClose={onClose}>
      <div style={{ marginBottom:16 }}>
        {cats.map(cat => (
          <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ width:14, height:14, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
            <span style={{ flex:1, fontSize:14 }}>{cat.name}</span>
            <button onClick={() => { onUpdate('delete', cat.id); setCats(prev => prev.filter(c => c.id !== cat.id)) }}
              style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14, padding:4 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
          style={{ width:36, height:36, padding:2, border:'1.5px solid var(--border-2)', borderRadius:8, cursor:'pointer', background:'transparent', flexShrink:0 }} />
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Category name"
          onKeyDown={e => e.key==='Enter' && newName.trim() && onUpdate('create',{name:newName.trim(),color:newColor})} />
        <Btn onClick={() => { if(newName.trim()){onUpdate('create',{name:newName.trim(),color:newColor});setNewName('')} }} style={{ flexShrink:0 }}>Add</Btn>
      </div>
      <BtnRow><Btn variant="primary" onClick={onClose}>Done</Btn></BtnRow>
    </Modal>
  )
}
