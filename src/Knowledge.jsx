import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

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

export function Knowledge({ appId, userId }) {
  const isMobile = useIsMobile()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiDraft, setAiDraft] = useState(null) // { mode, text } — pending suggestion to accept/discard
  const [customInstruction, setCustomInstruction] = useState('')

  useEffect(() => {
    if (!appId || !userId) return
    supabase.from('kb_entries').select('*')
      .eq('app_id', appId).eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [appId, userId])

  const active = entries.find(e => e.id === activeId) || null

  const createEntry = async () => {
    const { data, error } = await supabase.from('kb_entries').insert({
      app_id: appId, user_id: userId, title: 'New entry', content: '',
    }).select().single()
    if (error) return
    setEntries(prev => [data, ...prev])
    setActiveId(data.id)
  }

  const patchEntry = (id, patch) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  const saveEntry = async (id, patch) => {
    setSaving(true)
    await supabase.from('kb_entries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
  }

  const deleteEntry = async (id) => {
    if (!confirm('Delete this entry?')) return
    await supabase.from('kb_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const runAI = async (mode, instruction) => {
    if (!active) return
    setAiBusy(true); setAiError(''); setAiDraft(null)
    try {
      const res = await fetch('/api/kb-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: active.title, content: active.content, mode, instruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Something went wrong')
      setAiDraft({ mode: mode || 'custom', text: data.text })
    } catch (e) {
      setAiError(e.message || 'Failed to reach the AI')
    } finally {
      setAiBusy(false)
    }
  }

  const acceptDraft = () => {
    if (!aiDraft || !active) return
    const newContent = aiDraft.mode === 'quiz' ? active.content : aiDraft.text
    patchEntry(active.id, { content: newContent })
    saveEntry(active.id, { content: newContent })
    setAiDraft(null)
  }

  const filtered = entries.filter(e =>
    !search.trim() || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ padding: 24, color: 'var(--text-3)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', gap: isMobile ? 0 : 16, height: '100%', maxWidth: 1100, margin: '0 auto' }}>
      {/* Entry list — full width on mobile when nothing is selected, hidden once an entry is open */}
      {(!isMobile || !activeId) && (
        <div style={{
          width: isMobile ? '100%' : 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: isMobile ? 'none' : '1px solid var(--border)', paddingRight: isMobile ? 0 : 12,
        }}>
          <button onClick={createEntry} style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10,
            padding: '10px 12px', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', marginBottom: 10,
          }}>
            <i className="ti ti-plus" /> New entry
          </button>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{
              border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5,
              background: 'var(--bg)', color: 'var(--text)', marginBottom: 10,
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 12.5, padding: '8px 4px' }}>No entries yet.</div>}
            {filtered.map(e => (
              <button key={e.id} onClick={() => { setActiveId(e.id); setAiDraft(null) }} style={{
                textAlign: 'left', border: 'none', borderRadius: 8, padding: isMobile ? '12px 10px' : '8px 10px',
                background: e.id === activeId ? 'var(--accent-soft, rgba(99,102,241,0.12))' : 'transparent',
                color: 'var(--text)', cursor: 'pointer', fontSize: 13.5,
              }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title || 'Untitled'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.content?.slice(0, 60) || 'Empty'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor — full width on mobile once an entry is open, always visible on desktop */}
      {(!isMobile || activeId) && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: isMobile ? '100%' : undefined }}>
        {isMobile && active && (
          <button onClick={() => { setActiveId(null); setAiDraft(null) }} style={{
            display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent',
            color: 'var(--text-3)', fontSize: 13, padding: '4px 2px', marginBottom: 8, cursor: 'pointer', alignSelf: 'flex-start',
          }}>
            <i className="ti ti-arrow-left" /> All entries
          </button>
        )}
        {!active ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13.5, padding: 24, textAlign: 'center' }}>
            Select an entry, or create a new one, to start writing.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={active.title}
                onChange={e => patchEntry(active.id, { title: e.target.value })}
                onBlur={() => saveEntry(active.id, { title: active.title })}
                style={{
                  flex: 1, border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', fontSize: 18, fontWeight: 700, padding: '4px 2px',
                }}
                placeholder="Title"
              />
              <button onClick={() => deleteEntry(active.id)} title="Delete entry" style={{
                border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: 18,
                padding: 8, minWidth: 36, minHeight: 36,
              }}>
                <i className="ti ti-trash" />
              </button>
              {saving && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Saving…</span>}
            </div>

            <textarea
              value={active.content}
              onChange={e => patchEntry(active.id, { content: e.target.value })}
              onBlur={() => saveEntry(active.id, { content: active.content })}
              placeholder="Write what you're learning, or ask the AI below to help fill this in…"
              style={{
                flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: 12,
                fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)',
                minHeight: 200,
              }}
            />

            {/* AI assist bar */}
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
              <input
                value={customInstruction}
                onChange={e => setCustomInstruction(e.target.value)}
                placeholder="Or tell the AI what to do with this entry…"
                onKeyDown={e => { if (e.key === 'Enter' && customInstruction.trim()) runAI(null, customInstruction.trim()) }}
                style={{
                  flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px',
                  fontSize: 12.5, background: 'var(--bg)', color: 'var(--text)',
                }}
              />
              <button onClick={() => customInstruction.trim() && runAI(null, customInstruction.trim())} disabled={aiBusy || !customInstruction.trim()} style={{
                border: 'none', borderRadius: 8, padding: '0 12px', background: 'var(--accent)', color: '#fff',
                cursor: aiBusy || !customInstruction.trim() ? 'default' : 'pointer', opacity: aiBusy || !customInstruction.trim() ? 0.5 : 1, fontSize: 13,
              }}>
                <i className="ti ti-send" />
              </button>
            </div>

            {aiBusy && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-3)' }}><i className="ti ti-loader-2 spin" /> Thinking…</div>}
            {aiError && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger)' }}><i className="ti ti-alert-circle" /> {aiError}</div>}

            {aiDraft && (
              <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {aiDraft.mode === 'quiz' ? 'Quiz (not saved to the entry)' : 'AI suggestion'}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>{aiDraft.text}</div>
                {aiDraft.mode !== 'quiz' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={acceptDraft} style={{
                      border: 'none', borderRadius: 8, padding: '6px 12px', background: 'var(--accent)', color: '#fff',
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    }}>Replace notes with this</button>
                    <button onClick={() => setAiDraft(null)} style={{
                      border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'transparent',
                      color: 'var(--text)', fontSize: 12.5, cursor: 'pointer',
                    }}>Discard</button>
                  </div>
                )}
                {aiDraft.mode === 'quiz' && (
                  <button onClick={() => setAiDraft(null)} style={{
                    marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', background: 'transparent',
                    color: 'var(--text)', fontSize: 12.5, cursor: 'pointer',
                  }}>Close</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      )}
    </div>
  )
}
