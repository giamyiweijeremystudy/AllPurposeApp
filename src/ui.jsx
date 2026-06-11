import { useState, useEffect } from 'react'

export const ICONS = [
  'ti-home','ti-chart-bar','ti-users','ti-file','ti-folder','ti-calendar',
  'ti-clock','ti-star','ti-heart','ti-bell','ti-mail','ti-settings',
  'ti-search','ti-bookmark','ti-tag','ti-list','ti-database','ti-code',
  'ti-bolt','ti-rocket','ti-map','ti-camera','ti-music','ti-shopping-cart',
  'ti-briefcase','ti-tool','ti-layout-dashboard','ti-chart-dots','ti-terminal',
  'ti-puzzle','ti-flag','ti-award','ti-box','ti-compass','ti-cpu',
  'ti-cloud','ti-lock','ti-eye','ti-refresh','ti-trending-up','ti-check',
]

export function IconPicker({ value, onChange }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6, maxHeight:120, overflowY:'auto' }}>
      {ICONS.map(ic => (
        <button key={ic} type="button" onClick={() => onChange(ic)} style={{
          padding:'6px 8px', border:`1px solid ${ic===value ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius:6, background: ic===value ? 'var(--accent-bg)' : 'transparent',
          color: ic===value ? 'var(--accent)' : 'var(--text-2)', cursor:'pointer', fontSize:18,
        }}>
          <i className={`ti ${ic}`} />
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
    }}>
      <div style={{
        background:'var(--bg)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)',
        width:380, padding:24, boxShadow:'var(--shadow-lg)', maxHeight:'90vh', overflowY:'auto',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <span style={{ fontWeight:600, fontSize:15 }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-2)', fontSize:18, cursor:'pointer' }}>
            <i className="ti ti-x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</label>
      {children}
    </div>
  )
}

// Shared input styles — explicit colors so no CSS specificity fights
const base = {
  width:'100%',
  padding:'10px 12px',
  border:'1.5px solid var(--border-2)',
  borderRadius:'var(--radius)',
  background:'var(--bg-2)',
  color:'var(--text)',
  fontSize:'max(13px, 16px)', // satisfies iOS 16px min without !important hacks
  outline:'none',
  transition:'border-color 0.15s, background 0.15s',
  WebkitAppearance:'none',
  appearance:'none',
}

export function Input({ style: s, ...props }) {
  return (
    <input
      style={{ ...base, ...s }}
      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--bg)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border-2)'; e.target.style.background = 'var(--bg-2)' }}
      {...props}
    />
  )
}

export function Textarea({ style: s, ...props }) {
  return (
    <textarea
      style={{ ...base, minHeight:80, resize:'vertical', fontFamily:'inherit', lineHeight:1.5, ...s }}
      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--bg)' }}
      onBlur={e => { e.target.style.borderColor = 'var(--border-2)'; e.target.style.background = 'var(--bg-2)' }}
      {...props}
    />
  )
}

export function Select({ children, style: s, ...props }) {
  return (
    <div style={{ position:'relative' }}>
      <select
        style={{ ...base, cursor:'pointer', paddingRight:32, ...s }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
        {...props}
      >{children}</select>
      {/* Custom chevron so it looks modern on all browsers */}
      <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-3)', fontSize:12 }}>▾</span>
    </div>
  )
}

export function Btn({ variant = 'default', loading, children, style: s, ...props }) {
  const variants = {
    default: { background:'var(--bg-2)', border:'1.5px solid var(--border-2)', color:'var(--text)' },
    primary: { background:'var(--accent)', border:'1.5px solid var(--accent)', color:'#fff' },
    danger:  { background:'var(--danger-bg)', border:'1.5px solid var(--danger)', color:'var(--danger)' },
    ghost:   { background:'transparent', border:'none', color:'var(--text-2)' },
  }
  return (
    <button disabled={loading} style={{
      padding:'9px 16px', borderRadius:'var(--radius)', fontSize:14, cursor: loading ? 'not-allowed' : 'pointer',
      fontWeight:500, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
      opacity: loading ? 0.7 : 1, lineHeight:1, fontFamily:'inherit',
      ...variants[variant], ...s,
    }} {...props}>
      {loading ? <i className="ti ti-loader-2 spin" style={{ fontSize:14 }} /> : null}
      {children}
    </button>
  )
}

export function BtnRow({ children }) {
  return <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>{children}</div>
}

export function Toast({ msg, type }) {
  if (!msg) return null
  return <div className={`toast ${type === 'error' ? 'error' : ''}`}><i className={`ti ${type === 'error' ? 'ti-alert-circle' : 'ti-check'}`} />{msg}</div>
}
