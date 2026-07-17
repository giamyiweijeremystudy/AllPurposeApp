import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase.js'

// Text snapshot of the whole tree (indented, with ids) for the AI to read.
function buildTreeContext(nodes) {
  const byParent = {}
  for (const n of nodes) (byParent[n.parent_id || 'root'] ||= []).push(n)
  for (const k in byParent) byParent[k].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
  const lines = []
  const walk = (parentKey, depth) => {
    for (const n of byParent[parentKey] || []) {
      const icon = n.kind === 'folder' ? '📁' : '📄'
      lines.push(`${'  '.repeat(depth)}${icon} [id:${n.id}] ${n.title}${n.kind === 'page' && n.content ? ` — ${n.content.slice(0, 80)}${n.content.length > 80 ? '…' : ''}` : ''}`)
      if (n.kind === 'folder') walk(n.id, depth + 1)
    }
  }
  walk('root', 0)
  return lines.length ? lines.join('\n') : '(empty — no books yet)'
}

export function KnowledgeAssistant({ appId, userId, nodes, onClose, onChanged }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I can help organize your knowledge base — create books, sections, subsections, or pages, move things around, rename, or file new content wherever it makes sense. What do you need?" }
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // { fc, node, resolve }
  const scrollRef = useRef(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy, confirmDelete])

  const callApi = async (msgs, pendingFunctionResults) => {
    const res = await fetch('/api/kb-organize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs.map(m => ({ role: m.role, content: m.content })), context: buildTreeContext(nodes), pendingFunctionResults }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Something went wrong')
    return data
  }

  const executeCall = async (fc) => {
    const a = fc.args
    try {
      if (fc.name === 'create_node') {
        if (!['folder', 'page'].includes(a.kind) || !a.title?.trim()) throw new Error('Missing kind or title')
        const { data, error } = await supabase.from('kb_nodes').insert({
          app_id: appId, user_id: userId, parent_id: a.parent_id || null,
          kind: a.kind, title: a.title.trim(), content: a.content || '',
        }).select().single()
        if (error) throw error
        return { ok: true, summary: `Created ${a.kind} "${a.title.trim()}"`, data }
      }
      if (fc.name === 'move_node') {
        if (!a.id) throw new Error('Missing id')
        const { data, error } = await supabase.from('kb_nodes').update({ parent_id: a.new_parent_id || null, updated_at: new Date().toISOString() }).eq('id', a.id).select().single()
        if (error) throw error
        return { ok: true, summary: `Moved "${data.title}"`, data }
      }
      if (fc.name === 'rename_node') {
        if (!a.id || !a.title?.trim()) throw new Error('Missing id or title')
        const { data, error } = await supabase.from('kb_nodes').update({ title: a.title.trim(), updated_at: new Date().toISOString() }).eq('id', a.id).select().single()
        if (error) throw error
        return { ok: true, summary: `Renamed to "${data.title}"`, data }
      }
      if (fc.name === 'update_page_content') {
        if (!a.id) throw new Error('Missing id')
        const { data, error } = await supabase.from('kb_nodes').update({ content: a.content || '', updated_at: new Date().toISOString() }).eq('id', a.id).select().single()
        if (error) throw error
        return { ok: true, summary: `Updated content of "${data.title}"`, data }
      }
      if (fc.name === 'delete_node') {
        if (!a.id) throw new Error('Missing id')
        const node = nodes.find(n => n.id === a.id)
        const confirmed = await new Promise(resolve => setConfirmDelete({ fc, node, resolve }))
        setConfirmDelete(null)
        if (!confirmed) return { ok: false, summary: 'The user declined to delete this.' }
        const { error } = await supabase.from('kb_nodes').delete().eq('id', a.id)
        if (error) throw error
        return { ok: true, summary: `Deleted "${node?.title || a.id}"` }
      }
      return { ok: false, summary: `Unknown action: ${fc.name}` }
    } catch (e) {
      return { ok: false, summary: `Couldn't complete "${fc.name}": ${e.message || e}` }
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setError('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setBusy(true)
    try {
      let data = await callApi(next, null)
      if (data.functionCalls?.length) {
        const results = []
        for (const fc of data.functionCalls) {
          const result = await executeCall(fc)
          results.push({ name: fc.name, args: fc.args, thoughtSignature: fc.thoughtSignature, result })
          setMessages(m => [...m, { role: 'assistant', content: (result.ok ? '✅ ' : '⚠️ ') + result.summary }])
        }
        if (results.some(r => r.result.ok)) onChanged?.()
        data = await callApi(next, results)
      }
      if (data.text) setMessages(m => [...m, { role: 'assistant', content: data.text }])
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: 560, height: '85vh', borderRadius: '18px 18px 0 0',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', animation: 'module-enter 0.3s var(--ease-out)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <i className="ti ti-sparkles" style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>AI filing assistant</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer' }}><i className="ti ti-x" /></button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)', color: m.role === 'user' ? '#fff' : 'var(--text)',
              borderRadius: 12, padding: '9px 12px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          ))}
          {busy && <div style={{ alignSelf: 'flex-start', color: 'var(--text-3)', fontSize: 13, padding: '4px 8px' }}><i className="ti ti-loader-2 spin" /> Working…</div>}
          {error && <div style={{ alignSelf: 'flex-start', color: 'var(--danger)', fontSize: 12.5, padding: '4px 8px' }}><i className="ti ti-alert-circle" /> {error}</div>}

          {confirmDelete && (
            <div style={{ border: '1px solid var(--danger)', borderRadius: 12, padding: 12, background: 'var(--danger-bg)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--danger)' }}><i className="ti ti-alert-triangle" /> Confirm deletion</div>
              <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                Delete {confirmDelete.node?.kind === 'folder' ? 'folder' : 'page'} <strong>{confirmDelete.node?.title || 'this item'}</strong>
                {confirmDelete.node?.kind === 'folder' ? ' and everything inside it' : ''}?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => confirmDelete.resolve(true)} style={{ border: 'none', borderRadius: 8, padding: '7px 14px', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
                <button onClick={() => confirmDelete.resolve(false)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="e.g. 'Create a book called Cooking with a Recipes section'…"
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }} />
          <button onClick={send} disabled={busy || !input.trim()} style={{
            border: 'none', borderRadius: 10, padding: '0 16px', background: 'var(--accent)', color: '#fff',
            cursor: busy || !input.trim() ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, fontSize: 14, fontWeight: 600,
          }}><i className="ti ti-send" /></button>
        </div>
      </div>
    </div>
  )
}
