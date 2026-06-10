import { useState, useEffect } from 'react'
import { Modal, Field, Input, Textarea, Select, Btn, BtnRow } from './ui.jsx'
import { toDateStr } from './calendarUtils.js'

const COLORS = [
  '#4f46e5','#7c3aed','#db2777','#dc2626','#d97706',
  '#16a34a','#0891b2','#0284c7','#6b7280','#1e293b',
]

export function EventModal({ event, categories, appId, onClose, onSave, onDelete }) {
  const isEdit = !!event?.id && !event.id.startsWith('new')

  const defaultStart = event?.start_at
    ? new Date(event.start_at)
    : (() => { const d = new Date(); d.setMinutes(0,0,0); return d })()
  const defaultEnd = event?.end_at
    ? new Date(event.end_at)
    : (() => { const d = new Date(defaultStart); d.setHours(d.getHours()+1); return d })()

  const [title, setTitle] = useState(event?.title || '')
  const [desc, setDesc] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [allDay, setAllDay] = useState(event?.all_day || false)
  const [startDate, setStartDate] = useState(toDateStr(defaultStart))
  const [startTime, setStartTime] = useState(defaultStart.toTimeString().slice(0,5))
  const [endDate, setEndDate] = useState(toDateStr(defaultEnd))
  const [endTime, setEndTime] = useState(defaultEnd.toTimeString().slice(0,5))
  const [categoryId, setCategoryId] = useState(event?.category_id || '')
  const [color, setColor] = useState(event?.color || '')
  const [recurrence, setRecurrence] = useState(event?.recurrence || 'none')
  const [recurrenceEnd, setRecurrenceEnd] = useState(event?.recurrence_end || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const effectiveColor = color || categories.find(c => c.id === categoryId)?.color || '#4f46e5'

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const start_at = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`
      const end_at = allDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`
      const payload = {
        title: title.trim(), description: desc, location,
        all_day: allDay, start_at, end_at,
        category_id: categoryId || null,
        color, recurrence,
        recurrence_end: recurrenceEnd || null,
      }
      await onSave(payload, isEdit ? (event._originalId || event.id) : null)
      onClose()
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!confirm('Delete this event?')) return
    setDeleting(true)
    try {
      await onDelete(event._originalId || event.id)
      onClose()
    } finally { setDeleting(false) }
  }

  return (
    <Modal title={isEdit ? 'Edit event' : 'New event'} onClose={onClose}>
      <Field label="Title">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" autoFocus />
      </Field>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', color:'var(--text-2)' }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
          All day
        </label>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
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
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>

      <Field label="Color override">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
          <button
            type="button"
            onClick={() => setColor('')}
            style={{ width:24, height:24, borderRadius:'50%', border: !color ? '2px solid var(--text)' : '2px solid var(--border)', background:'var(--bg-3)', cursor:'pointer', fontSize:10 }}
            title="Use category color"
          >✕</button>
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ width:24, height:24, borderRadius:'50%', border: color===c ? '2px solid var(--text)' : '2px solid transparent', background:c, cursor:'pointer' }}
            />
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
        <Field label="Repeat until (optional)">
          <Input type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)} />
        </Field>
      )}

      <Field label="Location">
        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Add location" />
      </Field>

      <Field label="Description">
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add notes…" />
      </Field>

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:18 }}>
        <div>
          {isEdit && (
            <Btn variant="danger" loading={deleting} onClick={del}>Delete</Btn>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={save}>{isEdit ? 'Save' : 'Create'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function CategoryModal({ appId, categories, onClose, onUpdate }) {
  const [cats, setCats] = useState(categories)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#4f46e5')

  return (
    <Modal title="Manage categories" onClose={onClose}>
      <div style={{ marginBottom:16 }}>
        {cats.map(cat => (
          <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ width:14, height:14, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
            <span style={{ flex:1, fontSize:13 }}>{cat.name}</span>
            <button
              onClick={() => { onUpdate('delete', cat.id); setCats(prev => prev.filter(c => c.id !== cat.id)) }}
              style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:13 }}
            >✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
          style={{ width:32, height:32, padding:2, border:'1px solid var(--border-2)', borderRadius:6, cursor:'pointer', background:'transparent' }} />
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Category name"
          onKeyDown={e => e.key === 'Enter' && newName.trim() && onUpdate('create', { name: newName.trim(), color: newColor })} />
        <Btn onClick={() => { if (newName.trim()) { onUpdate('create', { name: newName.trim(), color: newColor }); setNewName('') } }}
          style={{ flexShrink:0 }}>Add</Btn>
      </div>
      <BtnRow><Btn variant="primary" onClick={onClose}>Done</Btn></BtnRow>
    </Modal>
  )
}
