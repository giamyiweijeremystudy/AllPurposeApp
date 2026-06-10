import { useState, useEffect, useRef, useCallback } from 'react'
import { loadState } from './db.js'
import { ScheduleDashboard } from './ScheduleDashboard.jsx'
import { TaskManager } from './TaskManager.jsx'
import { WidgetCard } from './WidgetCard.jsx'
import { Toast } from './ui.jsx'

export default function App() {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState(null)
  const [activeTab, setActiveTab] = useState({})
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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

  const navigateTo = (id) => {
    setActiveNav(id)
    setMobileNavOpen(false)
  }

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

  const renderContent = () => {
    if (!activeNav) return (
      <div className="empty-state">
        <i className="ti ti-layout-sidebar" style={{ fontSize:44 }} />
        <span style={{ fontSize:14 }}>Select a page</span>
      </div>
    )
    const activeTabLabel = pageTabs.find(t => t.id === activeTabId)?.label || ''
    if (activeTabLabel === 'Dashboard' && activeNavItem?.label === 'Schedule') {
      return <ScheduleDashboard appId={appId} onSwitchTab={which => {
        const target = pageTabs.find(t => which === 'calendar' ? t.label === 'Main Calendar' : t.label === 'Task manager')
        if (target) setActiveTab(p => ({ ...p, [activeNav]: target.id }))
      }} />
    }
    if (activeTabLabel === 'Task manager') return <TaskManager appId={appId} />
    if (pageWidgets.length === 0) return (
      <div className="empty-state">
        <i className="ti ti-layout-grid" style={{ fontSize:44 }} />
        <span style={{ fontSize:14 }}>Nothing here yet</span>
      </div>
    )
    return (
      <div className="widget-grid">
        {pageWidgets.map(w => <WidgetCard key={w.id} widget={w} appId={appId} />)}
      </div>
    )
  }

  return (
    <div className="app-shell">

      {/* ── MOBILE BACKDROP ── */}
      {mobileNavOpen && <div className="mob-backdrop" onClick={() => setMobileNavOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileNavOpen ? 'sidebar--mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && <span className="sidebar-title">{app.name}</span>}
          <button className="icon-btn" onClick={() => setCollapsed(c => !c)}>
            <i className={`ti ${collapsed ? 'ti-layout-sidebar-right' : 'ti-layout-sidebar-left'}`} />
          </button>
        </div>

        <div className="sidebar-nav">
          {sections.sort((a,b) => a.sort_order - b.sort_order).map(sec => {
            const items = navItems.filter(i => i.section_id === sec.id).sort((a,b) => a.sort_order - b.sort_order)
            return (
              <div key={sec.id} style={{ marginBottom:8 }}>
                {!collapsed && <div className="section-label">{sec.label}</div>}
                {items.map(item => (
                  <button key={item.id} onClick={() => navigateTo(item.id)}
                    className={`nav-item ${activeNav === item.id ? 'nav-item--active' : ''} ${collapsed ? 'nav-item--collapsed' : ''}`}>
                    <i className={`ti ${item.icon}`} style={{ fontSize:16, flexShrink:0 }} />
                    {!collapsed && <span className="nav-item-label">{item.label}</span>}
                    {!collapsed && item.badge && <span className="nav-badge">{item.badge}</span>}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main">

        {/* Topbar */}
        <div className="topbar">
          <button className="icon-btn mob-only" onClick={() => setMobileNavOpen(o => !o)}>
            <i className="ti ti-menu-2" style={{ fontSize:20 }} />
          </button>
          <div className="topbar-title">
            {activeNavItem && <i className={`ti ${activeNavItem.icon}`} style={{ fontSize:17, color:'var(--text-2)', flexShrink:0 }} />}
            <span style={{ fontWeight:600, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {activeNavItem?.label || app.name}
            </span>
          </div>
          {buttons.length > 0 && (
            <div className="topbar-actions">
              {buttons.map(btn => (
                <button key={btn.id} onClick={() => handleButtonClick(btn)} className="toolbar-btn">
                  <i className={`ti ${btn.icon}`} style={{ fontSize:14 }} />
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        {pageTabs.length > 0 && (
          <div className="tab-bar">
            {pageTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(p => ({ ...p, [activeNav]: tab.id }))}
                className={`tab-btn ${activeTabId === tab.id ? 'tab-btn--active' : ''}`}>
                <i className={`ti ${tab.icon}`} style={{ fontSize:14 }} />
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="content">
          {renderContent()}
        </div>
      </main>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  )
}
