import { useState, useEffect } from 'react'

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

// Shared modal chrome for Fitness forms: a centered dialog on desktop,
// a full-width bottom sheet (with a drag handle and rounded top corners
// only) on mobile — easier to reach with a thumb and avoids the cramped
// centered-box feel on small screens.
export function Sheet({ title, children, onClose }) {
  const isMobile = useIsMobile()
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: isMobile ? '100%' : 400,
        maxHeight: isMobile ? '92vh' : '90vh', overflowY: 'auto',
        borderRadius: isMobile ? '18px 18px 0 0' : 'var(--radius-lg)',
        padding: isMobile ? '10px 16px 20px' : 18,
        boxShadow: 'var(--shadow-lg)',
        animation: isMobile ? 'module-enter 0.25s var(--ease-out)' : 'module-enter 0.22s var(--ease-out)',
        display: 'flex', flexDirection: 'column', gap: 10, boxSizing: 'border-box',
      }}>
        {isMobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-2)', alignSelf: 'center', marginBottom: 2 }} />}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer', padding: 4 }}><i className="ti ti-x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Field grid that collapses to a single column on mobile instead of a
// cramped 2-up layout, and gives inputs comfortably tappable height.
export function FieldGrid({ children }) {
  const isMobile = useIsMobile()
  return <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>{children}</div>
}

export { useIsMobile }

export const sheetInputStyle = {
  border: '1px solid var(--border)', borderRadius: 8, padding: '11px 12px', fontSize: 14,
  background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box',
}
