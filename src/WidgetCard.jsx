import { useState } from 'react'
import { CalendarWidget } from './CalendarWidget.jsx'

const DOT_COLORS = ['#818cf8','#34d399','#fb923c','#60a5fa','#f472b6','#a78bfa','#38bdf8','#4ade80']

export function WidgetCard({ widget, onDelete, onEdit, appId }) {
  const [hovered, setHovered] = useState(false)
  const items = Array.isArray(widget.items) ? widget.items : []

  if (widget.type === 'calendar') {
    return (
      <div style={{ position:'relative', gridColumn:'1 / -1' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered && (
          <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4, zIndex:10 }}>
            <button onClick={() => onDelete(widget.id)} style={{
              background:'var(--danger-bg)', border:'1px solid var(--danger)', borderRadius:6,
              padding:'3px 7px', cursor:'pointer', color:'var(--danger)', fontSize:12,
            }}><i className="ti ti-trash" /></button>
          </div>
        )}
        <CalendarWidget appId={appId} />
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
        padding:16, position:'relative', minHeight:92,
        transition:'box-shadow 0.15s, border-color 0.15s',
        boxShadow: hovered ? 'var(--shadow)' : 'none',
        borderColor: hovered ? 'var(--border-2)' : 'var(--border)',
      }}
    >
      {hovered && (
        <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4, zIndex:1 }}>
          <button onClick={() => onEdit(widget)} style={{
            background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:6,
            padding:'3px 7px', cursor:'pointer', color:'var(--text-2)', fontSize:12,
          }}><i className="ti ti-edit" /></button>
          <button onClick={() => onDelete(widget.id)} style={{
            background:'var(--danger-bg)', border:'1px solid var(--danger)', borderRadius:6,
            padding:'3px 7px', cursor:'pointer', color:'var(--danger)', fontSize:12,
          }}><i className="ti ti-trash" /></button>
        </div>
      )}

      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:7 }}>
        {widget.label}
      </div>

      {widget.type === 'metric' && <>
        <div style={{ fontSize:30, fontWeight:700, color:'var(--text)', lineHeight:1.05 }}>{widget.value || '—'}</div>
        {widget.sub && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4 }}>{widget.sub}</div>}
      </>}

      {widget.type === 'note' && (
        <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.65 }}>{widget.note}</div>
      )}

      {widget.type === 'list' && (
        <div>
          {items.length === 0
            ? <span style={{ fontSize:12, color:'var(--text-3)' }}>No items</span>
            : items.map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < items.length-1 ? '1px solid var(--border)' : 'none', fontSize:13 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:DOT_COLORS[i % DOT_COLORS.length], flexShrink:0 }} />
                {item}
              </div>
            ))
          }
        </div>
      )}

      {widget.type === 'progress' && <>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
          {widget.sub && <span style={{ fontSize:12, color:'var(--text-2)' }}>{widget.sub}</span>}
          <span style={{ fontSize:13, fontWeight:700, marginLeft:'auto' }}>{widget.value || 0}%</span>
        </div>
        <div style={{ height:8, background:'var(--bg-3)', borderRadius:4, overflow:'hidden' }}>
          <div style={{
            height:'100%', width:`${Math.min(100, Number(widget.value) || 0)}%`,
            background:'var(--accent)', borderRadius:4, transition:'width 0.4s ease',
          }} />
        </div>
      </>}

      {widget.type === 'status' && (
        <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:2 }}>
          <span style={{
            width:10, height:10, borderRadius:'50%', flexShrink:0,
            background: widget.value === 'online' ? 'var(--success)' : widget.value === 'warning' ? 'var(--warning)' : 'var(--danger)',
            boxShadow: `0 0 0 3px ${widget.value === 'online' ? 'var(--success-bg)' : widget.value === 'warning' ? 'var(--warning-bg)' : 'var(--danger-bg)'}`,
          }} />
          <span style={{ fontSize:14, fontWeight:600, textTransform:'capitalize' }}>{widget.value || 'unknown'}</span>
          {widget.sub && <span style={{ fontSize:12, color:'var(--text-2)' }}>· {widget.sub}</span>}
        </div>
      )}
    </div>
  )
}
