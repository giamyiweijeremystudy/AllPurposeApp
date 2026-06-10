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
          transition:'border-color 0.1s',
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
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-2)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width:'100%', padding:'8px 10px', border:'1px solid var(--border-2)',
  borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)',
  fontSize:13, outline:'none', transition:'border-color 0.15s',
}

export function Input(props) {
  return (
    <input style={inputStyle}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
      {...props}
    />
  )
}

export function Textarea(props) {
  return (
    <textarea style={{ ...inputStyle, minHeight:80, resize:'vertical', fontFamily:'inherit' }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
      {...props}
    />
  )
}

export function Select({ children, ...props }) {
  return (
    <select style={{ ...inputStyle, cursor:'pointer' }} {...props}>{children}</select>
  )
}

export function Btn({ variant = 'default', loading, children, style: s, ...props }) {
  const variants = {
    default: { background:'transparent', border:'1px solid var(--border-2)', color:'var(--text)' },
    primary: { background:'var(--accent)', border:'1px solid var(--accent)', color:'#fff' },
    danger:  { background:'transparent', border:'1px solid var(--danger)', color:'var(--danger)' },
    ghost:   { background:'transparent', border:'none', color:'var(--text-2)' },
  }
  return (
    <button disabled={loading} style={{
      padding:'7px 14px', borderRadius:'var(--radius)', fontSize:13, cursor: loading ? 'not-allowed' : 'pointer',
      fontWeight:500, display:'inline-flex', alignItems:'center', gap:6, opacity: loading ? 0.7 : 1,
      ...variants[variant], ...s,
    }} {...props}>
      {loading ? <i className="ti ti-loader-2 spin" style={{ fontSize:14 }} /> : null}
      {children}
    </button>
  )
}

export function BtnRow({ children }) {
  return <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>{children}</div>
}

export function Toast({ msg, type }) {
  if (!msg) return null
  return <div className={`toast ${type === 'error' ? 'error' : ''}`}><i className={`ti ${type === 'error' ? 'ti-alert-circle' : 'ti-check'}`} />{msg}</div>
}
