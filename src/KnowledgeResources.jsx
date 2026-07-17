import { useState, useRef } from 'react'
import { supabase } from './supabase.js'
import { fmtBytes, youtubeId, kindForMime, DOC_ICONS, uploadKbFile, deleteKbFile } from './kbResources.js'

export function ResourcesSection({ node, resources, appId, userId, onChanged }) {
  const [addOpen, setAddOpen] = useState(false)
  const media = resources.filter(r => ['image', 'video', 'youtube'].includes(r.kind))
  const files = resources.filter(r => ['pdf', 'document', 'file', 'link'].includes(r.kind))

  const remove = async (r) => {
    if (!confirm(`Remove "${r.title || 'this resource'}"?`)) return
    await supabase.from('kb_resources').delete().eq('id', r.id)
    if (r.storage_path) await deleteKbFile(r.storage_path)
    onChanged()
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, flex: 1 }}>
          Resources {resources.length > 0 && `(${resources.length})`}
        </div>
        <button onClick={() => setAddOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 8, padding: '6px 11px',
          background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-paperclip" /> Add
        </button>
      </div>

      {resources.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, border: '1px dashed var(--border-2)', borderRadius: 10 }}>
          No resources yet — attach photos, PDFs, videos, YouTube links, web links, or documents.
        </div>
      )}

      {media.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: files.length ? 10 : 0 }}>
          {media.map(r => <MediaCard key={r.id} r={r} onDelete={() => remove(r)} />)}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(r => <FileCard key={r.id} r={r} onDelete={() => remove(r)} />)}
        </div>
      )}

      {addOpen && (
        <AddResourceModal node={node} appId={appId} userId={userId} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); onChanged() }} />
      )}
    </div>
  )
}

function MediaCard({ r, onDelete }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
      {r.kind === 'image' && (
        <a href={r.url} target="_blank" rel="noreferrer">
          <img src={r.url} alt={r.title} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
        </a>
      )}
      {r.kind === 'video' && (
        <video src={r.url} controls style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', background: '#000' }} />
      )}
      {r.kind === 'youtube' && (
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId(r.url)}`}
            title={r.title} frameBorder="0" allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px' }}>
        <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title || 'Untitled'}</div>
        <button onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, padding: 2 }}><i className="ti ti-trash" /></button>
      </div>
    </div>
  )
}

function FileCard({ r, onDelete }) {
  const isLink = r.kind === 'link'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'var(--bg)' }}>
      {isLink && r.meta?.favicon ? (
        <img src={r.meta.favicon} alt="" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
      ) : (
        <i className={`ti ${DOC_ICONS[r.kind] || 'ti-file'}`} style={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.title || r.url}
        </a>
        <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isLink ? (r.meta?.domain || r.url) : [r.mime_type, fmtBytes(r.size_bytes)].filter(Boolean).join(' · ')}
        </div>
      </div>
      {!isLink && r.storage_path && (
        <a href={r.url} download title="Download" style={{ color: 'var(--text-3)', fontSize: 15, padding: 4 }}><i className="ti ti-download" /></a>
      )}
      <button onClick={onDelete} title="Remove" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 4 }}><i className="ti ti-trash" /></button>
    </div>
  )
}

// ── Add resource modal: upload a file, or paste a link (auto-detects YouTube) ──
function AddResourceModal({ node, appId, userId, onClose, onAdded }) {
  const [tab, setTab] = useState('upload')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const insertResource = async (row) => {
    const { error } = await supabase.from('kb_resources').insert({ node_id: node.id, app_id: appId, user_id: userId, ...row })
    if (error) throw error
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const uploaded = await uploadKbFile(userId, file)
      const kind = kindForMime(file.type, file.name)
      await insertResource({ kind, title: file.name, ...uploaded })
      onAdded()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const addLink = async () => {
    const url = link.trim()
    if (!url) return
    setBusy(true); setError('')
    try {
      const yt = youtubeId(url)
      if (yt) {
        await insertResource({ kind: 'youtube', title: 'YouTube video', url })
      } else {
        let meta = {}, title = url
        try {
          const res = await fetch('/api/link-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
          const data = await res.json()
          if (res.ok) { meta = { domain: data.domain, favicon: data.favicon, image: data.image, description: data.description }; title = data.title || url }
        } catch { /* fall back to bare link */ }
        await insertResource({ kind: 'link', title, url, meta })
      }
      onAdded()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 400, borderRadius: 'var(--radius-lg)', padding: 18, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>Add resource</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer' }}><i className="ti ti-x" /></button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'upload', label: 'Upload file' }, { id: 'link', label: 'Paste link' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
              background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text)', cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'upload' ? (
          <div>
            <input ref={fileRef} type="file" onChange={onFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={{
              width: '100%', border: '1px dashed var(--border-2)', borderRadius: 10, padding: '22px 0', background: 'transparent',
              color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <i className="ti ti-upload" style={{ fontSize: 22 }} />
              {busy ? 'Uploading…' : 'Choose a photo, PDF, video, or document'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
              onKeyDown={e => e.key === 'Enter' && addLink()}
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }} />
            <button onClick={addLink} disabled={busy || !link.trim()} style={{
              border: 'none', borderRadius: 8, padding: '0 14px', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600,
              cursor: busy || !link.trim() ? 'default' : 'pointer', opacity: busy || !link.trim() ? 0.5 : 1,
            }}>Add</button>
          </div>
        )}
        {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}><i className="ti ti-alert-circle" /> {error}</div>}
      </div>
    </div>
  )
}
