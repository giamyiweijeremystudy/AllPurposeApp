import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

function pad(n) { return String(n).padStart(2,'0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export function TaskManager({ appId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [showCompleted, setShowCompleted] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState({})
  const [filter, setFilter] = useState('all') // all | today | overdue | high

  useEffect(() => {
    if (!appId) return
    supabase.from('tasks').select('*').eq('app_id', appId).order('sort_order')
      .then(({ data }) => { setTasks(data || []); setLoading(false) })
  }, [appId])

  const addTask = async () => {
    if (!newTitle.trim()) return
    const { data } = await supabase.from('tasks').insert({
      app_id: appId, title: newTitle.trim(),
      due_date: newDue || null, priority: newPriority,
      sort_order: tasks.length,
    }).select().single()
    setTasks(prev => [...prev, data])
    // If due date set, also create an all-day calendar event so it shows on calendar
    if (newDue) {
      await supabase.from('events').insert({
        app_id: appId,
        title: newTitle.trim(),
        start_at: newDue + 'T00:00:00',
        end_at: newDue + 'T23:59:59',
        all_day: true,
        color: newPriority === 'high' ? '#dc2626' : newPriority === 'low' ? '#16a34a' : '#d97706',
        description: 'Task due date',
      })
    }
    setNewTitle(''); setNewDue(''); setNewPriority('medium')
  }

  const completeTask = async (id) => {
    await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completed_at: new Date().toISOString() } : t))
  }

  const uncompleteTask = async (id) => {
    await supabase.from('tasks').update({ completed: false, completed_at: null }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: false, completed_at: null } : t))
  }

  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const saveEdit = async (id) => {
    const prev = tasks.find(t => t.id === id)
    await supabase.from('tasks').update(editVal).eq('id', id)
    setTasks(p => p.map(t => t.id === id ? { ...t, ...editVal } : t))
    // If due_date was just added, create a calendar event
    if (editVal.due_date && !prev?.due_date) {
      await supabase.from('events').insert({
        app_id: appId,
        title: editVal.title || prev.title,
        start_at: editVal.due_date + 'T00:00:00',
        end_at: editVal.due_date + 'T23:59:59',
        all_day: true,
        color: editVal.priority === 'high' ? '#dc2626' : editVal.priority === 'low' ? '#16a34a' : '#d97706',
        description: 'Task due date',
      })
    }
    setEditingId(null)
  }

  const today = todayStr()
  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  const filtered = pending.filter(t => {
    if (filter === 'today') return t.due_date === today
    if (filter === 'overdue') return t.due_date && t.due_date < today
    if (filter === 'high') return t.priority === 'high'
    return true
  }).sort((a, b) => {
    const po = { high:0, medium:1, low:2 }
    return (po[a.priority]??1) - (po[b.priority]??1)
  })

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, color:'var(--text-3)' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:22 }} />
    </div>
  )

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      {/* Add task */}
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:16, marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:13, marginBottom:12 }}>New task</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Task title…"
            style={{ flex:1, minWidth:200, padding:'7px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit' }}
          />
          <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit' }} />
          <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
            style={{ padding:'7px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={addTask} style={{ padding:'7px 16px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
            Add
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {[
          { key:'all', label:`All (${pending.length})` },
          { key:'today', label:'Due today' },
          { key:'overdue', label:'Overdue' },
          { key:'high', label:'High priority' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding:'5px 12px', borderRadius:999, fontSize:12, cursor:'pointer', fontFamily:'inherit',
            background: filter === f.key ? 'var(--accent)' : 'var(--bg-2)',
            color: filter === f.key ? '#fff' : 'var(--text-2)',
            border: filter === f.key ? '1px solid var(--accent)' : '1px solid var(--border-2)',
            fontWeight: filter === f.key ? 600 : 400,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', marginBottom:12 }}>
        {filtered.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
            {filter === 'all' ? 'No pending tasks' : 'No tasks match this filter'}
          </div>
        ) : filtered.map((task, i) => (
          <TaskRow
            key={task.id} task={task}
            isLast={i === filtered.length - 1}
            editing={editingId === task.id}
            editVal={editVal}
            onEdit={() => { setEditingId(task.id); setEditVal({ title: task.title, due_date: task.due_date || '', priority: task.priority, notes: task.notes || '' }) }}
            onSaveEdit={() => saveEdit(task.id)}
            onCancelEdit={() => setEditingId(null)}
            onEditVal={v => setEditVal(prev => ({ ...prev, ...v }))}
            onComplete={() => completeTask(task.id)}
            onDelete={() => deleteTask(task.id)}
            today={today}
          />
        ))}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted(c => !c)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--text-3)', fontFamily:'inherit', marginBottom:8, display:'flex', alignItems:'center', gap:4 }}>
            <i className={`ti ti-chevron-${showCompleted ? 'down' : 'right'}`} style={{ fontSize:12 }} />
            Completed ({completed.length})
          </button>
          {showCompleted && (
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
              {completed.map((task, i) => (
                <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i < completed.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <button onClick={() => uncompleteTask(task.id)} style={{
                    width:18, height:18, borderRadius:'50%', border:'2px solid var(--accent)',
                    background:'var(--accent)', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <i className="ti ti-check" style={{ fontSize:10, color:'#fff' }} />
                  </button>
                  <span style={{ flex:1, fontSize:13, color:'var(--text-3)', textDecoration:'line-through' }}>{task.title}</span>
                  <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:13, padding:2 }}>
                    <i className="ti ti-trash" style={{ fontSize:13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, isLast, editing, editVal, onEdit, onSaveEdit, onCancelEdit, onEditVal, onComplete, onDelete, today }) {
  const [hovered, setHovered] = useState(false)
  const isOverdue = task.due_date && task.due_date < today
  const isDueToday = task.due_date === today

  const priorityColors = { high:'#dc2626', medium:'#d97706', low:'#16a34a' }
  const pColor = priorityColors[task.priority] || '#d97706'

  if (editing) return (
    <div style={{ padding:'12px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border)', background:'var(--bg)' }}>
      <input value={editVal.title} onChange={e => onEditVal({ title: e.target.value })}
        style={{ width:'100%', padding:'6px 10px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:13, outline:'none', fontFamily:'inherit', marginBottom:8 }} />
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
        <input type="date" value={editVal.due_date} onChange={e => onEditVal({ due_date: e.target.value })}
          style={{ padding:'5px 8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, outline:'none', fontFamily:'inherit' }} />
        <select value={editVal.priority} onChange={e => onEditVal({ priority: e.target.value })}
          style={{ padding:'5px 8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, outline:'none', fontFamily:'inherit' }}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <textarea value={editVal.notes} onChange={e => onEditVal({ notes: e.target.value })} placeholder="Notes…"
        style={{ width:'100%', padding:'6px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, outline:'none', fontFamily:'inherit', resize:'vertical', minHeight:56, marginBottom:8 }} />
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancelEdit} style={{ padding:'5px 12px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        <button onClick={onSaveEdit} style={{ padding:'5px 12px', border:'none', borderRadius:'var(--radius)', background:'var(--accent)', color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>Save</button>
      </div>
    </div>
  )

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: isLast ? 'none' : '1px solid var(--border)', background: hovered ? 'var(--bg-3)' : 'transparent', transition:'background 0.1s' }}>
      <button onClick={onComplete} style={{
        width:18, height:18, borderRadius:'50%', border:`2px solid ${pColor}`,
        background:'transparent', cursor:'pointer', flexShrink:0,
      }}
        onMouseEnter={e => { e.currentTarget.style.background = pColor + '22' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</div>
        {task.notes && <div style={{ fontSize:11, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{task.notes}</div>}
      </div>
      {task.due_date && (
        <span style={{ fontSize:11, flexShrink:0, fontWeight: isOverdue||isDueToday ? 600 : 400, color: isOverdue ? 'var(--danger)' : isDueToday ? '#d97706' : 'var(--text-3)' }}>
          {isOverdue ? 'Overdue · ' : isDueToday ? 'Today · ' : ''}{new Date(task.due_date + 'T00:00:00').toLocaleDateString([], { month:'short', day:'numeric' })}
        </span>
      )}
      <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, flexShrink:0,
        background: task.priority==='high' ? '#fef2f2' : task.priority==='low' ? '#f0fdf4' : '#fffbeb',
        color: pColor,
      }}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
      {hovered && (
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          <button onClick={onEdit} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:2, fontSize:13 }}><i className="ti ti-pencil" /></button>
          <button onClick={onDelete} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:2, fontSize:13 }}><i className="ti ti-trash" /></button>
        </div>
      )}
    </div>
  )
}
