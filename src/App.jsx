import { useState, useEffect, useRef, useCallback } from 'react'
import { loadState } from './db.js'
import { ScheduleDashboard } from './ScheduleDashboard.jsx'
import { TaskManager } from './TaskManager.jsx'
import { WidgetCard } from './WidgetCard.jsx'
import { Toast } from './ui.jsx'
import { Overview } from './Overview.jsx'
import { QuickAccessTab, ScheduleSummaryTab, FilesSummaryTab } from './MainDashboard.jsx'
import { AuthScreen } from './Auth.jsx'
import { SettingsPage, UsernameSetup } from './Settings.jsx'
import { supabase } from './supabase.js'
import { Wordle } from './Wordle.jsx'
import { Tetris } from './Tetris.jsx'
import { Hanoi } from './Hanoi.jsx'
import { Snake } from './Snake.jsx'

export default function App() {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState(null)
  const [activeTab, setActiveTab] = useState({})
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [calendarKey, setCalendarKey] = useState(0)
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const toastTimer = useRef(null)

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast({ msg: '', type: '' }), 2800)
  }, [])

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user === undefined || user === null) return // wait for auth
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
  }, [user])

  useEffect(() => {
    if (state?.app?.name) document.title = state.app.name
  }, [state?.app?.name])

  const loadProfile = async (u) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (data) {
      setProfile(data)
      // Apply saved theme/accent
      const root = document.documentElement
      root.classList.remove('theme-light','theme-dark')
      if (data.theme === 'light') root.classList.add('theme-light')
      else if (data.theme === 'dark') root.classList.add('theme-dark')
      if (data.accent_color) {
        root.style.setProperty('--accent', data.accent_color)
        root.style.setProperty('--accent-bg', data.accent_color + '22')
      }
      // Check if username has been set (not just the auto-generated email prefix)
      if (!data.username || data.username === u.email?.split('@')[0]) {
        setNeedsUsername(true)
      }
    }
  }

  const navigateTo = (id) => {
    setActiveNav(id)
    setMobileNavOpen(false)
  }

  // Auth gate
  if (user === undefined) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-3)' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:28, color:'var(--text-3)' }} />
    </div>
  )
  if (user === null) return <AuthScreen />
  if (needsUsername && user) return <UsernameSetup user={user} onComplete={name => { setProfile(p => ({...p, username:name})); setNeedsUsername(false) }} />

  // Show shell immediately while loading — faster perceived performance
  if (loading || !state) return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="skeleton" style={{ height:14, width:80, borderRadius:4 }} />
        </div>
        <div className="sidebar-nav" style={{ padding:'16px 12px', display:'flex', flexDirection:'column', gap:8 }}>
          {[60,80,70,55,75].map((w,i) => <div key={i} className="skeleton" style={{ height:12, width:`${w}%`, borderRadius:4 }} />)}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="skeleton" style={{ height:14, width:120, borderRadius:4 }} />
        </div>
        <div className="content" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12, color:'var(--text-3)' }}>
          {!loading && !state
            ? <><i className="ti ti-alert-circle" style={{ fontSize:32, color:'var(--danger)' }} /><span style={{ fontSize:13 }}>Could not connect. Check env vars.</span></>
            : <><i className="ti ti-loader-2 spin" style={{ fontSize:24 }} /><span style={{ fontSize:12 }}>Loading…</span></>
          }
        </div>
      </main>
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

  const TAB_BAR_H = pageTabs.length > 0 ? 44 : 0
  const mobileOffset = 50 + TAB_BAR_H

  const renderContent = () => {
    if (!activeNav) return (
      <div className="empty-state">
        <i className="ti ti-layout-sidebar" style={{ fontSize:44 }} />
        <span style={{ fontSize:14 }}>Select a page</span>
      </div>
    )
    const activeTabLabel = pageTabs.find(t => t.id === activeTabId)?.label || ''

    // Overview page tabs
    if (activeNavItem?.label === 'Overview') {
      if (activeTabLabel === 'Quick Access' || pageTabs.length === 0) {
        return <QuickAccessTab navItems={navItems} sections={sections} activeNavId={activeNav} onNavigate={navigateTo} />
      }
      if (activeTabLabel === 'Schedule') {
        const scheduleNav = navItems.find(i => i.label === 'Schedule')
        return <ScheduleSummaryTab appId={appId} mobileOffset={mobileOffset}
          onNavigateToSchedule={() => scheduleNav && navigateTo(scheduleNav.id)} />
      }
      if (activeTabLabel === 'Files') {
        const filesNav = navItems.find(i => i.label === 'Files')
        return <FilesSummaryTab onNavigateToFiles={() => filesNav && navigateTo(filesNav.id)} />
      }
    }
    if (activeTabLabel === 'Dashboard' && activeNavItem?.label === 'Schedule') {
      return <ScheduleDashboard appId={appId} mobileOffset={mobileOffset} onSwitchTab={which => {
        const target = pageTabs.find(t => which === 'calendar' ? t.label === 'Main Calendar' : t.label === 'Task manager')
        if (target) setActiveTab(p => ({ ...p, [activeNav]: target.id }))
      }} />
    }
    if (activeTabLabel === 'Task manager') return <TaskManager appId={appId} />
    if (activeNavItem?.label === 'Wordle') return <Wordle />
    if (activeNavItem?.label === 'Tetris') return <Tetris />
    if (activeNavItem?.label === 'Hanoi') return <Hanoi />
    if (activeNavItem?.label === 'Snake') return <Snake />
    if (pageWidgets.length === 0) return (
      <div className="empty-state">
        <i className="ti ti-layout-grid" style={{ fontSize:44 }} />
        <span style={{ fontSize:14 }}>Nothing here yet</span>
      </div>
    )
    return (
      <div className="widget-grid">
        {pageWidgets.map(w => <WidgetCard key={w.id} widget={w} appId={appId} calendarKey={calendarKey} mobileOffset={mobileOffset} />)}
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
          <button className="icon-btn mob-only" onClick={() => { setMobileNavOpen(o => !o); setCalendarKey(k => k + 1) }}>
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
          {/* Home button */}
          {(() => {
            const overviewItem = navItems.find(i => i.label === 'Overview')
            if (!overviewItem || activeNav === overviewItem.id) return null
            return (
              <button onClick={() => navigateTo(overviewItem.id)} className="icon-btn" title="Home" style={{ flexShrink:0 }}>
                <i className="ti ti-home" style={{ fontSize:18 }} />
              </button>
            )
          })()}
          {/* Profile/Settings button */}
          <button onClick={() => setShowSettings(true)} title="Settings" style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:32, height:32, borderRadius:'50%', flexShrink:0,
            background: profile?.avatar_color || 'var(--accent)',
            border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color:'#fff',
          }}>
            {(profile?.username || user?.email || '?').slice(0,2).toUpperCase()}
          </button>
        </div>

        {/* Tabs */}
        {pageTabs.length > 0 && (
          <div className="tab-bar">
            {pageTabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(p => ({ ...p, [activeNav]: tab.id })); setCalendarKey(k => k + 1) }}
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

      {showSettings && user && (
        <SettingsPage
          user={user} profile={profile}
          onClose={() => setShowSettings(false)}
          onProfileUpdate={p => setProfile(p)}
        />
      )}
      <Toast msg={toast.msg} type={toast.type} />
    </div>
  )
}
