import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { KnowledgeAssistant } from './KnowledgeAssistant.jsx'
import { ResourcesSection } from './KnowledgeResources.jsx'

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

const AI_MODES = [
  { id: 'expand', label: 'Expand', icon: 'ti-arrows-diagonal' },
  { id: 'summarize', label: 'Summarize', icon: 'ti-align-left' },
  { id: 'organize', label: 'Organize', icon: 'ti-list-details' },
  { id: 'explain', label: 'Explain simply', icon: 'ti-bulb' },
  { id: 'quiz', label: 'Quiz me', icon: 'ti-help-circle' },
]

// Depth-based label so the "Add" flow reads naturally: top level = Book,
// then Section, then Subsection, then anything deeper is just "Folder".
function levelLabel(depth) {
  return ['Book', 'Section', 'Subsection'][depth] || 'Folder'
}

export function Knowledge({ appId, userId }) {
  const isMobile = useIsMobile()
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [trail, setTrail] = useState([]) // [{id, title}] — empty = at the top (Books)
  const [activePageId, setActivePageId] = useState(null)
  const [search, setSearch] = useState('')
  const [addModal, setAddModal] = useState(null) // { kind } while open
  const [renameNode, setRenameNode] = useState(null)
  const [moveNode, setMoveNode] = useState(null)
  const [deleteNode, setDeleteNode] = useState(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiDraft, setAiDraft] = useState(null)
  const [customInstruction, setCustomInstruction] = useState('')
  const [resources, setResources] = useState([])

  const reload = async () => {
    const { data } = await supabase.from('kb_nodes').select('*').eq('app_id', appId).eq('user_id', userId).order('sort_order')
    setNodes(data || [])
    setLoading(false)
  }
  useEffect(() => { if (appId && userId) reload() }, [appId, userId])

  useEffect(() => {
    if (!activePageId) { setResources([]); return }
    supabase.from('kb_resources').select('*').eq('node_id', activePageId).order('sort_order')
      .then(({ data }) => setResources(data || []))
  }, [activePageId])

  const currentParentId = trail.length ? trail[trail.length - 1].id : null
  const activePage = nodes.find(n => n.id === activePageId) || null
  const children = nodes
    .filter(n => n.parent_id === currentParentId)
    .filter(n => !search.trim() || n.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === 'folder' ? -1 : 1))

  const openFolder = (node) => { setTrail(t => [...t, { id: node.id, title: node.title }]); setSearch('') }
  const goToTrail = (idx) => setTrail(t => t.slice(0, idx + 1))
  const goRoot = () => setTrail([])

  const createNode = async (kind, title) => {
    if (!title.trim()) return
    const { data, error } = await supabase.from('kb_nodes').insert({
      app_id: appId, user_id: userId, parent_id: currentParentId, kind, title: title.trim(),
    }).select().single()
    if (error) return
    setNodes(prev => [...prev, data])
    setAddModal(null)
    if (kind === 'page') setActivePageId(data.id)
    else openFolder(data)
  }

  const saveRename = async (id, title) => {
    if (!title.trim()) return
    await supabase.from('kb_nodes').update({ title: title.trim(), updated_at: new Date().toISOString() }).eq('id', id)
    setNodes(prev => prev.map(n => n.id === id ? { ...n, title: title.trim() } : n))
    setRenameNode(null)
  }
  const doMove = async (id, newParentId) => {
    await supabase.from('kb_nodes').update({ parent_id: newParentId, updated_at: new Date().toISOString() }).eq('id', id)
    setNodes(prev => prev.map(n => n.id === id ? { ...n, parent_id: newParentId } : n))
    setMoveNode(null)
  }
  const doDelete = async (id) => {
    await supabase.from('kb_nodes').delete().eq('id', id)
    setNodes(prev => descendantsOf(prev, id).reduce((arr, delId) => arr.filter(n => n.id !== delId), prev.filter(n => n.id !== id)))
    setDeleteNode(null)
    if (activePageId === id) setActivePageId(null)
  }

  const patchContent = (id, content) => setNodes(prev => prev.map(n => n.id === id ? { ...n, content } : n))
  const saveContent = async (id, content) => {
    await supabase.from('kb_nodes').update({ content, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const runAI = async (mode, instruction) => {
    if (!activePage) return
    setAiBusy(true); setAiError(''); setAiDraft(null)
    try {
      const res = await fetch('/api/kb-assist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: activePage.title, content: activePage.content, mode, instruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Something went wrong')
      setAiDraft({ mode: mode || 'custom', text: data.text })
    } catch (e) { setAiError(e.message || 'Failed to reach the AI') } finally { setAiBusy(false) }
  }
  const acceptDraft = () => {
    if (!aiDraft || !activePage) return
    const content = aiDraft.mode === 'quiz' ? activePage.content : aiDraft.text
    patchContent(activePage.id, content)
    saveContent(activePage.id, content)
    setAiDraft(null)
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading…</div>

  // ── Page editor view ──────────────────────────────────────
  if (activePage) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={() => setActivePageId(null)} style={{
          display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent',
          color: 'var(--text-3)', fontSize: 13, padding: '4px 2px', marginBottom: 10, cursor: 'pointer',
        }}>
          <i className="ti ti-arrow-left" /> {trail.length ? trail[trail.length - 1].title : 'Books'}
        </button>

        <input
          value={activePage.title}
          onChange={e => setNodes(prev => prev.map(n => n.id === activePage.id ? { ...n, title: e.target.value } : n))}
          onBlur={() => saveRename(activePage.id, activePage.title)}
          style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', padding: '4px 2px', marginBottom: 12, boxSizing: 'border-box' }}
        />

        <textarea
          value={activePage.content}
          onChange={e => patchContent(activePage.id, e.target.value)}
          onBlur={() => saveContent(activePage.id, activePage.content)}
          placeholder="Write this page, or ask the AI below to help fill it in…"
          style={{ width: '100%', minHeight: 220, resize: 'vertical', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
        />

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AI_MODES.map(m => (
            <button key={m.id} onClick={() => runAI(m.id)} disabled={aiBusy} style={{
              display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 8,
              padding: isMobile ? '9px 12px' : '6px 10px', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5,
              cursor: aiBusy ? 'default' : 'pointer', opacity: aiBusy ? 0.5 : 1,
            }}>
              <i className={`ti ${m.icon}`} /> {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input value={customInstruction} onChange={e => setCustomInstruction(e.target.value)}
            placeholder="Or tell the AI what to do with this page…"
            onKeyDown={e => { if (e.key === 'Enter' && customInstruction.trim()) runAI(null, customInstruction.trim()) }}
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 12.5, background: 'var(--bg)', color: 'var(--text)' }} />
          <button onClick={() => customInstruction.trim() && runAI(null, customInstruction.trim())} disabled={aiBusy || !customInstruction.trim()} style={{
            border: 'none', borderRadius: 8, padding: '0 12px', background: 'var(--accent)', color: '#fff',
            cursor: aiBusy || !customInstruction.trim() ? 'default' : 'pointer', opacity: aiBusy || !customInstruction.trim() ? 0.5 : 1, fontSize: 13,
          }}><i className="ti ti-send" /></button>
        </div>

        {aiBusy && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-3)' }}><i className="ti ti-loader-2 spin" /> Thinking…</div>}
        {aiError && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)' }}><i className="ti ti-alert-circle" /> {aiError}</div>}

        {aiDraft && (
          <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {aiDraft.mode === 'quiz' ? 'Quiz (not saved to the page)' : 'AI suggestion'}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>{aiDraft.text}</div>
            {aiDraft.mode !== 'quiz' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={acceptDraft} style={{ border: 'none', borderRadius: 8, padding: '6px 12px', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Replace content with this</button>
                <button onClick={() => setAiDraft(null)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Discard</button>
              </div>
            ) : (
              <button onClick={() => setAiDraft(null)} style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Close</button>
            )}
          </div>
        )}

        <ResourcesSection node={activePage} resources={resources} appId={appId} userId={userId}
          onChanged={() => supabase.from('kb_resources').select('*').eq('node_id', activePage.id).order('sort_order').then(({ data }) => setResources(data || []))} />
      </div>
    )
  }

  // ── Folder browser view (Books / Sections / Subsections) ──
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 14, fontSize: 13 }}>
        <Crumb label="Books" onClick={goRoot} active={trail.length === 0} />
        {trail.map((t, i) => (
          <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-chevron-right" style={{ fontSize: 11, color: 'var(--text-3)' }} />
            <Crumb label={t.title} onClick={() => goToTrail(i)} active={i === trail.length - 1} />
          </span>
        ))}
      </div>

      {/* Search + AI + Add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search here…"
          style={{ flex: '1 1 140px', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }} />
        <button onClick={() => setAssistantOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8, padding: '9px 12px',
          background: 'var(--accent-grad)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--glow)',
        }}>
          <i className="ti ti-sparkles" /> AI filing
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setAddModal({ kind: 'folder' })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px dashed var(--border-2)', borderRadius: 10, padding: '10px 0', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <i className="ti ti-folder-plus" /> New {levelLabel(trail.length)}
        </button>
        <button onClick={() => setAddModal({ kind: 'page' })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px dashed var(--border-2)', borderRadius: 10, padding: '10px 0', background: 'transparent', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <i className="ti ti-file-plus" /> New page
        </button>
      </div>

      {/* Contents */}
      {children.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7, border: '1px dashed var(--border-2)', borderRadius: 'var(--radius-lg)' }}>
          {trail.length === 0
            ? <>No books yet.<br />Create one above, or ask the AI filing assistant to set things up.</>
            : 'Empty — add a section, subsection, or page above.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {children.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', background: 'var(--bg)' }}>
              <button onClick={() => n.kind === 'folder' ? openFolder(n) : setActivePageId(n.id)} style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent',
                color: 'var(--text)', cursor: 'pointer', textAlign: 'left', padding: 0,
              }}>
                <i className={`ti ${n.kind === 'folder' ? 'ti-folder' : 'ti-file-text'}`} style={{ fontSize: 17, color: n.kind === 'folder' ? '#f59e0b' : 'var(--accent)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                  {n.kind === 'page' && n.content && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.content.slice(0, 60)}</div>
                  )}
                  {n.kind === 'folder' && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{nodes.filter(c => c.parent_id === n.id).length} item{nodes.filter(c => c.parent_id === n.id).length === 1 ? '' : 's'}</div>
                  )}
                </div>
              </button>
              <button onClick={() => setRenameNode(n)} title="Rename" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 5 }}><i className="ti ti-edit" /></button>
              <button onClick={() => setMoveNode(n)} title="Move" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 5 }}><i className="ti ti-folder-symlink" /></button>
              <button onClick={() => setDeleteNode(n)} title="Delete" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 5 }}><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}

      {addModal && (
        <QuickModal title={`New ${addModal.kind === 'folder' ? levelLabel(trail.length) : 'page'}`} onClose={() => setAddModal(null)}
          onSubmit={title => createNode(addModal.kind, title)} placeholder="Title" />
      )}
      {renameNode && (
        <QuickModal title="Rename" initial={renameNode.title} onClose={() => setRenameNode(null)}
          onSubmit={title => saveRename(renameNode.id, title)} placeholder="Title" />
      )}
      {deleteNode && (
        <ConfirmModal
          message={`Delete "${deleteNode.title}"${deleteNode.kind === 'folder' ? ' and everything inside it' : ''}? This can't be undone.`}
          onCancel={() => setDeleteNode(null)} onConfirm={() => doDelete(deleteNode.id)}
        />
      )}
      {moveNode && (
        <MoveModal node={moveNode} nodes={nodes} onClose={() => setMoveNode(null)} onMove={newParentId => doMove(moveNode.id, newParentId)} />
      )}
      {assistantOpen && (
        <KnowledgeAssistant appId={appId} userId={userId} nodes={nodes} onClose={() => setAssistantOpen(false)} onChanged={reload} />
      )}
    </div>
  )
}

function Crumb({ label, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      border: 'none', background: 'transparent', cursor: active ? 'default' : 'pointer',
      color: active ? 'var(--text)' : 'var(--text-3)', fontWeight: active ? 700 : 500, fontSize: 13, padding: '2px 2px',
    }}>{label}</button>
  )
}

function descendantsOf(nodes, id) {
  const out = []
  const walk = pid => {
    for (const n of nodes.filter(x => x.parent_id === pid)) { out.push(n.id); walk(n.id) }
  }
  walk(id)
  return out
}

function QuickModal({ title, initial = '', placeholder, onClose, onSubmit }) {
  const [val, setVal] = useState(initial)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 360, borderRadius: 'var(--radius-lg)', padding: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{title}</div>
        <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
          onKeyDown={e => e.key === 'Enter' && val.trim() && onSubmit(val)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, background: 'var(--bg)', color: 'var(--text)' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 0', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => val.trim() && onSubmit(val)} disabled={!val.trim()} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '10px 0', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: val.trim() ? 1 : 0.5 }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ message, onCancel, onConfirm }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 360, borderRadius: 'var(--radius-lg)', padding: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 0', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '10px 0', background: 'var(--danger)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// Flat folder picker (with indentation showing depth), excluding the node
// being moved and any of its own descendants to prevent creating a cycle.
function MoveModal({ node, nodes, onClose, onMove }) {
  const banned = new Set([node.id, ...descendantsOf(nodes, node.id)])
  const folders = nodes.filter(n => n.kind === 'folder' && !banned.has(n.id))
  const depthOf = n => { let d = 0, p = n.parent_id; while (p) { d++; const parent = nodes.find(x => x.id === p); p = parent?.parent_id ?? null }; return d }
  const labelOf = n => `${'— '.repeat(depthOf(n))}${n.title}`

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 380, maxHeight: '80vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)', padding: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 4 }}>Move "{node.title}"</div>
        <button onClick={() => onMove(null)} style={{ textAlign: 'left', border: 'none', borderRadius: 8, padding: '10px 10px', background: node.parent_id === null ? 'var(--accent-soft)' : 'transparent', color: node.parent_id === null ? 'var(--accent)' : 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          <i className="ti ti-books" /> Top level (make it a new book)
        </button>
        {folders.map(f => (
          <button key={f.id} onClick={() => onMove(f.id)} style={{ textAlign: 'left', border: 'none', borderRadius: 8, padding: '10px 10px', background: node.parent_id === f.id ? 'var(--accent-soft)' : 'transparent', color: node.parent_id === f.id ? 'var(--accent)' : 'var(--text)', fontSize: 13.5, cursor: 'pointer' }}>
            {labelOf(f)}
          </button>
        ))}
        <button onClick={onClose} style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}
