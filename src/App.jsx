import { useState, useEffect, useRef, useCallback } from 'react'
import { loadState } from './db.js'
import { WidgetCard } from './WidgetCard.jsx'
import { Toast } from './ui.jsx'

export default function App() {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState(null)
  const [activeTab, setActiveTab] = useState({})
  const [collapsed, setCollapsed] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const toastTimer = useRef(null)

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast({ msg: '', type: '' }), 2800)
  }, [])

  useEffect(() => {
    loadState()
      .then(s => {
        setState(s)
        setActiveNav(s.navItems[0]?.id || null)
        setLoading(false)
      })
      .catch(e => {
        console.error(e)
        showToast('Failed to load — check your Supabase config', 'error')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (state?.app?.name) document.title = state.app.name
  }, [state?.app?.name])

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:'var(--text-2)' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:32 }} />
      <span style={{ fontSize:13 }}>Loading…</span>
    </div>
  )

  if (!state) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:'var(--text-2)' }}>
      <i className="ti ti-alert-circle" style={{ fontSize:32, color:'var(--danger)' }} />
      <span style={{ fontSize:13 }}>Could not connect. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</span>
    </div>
  )

  const { app, sections, navItems, tabs, widgets, buttons } = state
  const appId = app.id

  const pageTabs = tabs.filter(t => t.page_id === activeNav).sort((a,b) => a.sort_order - b.sort_order)
  const activeTabId = activeTab[activeNav] || pageTabs[0]?.id || null
  const pageWidgets = activeTabId
    ? widgets.filter(w => w.tab_id === activeTabId).sort((a,b) => a.sort_order - b.sort_order)
    : widgets.filter(w => w.page_id === activeNav && !w.tab_id).sort((a,b) => a.sort_order - b.sort_order)
  const activeNavItem = navItems.find(i => i.id === activeNav)

  const handleButtonClick = btn => {
    if (btn.action === 'alert') alert(btn.prompt || btn.label)
    else if (btn.action === 'toast') showToast(btn.prompt || btn.label)
  }

  return (
    <div style={{ height:'100vh', display:'flex', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? 52 : 220, minWidth: collapsed ? 52 : 220,
        background:'var(--bg-2)', borderRight:'1px solid var(--border)',
        display:'flex', flexDirection:'column',
        transition:'width 0.2s, min-width 0.2s', overflow:'hidden',
      }}>
        <div style={{ display:'flex', alignItems:'center', padding:'0 14px', height:50, borderBottom:'1px solid var(--border)', gap:8, flexShrink:0 }}>
          {!collapsed && <span style={{ fontWeight:700, fontSize:14, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.name}</span>}
          <button onClick={() => setCollapsed(c => !c)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, display:'flex', flexShrink:0, padding:2 }}>
            <i className={`ti ${collapsed ? 'ti-layout-sidebar-right' : 'ti-layout-sidebar-left'}`} />
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {sections.sort((a,b) => a.sort_order - b.sort_order).map(sec => {
            const items = navItems.filter(i => i.section_id === sec.id).sort((a,b) => a.sort_order - b.sort_order)
            return (
              <div key={sec.id} style={{ marginBottom:8 }}>
                {!collapsed && (
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', padding:'6px 14px 3px', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                    {sec.label}
                  </div>
                )}
                {items.map(item => (
                  <NavRow key={item.id} item={item} active={activeNav === item.id} collapsed={collapsed}
                    onClick={() => setActiveNav(item.id)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>

        {/* Topbar */}
        <div style={{ height:50, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 20px', gap:8, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
            {activeNavItem && <i className={`ti ${activeNavItem.icon}`} style={{ fontSize:17, color:'var(--text-2)', flexShrink:0 }} />}
            <span style={{ fontWeight:600, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {activeNavItem?.label || 'No page selected'}
            </span>
          </div>
          {buttons.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
              {buttons.map(btn => (
                <button key={btn.id} onClick={() => handleButtonClick(btn)} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'6px 11px',
                  border:'1px solid var(--border-2)', borderRadius:'var(--radius)',
                  background:'transparent', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
                }}>
                  <i className={`ti ${btn.icon}`} style={{ fontSize:14 }} />{btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        {pageTabs.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid var(--border)', padding:'0 20px', overflowX:'auto', flexShrink:0 }}>
            {pageTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(p => ({ ...p, [activeNav]: tab.id }))} style={{
                display:'flex', alignItems:'center', gap:6, padding:'11px 14px',
                border:'none', background:'transparent',
                borderBottom: activeTabId === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTabId === tab.id ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: activeTabId === tab.id ? 600 : 400,
                fontSize:13, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
              }}>
                <i className={`ti ${tab.icon}`} style={{ fontSize:14 }} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {activeNav ? (
            pageWidgets.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, color:'var(--text-3)', gap:12 }}>
                <i className="ti ti-layout-grid" style={{ fontSize:44 }} />
                <span style={{ fontSize:14 }}>Nothing here yet</span>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
                {pageWidgets.map(w => (
                  <WidgetCard key={w.id} widget={w} appId={appId} />
                ))}
              </div>
            )
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, color:'var(--text-3)', gap:12 }}>
              <i className="ti ti-layout-sidebar" style={{ fontSize:44 }} />
              <span style={{ fontSize:14 }}>Select a page from the sidebar</span>
            </div>
          )}
        </div>
      </main>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  )
}

function NavRow({ item, active, collapsed, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'flex', alignItems:'center', gap:8,
        padding: collapsed ? '8px 14px' : '7px 12px',
        margin:'1px 6px', borderRadius:6, border:'none',
        background: active ? 'var(--accent-bg)' : hovered ? 'var(--bg-3)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        fontWeight: active ? 600 : 400, fontSize:13, cursor:'pointer',
        width:'calc(100% - 12px)', textAlign:'left', whiteSpace:'nowrap', overflow:'hidden',
        transition:'background 0.1s, color 0.1s',
      }}>
      <i className={`ti ${item.icon}`} style={{ fontSize:16, flexShrink:0 }} />
      {!collapsed && <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>{item.label}</span>}
      {!collapsed && item.badge && (
        <span style={{ background:'var(--accent-bg)', color:'var(--accent-text)', fontSize:10, padding:'1px 6px', borderRadius:999, fontWeight:700 }}>
          {item.badge}
        </span>
      )}
    </button>
  )
}
