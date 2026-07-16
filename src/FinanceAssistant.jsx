import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase.js'

function fmtMoney(n) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Build a compact snapshot of finance data for the chat context. Includes
// each entry's id so the model can target a specific one for deletion.
function buildContext(entries) {
  if (!entries.length) return 'No finance entries yet.'
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`
  const sum = (arr, kind) => arr.filter(e => e.kind === kind).reduce((s, e) => s + Number(e.amount), 0)
  const month = entries.filter(e => e.entry_date >= monthStart)
  const year = entries.filter(e => e.entry_date >= yearStart)
  const byCat = {}
  for (const e of month.filter(e => e.kind === 'expense')) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)
  const lines = [
    `This month: income ${fmtMoney(sum(month, 'income'))}, expenses ${fmtMoney(sum(month, 'expense'))}.`,
    `This year: income ${fmtMoney(sum(year, 'income'))}, expenses ${fmtMoney(sum(year, 'expense'))}.`,
    `This month by category: ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, a]) => `${c} ${fmtMoney(a)}`).join(', ') || 'none'}.`,
    `Recent transactions (id, date, kind, amount, category, description):`,
    ...entries.slice(0, 50).map(e => `- [id:${e.id}] ${e.entry_date} ${e.kind} ${fmtMoney(e.amount)} ${e.category}${e.description ? ` (${e.description})` : ''}`),
  ]
  return lines.join('\n')
}

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = () => rej(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}
function readFileAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error('Could not read file'))
    r.readAsText(file)
  })
}

const EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
]
const TEXT_TYPES = ['text/csv', 'text/plain']

async function excelToCsv(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  // Concatenate all sheets as CSV, labelled, in case a statement spans multiple tabs.
  return wb.SheetNames.map(name => `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`).join('\n\n')
}

export function FinanceAssistant({ appId, userId, entries, onClose, onEntriesAdded }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I can answer questions about your finances, add or delete entries directly (I'll always confirm before deleting anything), or read a statement — PDF, JPEG, PNG, CSV, plain text, or Excel — and turn it into categorized entries. Ask away, or upload a file below." }
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(null) // { entries, summary } pending import
  const [confirmDelete, setConfirmDelete] = useState(null) // { fc, entry, resolve }
  const scrollRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy, parsed, confirmDelete])

  const callApi = async (msgs, pendingFunctionResults) => {
    const res = await fetch('/api/finance-assist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'chat', messages: msgs.map(m => ({ role: m.role, content: m.content })), context: buildContext(entries), pendingFunctionResults }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Something went wrong')
    return data
  }

  // Executes one AI-requested action. Deletes always pause for an inline
  // confirmation before anything actually happens; adds run immediately.
  const executeCall = async (fc) => {
    if (fc.name === 'delete_finance_entry') {
      const entry = entries.find(e => e.id === fc.args.id)
      const confirmed = await new Promise(resolve => setConfirmDelete({ fc, entry, resolve }))
      setConfirmDelete(null)
      if (!confirmed) return { ok: false, summary: 'The user declined to delete this entry.' }
      const { error } = await supabase.from('finance_entries').delete().eq('id', fc.args.id)
      if (error) return { ok: false, summary: `Couldn't delete: ${error.message}` }
      onEntriesAdded?.()
      return { ok: true, summary: `Deleted ${entry?.description || entry?.category || 'entry'}${entry ? ` (${entry.entry_date}, ${fmtMoney(entry.amount)})` : ''}.` }
    }
    if (fc.name === 'add_finance_entry') {
      const amount = Number(fc.args.amount)
      if (!['expense', 'income'].includes(fc.args.kind) || !amount || amount <= 0) {
        return { ok: false, summary: 'Invalid entry — needs a kind (expense/income) and a positive amount.' }
      }
      const { data, error } = await supabase.from('finance_entries').insert({
        app_id: appId, user_id: userId, kind: fc.args.kind, amount,
        category: fc.args.category || 'Other', description: fc.args.description || '',
        entry_date: fc.args.entry_date || todayStr(),
      }).select().single()
      if (error) return { ok: false, summary: error.message }
      onEntriesAdded?.()
      return { ok: true, summary: `Added ${fc.args.kind} of ${fmtMoney(amount)} (${data.category}).`, data }
    }
    return { ok: false, summary: `Unknown action: ${fc.name}` }
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
        data = await callApi(next, results)
      }
      if (data.text) setMessages(m => [...m, { role: 'assistant', content: data.text }])
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(''); setParsed(null)
    setMessages(m => [...m, { role: 'user', content: `📄 Uploaded ${file.name}` }])
    setBusy(true)
    try {
      let body
      if (EXCEL_TYPES.includes(file.type) || /\.(xlsx|xls)$/i.test(file.name)) {
        const csv = await excelToCsv(file)
        body = { mode: 'parse', file: { text: csv, mimeType: 'text/csv' } }
      } else if (TEXT_TYPES.includes(file.type) || /\.(csv|txt)$/i.test(file.name)) {
        const text = await readFileAsText(file)
        body = { mode: 'parse', file: { text, mimeType: file.type || 'text/plain' } }
      } else {
        const data64 = await readFileAsBase64(file)
        body = { mode: 'parse', file: { data: data64, mimeType: file.type } }
      }
      const res = await fetch('/api/finance-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not read the file')
      setMessages(m => [...m, { role: 'assistant', content: data.summary || `Found ${data.entries.length} transactions.` }])
      if (data.entries?.length) setParsed(data)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const importParsed = async () => {
    if (!parsed?.entries?.length) return
    setBusy(true)
    const rows = parsed.entries.map(e => ({
      app_id: appId, user_id: userId, kind: e.kind, amount: Number(e.amount),
      category: e.category || 'Other', description: e.description || '', entry_date: e.entry_date || todayStr(),
    }))
    const { error } = await supabase.from('finance_entries').insert(rows)
    setBusy(false)
    if (error) { setError(error.message); return }
    setMessages(m => [...m, { role: 'assistant', content: `✅ Imported ${rows.length} transactions.` }])
    setParsed(null)
    onEntriesAdded?.()
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
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', flex: 1 }}>AI financial assistant</span>
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
                {confirmDelete.entry
                  ? <>Delete <strong>{confirmDelete.entry.description || confirmDelete.entry.category}</strong> — {fmtMoney(confirmDelete.entry.amount)} on {confirmDelete.entry.entry_date}?</>
                  : 'Delete this entry?'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => confirmDelete.resolve(true)} style={{ border: 'none', borderRadius: 8, padding: '7px 14px', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Delete</button>
                <button onClick={() => confirmDelete.resolve(false)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {parsed?.entries?.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{parsed.entries.length} transactions ready to import</div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {parsed.entries.map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-3)', width: 74, flexShrink: 0 }}>{e.entry_date}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || e.category}</span>
                    <span style={{ color: 'var(--text-3)' }}>{e.category}</span>
                    <span style={{ fontWeight: 600, color: e.kind === 'income' ? 'var(--success)' : 'var(--text)' }}>{e.kind === 'income' ? '+' : '−'}{fmtMoney(e.amount)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={importParsed} disabled={busy} style={{ border: 'none', borderRadius: 8, padding: '8px 14px', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Import all</button>
                <button onClick={() => setParsed(null)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Discard</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/csv,text/plain,.csv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Upload statement (PDF, image, CSV, text, or Excel)" style={{
            border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', background: 'var(--bg)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 17,
          }}><i className="ti ti-paperclip" /></button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask, or say 'add/delete...'…"
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
