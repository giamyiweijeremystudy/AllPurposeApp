import { useState } from 'react'
import { Modal, Field, Input, Textarea, Select, Btn, BtnRow, IconPicker } from './ui.jsx'
import * as db from './db.js'

// ── Nav Item Modal ──────────────────────────────────────────
export function NavItemModal({ appId, sections, onClose, onSave }) {
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('ti-home')
  const [badge, setBadge] = useState('')
  const [sectionId, setSectionId] = useState(sections[0]?.id || '')
  const [isNewSec, setIsNewSec] = useState(false)
  const [newSecLabel, setNewSecLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!label.trim()) return
    setSaving(true)
    try {
      let targetSectionId = sectionId
      let newSection = null
      if (isNewSec && newSecLabel.trim()) {
        newSection = await db.createSection(appId, newSecLabel.trim())
        targetSectionId = newSection.id
      }
      const item = await db.createNavItem(targetSectionId, { label: label.trim(), icon, badge })
      onSave({ item, newSection })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add sidebar item" onClose={onClose}>
      <Field label="Section">
        <Select value={isNewSec ? '__new__' : sectionId} onChange={e => {
          if (e.target.value === '__new__') { setIsNewSec(true) }
          else { setIsNewSec(false); setSectionId(e.target.value) }
        }}>
          {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="__new__">+ New section…</option>
        </Select>
      </Field>
      {isNewSec && (
        <Field label="Section name">
          <Input value={newSecLabel} onChange={e => setNewSecLabel(e.target.value)} placeholder="My Section" autoFocus />
        </Field>
      )}
      <Field label="Label">
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="My Page" autoFocus={!isNewSec} />
      </Field>
      <Field label="Badge (optional)">
        <Input value={badge} onChange={e => setBadge(e.target.value)} placeholder="3" />
      </Field>
      <Field label="Icon"><IconPicker value={icon} onChange={setIcon} /></Field>
      <BtnRow>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>Add</Btn>
      </BtnRow>
    </Modal>
  )
}

// ── Tab Modal ────────────────────────────────────────────────
export function TabModal({ pageId, onClose, onSave }) {
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('ti-layout-dashboard')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!label.trim()) return
    setSaving(true)
    try {
      const tab = await db.createTab(pageId, { label: label.trim(), icon })
      onSave(tab); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add tab" onClose={onClose}>
      <Field label="Label"><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="New Tab" autoFocus /></Field>
      <Field label="Icon"><IconPicker value={icon} onChange={setIcon} /></Field>
      <BtnRow>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>Add</Btn>
      </BtnRow>
    </Modal>
  )
}

// ── Widget Modal ─────────────────────────────────────────────
export function WidgetModal({ pageId, editing, onClose, onSave }) {
  const [type, setType] = useState(editing?.type || 'metric')
  const [label, setLabel] = useState(editing?.label || '')
  const [value, setValue] = useState(editing?.value || '')
  const [sub, setSub] = useState(editing?.sub || '')
  const [note, setNote] = useState(editing?.note || '')
  const [items, setItems] = useState(() => {
    const it = editing?.items
    if (!it) return ''
    if (Array.isArray(it)) return it.join(', ')
    return ''
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!label.trim()) return
    setSaving(true)
    try {
      const payload = {
        type, label: label.trim(), value, sub, note,
        items: type === 'list' ? items.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
      let widget
      if (editing) {
        widget = await db.updateWidget(editing.id, payload)
      } else {
        widget = await db.createWidget(pageId, payload)
      }
      onSave(widget, !!editing); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title={editing ? 'Edit widget' : 'Add widget'} onClose={onClose}>
      <Field label="Type">
        <Select value={type} onChange={e => setType(e.target.value)}>
          <option value="metric">Metric</option>
          <option value="note">Note</option>
          <option value="list">List</option>
          <option value="progress">Progress bar</option>
          <option value="status">Status indicator</option>
        </Select>
      </Field>
      <Field label="Title / Label">
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Widget title" autoFocus />
      </Field>
      {type === 'metric' && <>
        <Field label="Value"><Input value={value} onChange={e => setValue(e.target.value)} placeholder="1,234" /></Field>
        <Field label="Sub-text"><Input value={sub} onChange={e => setSub(e.target.value)} placeholder="↑ 5% this week" /></Field>
      </>}
      {type === 'note' && (
        <Field label="Content"><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Write anything…" /></Field>
      )}
      {type === 'list' && (
        <Field label="Items (comma-separated)"><Input value={items} onChange={e => setItems(e.target.value)} placeholder="Item 1, Item 2, Item 3" /></Field>
      )}
      {type === 'progress' && <>
        <Field label="Percentage (0–100)"><Input type="number" min="0" max="100" value={value} onChange={e => setValue(e.target.value)} placeholder="75" /></Field>
        <Field label="Sub-text"><Input value={sub} onChange={e => setSub(e.target.value)} placeholder="Progress toward goal" /></Field>
      </>}
      {type === 'status' && <>
        <Field label="Status">
          <Select value={value} onChange={e => setValue(e.target.value)}>
            <option value="online">Online</option>
            <option value="warning">Warning</option>
            <option value="offline">Offline</option>
          </Select>
        </Field>
        <Field label="Sub-text"><Input value={sub} onChange={e => setSub(e.target.value)} placeholder="All systems nominal" /></Field>
      </>}
      <BtnRow>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Btn>
      </BtnRow>
    </Modal>
  )
}

// ── Button Modal ─────────────────────────────────────────────
export function ButtonModal({ appId, onClose, onSave }) {
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('ti-bolt')
  const [action, setAction] = useState('none')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!label.trim()) return
    setSaving(true)
    try {
      const btn = await db.createButton(appId, { label: label.trim(), icon, action, prompt })
      onSave(btn); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Add toolbar button" onClose={onClose}>
      <Field label="Label"><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Run Report" autoFocus /></Field>
      <Field label="Icon"><IconPicker value={icon} onChange={setIcon} /></Field>
      <Field label="Action">
        <Select value={action} onChange={e => setAction(e.target.value)}>
          <option value="none">No action</option>
          <option value="alert">Show alert message</option>
          <option value="toast">Show toast notification</option>
        </Select>
      </Field>
      {(action === 'alert' || action === 'toast') && (
        <Field label="Message"><Input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Action triggered!" /></Field>
      )}
      <BtnRow>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>Add</Btn>
      </BtnRow>
    </Modal>
  )
}

// ── Settings Modal ────────────────────────────────────────────
export function SettingsModal({ app, sections, onClose, onSave }) {
  const [name, setName] = useState(app.name)
  const [newSec, setNewSec] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await db.updateAppName(app.id, name)
      onSave({ type: 'appName', name: updated.name }); onClose()
    } finally { setSaving(false) }
  }

  const addSection = async () => {
    if (!newSec.trim()) return
    const sec = await db.createSection(app.id, newSec.trim())
    onSave({ type: 'addSection', section: sec })
    setNewSec('')
  }

  const removeSection = async (id) => {
    if (!confirm('Delete this section and all its items?')) return
    await db.deleteSection(id)
    onSave({ type: 'deleteSection', id })
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <Field label="App name">
        <Input value={name} onChange={e => setName(e.target.value)} />
      </Field>

      <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginTop:4 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
          Sidebar sections
        </div>
        {sections.map(sec => (
          <div key={sec.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ flex:1, fontSize:13 }}>{sec.label}</span>
            <Btn variant="ghost" style={{ padding:'4px 8px', fontSize:12, color:'var(--danger)' }} onClick={() => removeSection(sec.id)}>
              <i className="ti ti-trash" /> Delete
            </Btn>
          </div>
        ))}
        <div style={{ display:'flex', gap:6, marginTop:8 }}>
          <Input value={newSec} onChange={e => setNewSec(e.target.value)} placeholder="New section name"
            onKeyDown={e => e.key === 'Enter' && addSection()} />
          <Btn onClick={addSection} style={{ flexShrink:0 }}>Add</Btn>
        </div>
      </div>

      <BtnRow>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>Save</Btn>
      </BtnRow>
    </Modal>
  )
}
