import { CalendarWidget } from './CalendarWidget.jsx'

const DOT_COLORS = ['#818cf8','#34d399','#fb923c','#60a5fa','#f472b6','#a78bfa','#38bdf8','#4ade80']

export function WidgetCard({ widget, appId }) {
  if (widget.type === 'calendar') {
    return (
      <div style={{ gridColumn:'1 / -1' }}>
        <CalendarWidget appId={appId} />
      </div>
    )
  }

  return (
    <div style={{
      background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
      padding:16, minHeight:92,
    }}>
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

      {widget.type === 'list' && (() => {
        const items = Array.isArray(widget.items) ? widget.items : []
        return items.length === 0
          ? <span style={{ fontSize:12, color:'var(--text-3)' }}>No items</span>
          : items.map((item, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < items.length-1 ? '1px solid var(--border)' : 'none', fontSize:13 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:DOT_COLORS[i % DOT_COLORS.length], flexShrink:0 }} />
              {item}
            </div>
          ))
      })()}

      {widget.type === 'progress' && <>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
          {widget.sub && <span style={{ fontSize:12, color:'var(--text-2)' }}>{widget.sub}</span>}
          <span style={{ fontSize:13, fontWeight:700, marginLeft:'auto' }}>{widget.value || 0}%</span>
        </div>
        <div style={{ height:8, background:'var(--bg-3)', borderRadius:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(100, Number(widget.value) || 0)}%`, background:'var(--accent)', borderRadius:4 }} />
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
