import { useState, useEffect, useRef, useCallback } from 'react'
import { loadState, deleteNavItem as dbDeleteNavItem, deleteTab as dbDeleteTab, deleteWidget as dbDeleteWidget, deleteButton as dbDeleteButton, updateSection as dbUpdateSection, deleteSection as dbDeleteSection } from './db.js'
import { NavItemModal, TabModal, WidgetModal, ButtonModal, SettingsModal } from './Modals.jsx'
import { WidgetCard } from './WidgetCard.jsx'
import { Toast, Btn } from './ui.jsx'

export default function App() {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState(null)
  const [activeTab, setActiveTab] = useState({})
  const [collapsed, setCollapsed] = useState(false)
  const [modal, setModal] = useState(null)
  const [editingWidget, setEditingWidget] = useState(null)
  const [toast, setToast] = useState({ msg: '', type: '' })
  const [editingSection, setEditingSection] = useState(null) // { id, label }
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'section'|'page', id, label }
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
      <span style={{ fontSize:13 }}>Connecting to Supabase…</span>
    </div>
  )

  if (!state) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:'var(--text-2)' }}>
      <i className="ti ti-alert-circle" style={{ fontSize:32, color:'var(--danger)' }} />
      <span style={{ fontSize:13 }}>Could not load app state. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</span>
    </div>
  )

  const { app, sections, navItems, tabs, widgets, buttons } = state
  const appId = app.id

  const pageTabs = tabs.filter(t => t.page_id === activeNav).sort((a,b) => a.sort_order - b.sort_order)
  const activeTabId = activeTab[activeNav] || pageTabs[0]?.id || null

  // Widgets are per-tab when tabs exist, per-page otherwise
  const pageWidgets = activeTabId
    ? widgets.filter(w => w.tab_id === activeTabId).sort((a,b) => a.sort_order - b.sort_order)
    : widgets.filter(w => w.page_id === activeNav && !w.tab_id).sort((a,b) => a.sort_order - b.sort_order)

  const activeNavItem = navItems.find(i => i.id === activeNav)

  // ── Section edit ─────────────────────────────────────────
  const saveSection = async () => {
    if (!editingSection?.label?.trim()) return
    await dbUpdateSection(editingSection.id, { label: editingSection.label.trim() })
    setState(s => ({ ...s, sections: s.sections.map(sec => sec.id === editingSection.id ? { ...sec, label: editingSection.label.trim() } : sec) }))
    setEditingSection(null)
    showToast('Section updated')
  }

  // ── Confirm delete ────────────────────────────────────────
  const handleConfirmedDelete = async () => {
    const { type, id } = confirmDelete
    setConfirmDelete(null)
    if (type === 'section') {
      await dbDeleteSection(id)
      setState(s => ({
        ...s,
        sections: s.sections.filter(sec => sec.id !== id),
        navItems: s.navItems.filter(i => i.section_id !== id),
      }))
      showToast('Section deleted')
    } else if (type === 'page') {
      await dbDeleteNavItem(id)
      setState(s => ({
        ...s,
        navItems: s.navItems.filter(i => i.id !== id),
        tabs: s.tabs.filter(t => t.page_id !== id),
        widgets: s.widgets.filter(w => w.page_id !== id),
      }))
      if (activeNav === id) setActiveNav(navItems.find(i => i.id !== id)?.id || null)
      showToast('Page removed')
    }
  }

  const deleteTab = async id => {
    await dbDeleteTab(id)
    setState(s => ({ ...s, tabs: s.tabs.filter(t => t.id !== id), widgets: s.widgets.filter(w => w.tab_id !== id) }))
    if (activeTabId === id) {
      const remaining = pageTabs.filter(t => t.id !== id)
      setActiveTab(p => ({ ...p, [activeNav]: remaining[0]?.id || null }))
    }
  }

  const deleteWidget = async id => {
    await dbDeleteWidget(id)
    setState(s => ({ ...s, widgets: s.widgets.filter(w => w.id !== id) }))
    showToast('Widget removed')
  }

  const deleteButton = async id => {
    await dbDeleteButton(id)
    setState(s => ({ ...s, buttons: s.buttons.filter(b => b.id !== id) }))
    showToast('Button removed')
  }

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
            const isEditing = editingSection?.id === sec.id
            return (
              <div key={sec.id} style={{ marginBottom:8 }}>
                {!collapsed && (
                  <div style={{ display:'flex', alignItems:'center', padding:'4px 8px 2px', gap:4 }}>
                    {isEditing ? (
                      <>
                        <input
                          value={editingSection.label}
                          onChange={e => setEditingSection(s => ({ ...s, label: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveSection(); if (e.key === 'Escape') setEditingSection(null) }}
                          autoFocus
                          style={{
                            flex:1, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em',
                            background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:4,
                            color:'var(--text)', padding:'2px 5px', outline:'none', fontFamily:'inherit',
                          }}
                        />
                        <button onClick={saveSection} style={{ background:'var(--accent)', border:'none', borderRadius:4, color:'#fff', cursor:'pointer', padding:'2px 6px', fontSize:11, fontFamily:'inherit' }}>✓</button>
                        <button onClick={() => setEditingSection(null)} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:'2px 4px', fontSize:11 }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{sec.label}</span>
                        <button
                          onClick={() => setEditingSection({ id: sec.id, label: sec.label })}
                          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:'1px 3px', fontSize:11, opacity:0.6, lineHeight:1 }}
                          title="Edit section"
                        ><i className="ti ti-pencil" style={{ fontSize:11 }} /></button>
                        <button
                          onClick={() => setConfirmDelete({ type:'section', id: sec.id, label: sec.label })}
                          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:'1px 3px', fontSize:11, opacity:0.6, lineHeight:1 }}
                          title="Delete section"
                        ><i className="ti ti-trash" style={{ fontSize:11 }} /></button>
                      </>
                    )}
                  </div>
                )}
                {items.map(item => (
                  <NavRow key={item.id} item={item} active={activeNav === item.id} collapsed={collapsed}
                    onClick={() => setActiveNav(item.id)}
                    onDelete={() => setConfirmDelete({ type:'page', id: item.id, label: item.label })}
                  />
                ))}
              </div>
            )
          })}

          {!collapsed && (
            <div style={{ padding:'4px 8px' }}>
              <button onClick={() => setModal('navItem')} style={{
                display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:'var(--radius)',
                border:'1px dashed var(--border-2)', background:'transparent', color:'var(--text-3)',
                fontSize:12, cursor:'pointer', width:'100%', fontFamily:'inherit',
              }}>
                <i className="ti ti-plus" style={{ fontSize:13 }} /> New page
              </button>
            </div>
          )}
        </div>

        <div style={{ borderTop:'1px solid var(--border)', padding:'6px 6px' }}>
          <NavBtn icon="ti-settings" label="Settings" collapsed={collapsed} onClick={() => setModal('settings')} />
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <div style={{ height:50, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 20px', gap:8, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
            {activeNavItem && <i className={`ti ${activeNavItem.icon}`} style={{ fontSize:17, color:'var(--text-2)', flexShrink:0 }} />}
            <span style={{ fontWeight:600, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {activeNavItem?.label || 'No page selected'}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            {buttons.map(btn => (
              <CustomButton key={btn.id} btn={btn} onClick={() => handleButtonClick(btn)} onDelete={() => deleteButton(btn.id)} />
            ))}
            <ToolbarBtn icon="ti-layout-grid-add" label="Widget" onClick={() => { setEditingWidget(null); setModal('widget') }} />
            <ToolbarBtn icon="ti-layout-navbar-expand" label="Tab" onClick={() => setModal('tab')} />
            <ToolbarBtn icon="ti-cursor-text" label="Button" onClick={() => setModal('button')} />
          </div>
        </div>

        {pageTabs.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', borderBottom:'1px solid var(--border)', padding:'0 20px', overflowX:'auto', flexShrink:0 }}>
            {pageTabs.map(tab => (
              <TabButton key={tab.id} tab={tab} active={activeTabId === tab.id}
                onClick={() => setActiveTab(p => ({ ...p, [activeNav]: tab.id }))}
                onDelete={() => deleteTab(tab.id)}
              />
            ))}
            <button onClick={() => setModal('tab')} style={{ padding:'8px 10px', border:'none', background:'transparent', color:'var(--text-3)', cursor:'pointer', fontSize:16, flexShrink:0 }}>
              <i className="ti ti-plus" />
            </button>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {activeNav ? (
            pageWidgets.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, color:'var(--text-3)', gap:14 }}>
                <i className="ti ti-layout-grid" style={{ fontSize:44 }} />
                <span style={{ fontSize:14 }}>No widgets on this {activeTabId ? 'tab' : 'page'} yet</span>
                <Btn variant="primary" onClick={() => setModal('widget')} style={{ gap:6 }}>
                  <i className="ti ti-plus" /> Add first widget
                </Btn>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
                {pageWidgets.map(w => (
                  <WidgetCard key={w.id} widget={w} appId={appId}
                    onDelete={deleteWidget}
                    onEdit={w => { setEditingWidget(w); setModal('widget') }}
                  />
                ))}
                <AddWidgetPlaceholder onClick={() => { setEditingWidget(null); setModal('widget') }} />
              </div>
            )
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, color:'var(--text-3)', gap:12 }}>
              <i className="ti ti-layout-sidebar" style={{ fontSize:44 }} />
              <span style={{ fontSize:14 }}>Add a page from the sidebar</span>
            </div>
          )}
        </div>
      </main>

      {/* ── MODALS ── */}
      {modal === 'navItem' && (
        <NavItemModal appId={appId} sections={sections} onClose={() => setModal(null)}
          onSave={({ item, newSection }) => {
            setState(s => ({
              ...s,
              sections: newSection ? [...s.sections, newSection] : s.sections,
              navItems: [...s.navItems, item],
            }))
            setActiveNav(item.id)
            showToast(`"${item.label}" added`)
          }}
        />
      )}

      {modal === 'tab' && activeNav && (
        <TabModal pageId={activeNav} onClose={() => setModal(null)}
          onSave={tab => {
            setState(s => ({ ...s, tabs: [...s.tabs, tab] }))
            setActiveTab(p => ({ ...p, [activeNav]: tab.id }))
            showToast(`Tab "${tab.label}" added`)
          }}
        />
      )}

      {modal === 'widget' && activeNav && (
        <WidgetModal pageId={activeNav} tabId={activeTabId} editing={editingWidget} onClose={() => { setModal(null); setEditingWidget(null) }}
          onSave={(widget, isEdit) => {
            setState(s => ({
              ...s,
              widgets: isEdit
                ? s.widgets.map(w => w.id === widget.id ? widget : w)
                : [...s.widgets, widget],
            }))
            showToast(isEdit ? 'Widget updated' : 'Widget added')
          }}
        />
      )}

      {modal === 'button' && (
        <ButtonModal appId={appId} onClose={() => setModal(null)}
          onSave={btn => {
            setState(s => ({ ...s, buttons: [...s.buttons, btn] }))
            showToast(`Button "${btn.label}" added`)
          }}
        />
      )}

      {modal === 'settings' && (
        <SettingsModal app={app} sections={sections} onClose={() => setModal(null)}
          onSave={event => {
            if (event.type === 'appName') setState(s => ({ ...s, app: { ...s.app, name: event.name } }))
            if (event.type === 'addSection') setState(s => ({ ...s, sections: [...s.sections, event.section] }))
            if (event.type === 'deleteSection') setState(s => ({
              ...s,
              sections: s.sections.filter(sec => sec.id !== event.id),
              navItems: s.navItems.filter(i => i.section_id !== event.id),
            }))
          }}
        />
      )}

      {/* ── CONFIRM DELETE POPUP ── */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'var(--bg)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)',
            padding:24, width:320, boxShadow:'0 8px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:8 }}>
              Delete {confirmDelete.type === 'section' ? 'section' : 'page'}?
            </div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:20 }}>
              Are you sure you want to delete <strong>"{confirmDelete.label}"</strong>?
              {confirmDelete.type === 'section' && ' All pages inside it will also be deleted.'}
              {confirmDelete.type === 'page' && ' All tabs and widgets on this page will also be deleted.'}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                padding:'7px 14px', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border-2)', color:'var(--text)', fontFamily:'inherit',
              }}>Cancel</button>
              <button onClick={handleConfirmedDelete} style={{
                padding:'7px 14px', borderRadius:'var(--radius)', fontSize:13, cursor:'pointer',
                background:'var(--danger)', border:'1px solid var(--danger)', color:'#fff', fontFamily:'inherit', fontWeight:500,
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  )
}

function NavRow({ item, active, collapsed, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position:'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={onClick} style={{
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
      {!collapsed && hovered && (
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{
          position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
          background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:2, fontSize:12, display:'flex', borderRadius:3,
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
        ><i className="ti ti-x" /></button>
      )}
    </div>
  )
}

function NavBtn({ icon, label, collapsed, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8, padding: collapsed ? '8px 14px' : '7px 10px',
      borderRadius:6, border:'none', background:'transparent', color:'var(--text-2)',
      fontSize:13, cursor:'pointer', width:'100%', whiteSpace:'nowrap', overflow:'hidden', fontFamily:'inherit',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
    >
      <i className={`ti ${icon}`} style={{ fontSize:16, flexShrink:0 }} />
      {!collapsed && label}
    </button>
  )
}

function TabButton({ tab, active, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position:'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={onClick} style={{
        display:'flex', alignItems:'center', gap:6, padding:'11px 14px',
        border:'none', background:'transparent',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
        fontWeight: active ? 600 : 400, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
      }}>
        <i className={`ti ${tab.icon}`} style={{ fontSize:14 }} />
        {tab.label}
      </button>
      {hovered && (
        <span onClick={e => { e.stopPropagation(); onDelete() }} style={{
          position:'absolute', right:2, top:'50%', transform:'translateY(-55%)',
          fontSize:11, color:'var(--text-3)', cursor:'pointer', padding:'1px 3px', borderRadius:3,
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
        ><i className="ti ti-x" /></span>
      )}
    </div>
  )
}

function ToolbarBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:5, padding:'6px 11px',
      border:'1px solid var(--border-2)', borderRadius:'var(--radius)',
      background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
    >
      <i className={`ti ${icon}`} style={{ fontSize:14 }} />{label}
    </button>
  )
}

function CustomButton({ btn, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position:'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button onClick={onClick} style={{
        display:'flex', alignItems:'center', gap:6, padding:'6px 11px',
        border:'1px solid var(--border-2)', borderRadius:'var(--radius)',
        background: hovered ? 'var(--bg-2)' : 'transparent', color:'var(--text)',
        fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
        transition:'background 0.1s',
      }}>
        <i className={`ti ${btn.icon}`} style={{ fontSize:14 }} />{btn.label}
      </button>
      {hovered && (
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{
          position:'absolute', top:-7, right:-7, width:16, height:16, borderRadius:'50%',
          background:'var(--danger)', border:'none', color:'#fff', fontSize:9,
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        }}><i className="ti ti-x" /></button>
      )}
    </div>
  )
}

function AddWidgetPlaceholder({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight:92, border:`1.5px dashed ${hovered ? 'var(--accent)' : 'var(--border-2)'}`,
        borderRadius:'var(--radius-lg)', background:'transparent',
        color: hovered ? 'var(--accent)' : 'var(--text-3)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        gap:6, fontSize:13, fontFamily:'inherit', transition:'all 0.15s',
      }}
    >
      <i className="ti ti-plus" style={{ fontSize:16 }} /> Add widget
    </button>
  )
}
