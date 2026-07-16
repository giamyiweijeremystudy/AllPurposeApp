import { useState, useRef, useEffect } from 'react'
import { buildAppContext } from './aiHelperContext.js'
import { runFunctionCall } from './aiHelperActions.js'

export function AIHelper({ appId, userId, state, onDataChanged }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I can read your tasks, upcoming events, and notes, and I can add tasks, pages, notes, or calendar events for you directly — just ask." }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const callApi = async (nextMessages, pendingFunctionResults, context) => {
    const res = await fetch('/api/ai-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        context,
        pendingFunctionResults,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Something went wrong')
    return data
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError('')
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setSending(true)
    try {
      const context = await buildAppContext(appId, userId, state)
      let data = await callApi(nextMessages, null, context)

      // If the model asked to run any actions, execute them for real against
      // Supabase, then send the results back for a final natural-language reply.
      if (data.functionCalls?.length) {
        const results = []
        for (const fc of data.functionCalls) {
          const result = await runFunctionCall(fc, { appId, userId, state })
          results.push({ name: fc.name, args: fc.args, thoughtSignature: fc.thoughtSignature, result })
          setMessages(m => [...m, { role: 'assistant', content: (result.ok ? '✅ ' : '⚠️ ') + result.summary }])
        }
        if (results.some(r => r.result.ok)) onDataChanged?.()
        data = await callApi(nextMessages, results, context)
      }

      if (data.text) setMessages(m => [...m, { role: 'assistant', content: data.text }])
    } catch (e) {
      setError(e.message || 'Failed to reach the AI helper')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 760, margin: '0 auto' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
            color: m.role === 'user' ? '#fff' : 'var(--text)',
            border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 13px',
            fontSize: 13.5,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 13px' }}>
            <i className="ti ti-loader-2 spin" style={{ fontSize: 15 }} /> Thinking…
          </div>
        )}
        {error && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--danger)', fontSize: 12.5, padding: '4px 6px' }}>
            <i className="ti ti-alert-circle" style={{ marginRight: 4 }} />{error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 4px', borderTop: '1px solid var(--border)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your tasks, or ask me to add a task, page, note, or event…"
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', background: 'var(--bg)',
            color: 'var(--text)', maxHeight: 120, minHeight: 40,
          }}
        />
        <button onClick={send} disabled={sending || !input.trim()} style={{
          border: 'none', borderRadius: 10, padding: '0 16px', background: 'var(--accent)',
          color: '#fff', cursor: sending || !input.trim() ? 'default' : 'pointer',
          opacity: sending || !input.trim() ? 0.5 : 1, fontSize: 14, fontWeight: 600,
        }}>
          <i className="ti ti-send" />
        </button>
      </div>
    </div>
  )
}
