import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase.js'
import { fmtDur } from './fitnessUtils.js'

// Compact snapshot of the user's fitness data for the AI coach.
function buildContext(workouts, activities) {
  const lines = []
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0)
  const wThisWeek = workouts.filter(w => new Date(w.performed_at) >= weekStart)
  const aThisWeek = activities.filter(a => new Date(a.start_at) >= weekStart)
  lines.push(`Today: ${now.toDateString()}. This week so far: ${wThisWeek.length} logged workouts, ${aThisWeek.length} activities.`)
  if (workouts.length) {
    lines.push('Recent workouts (newest first):')
    for (const w of workouts.slice(0, 40)) {
      const bits = []
      if (w.sets && w.reps) bits.push(`${w.sets}x${w.reps}`)
      else if (w.reps) bits.push(`${w.reps} reps`)
      if (w.weight_kg) bits.push(`${w.weight_kg}kg`)
      if (w.distance_km) bits.push(`${Number(w.distance_km).toFixed(1)}km`)
      if (w.duration_min) bits.push(`${w.duration_min}min`)
      lines.push(`- ${new Date(w.performed_at).toISOString().slice(0, 10)} ${w.custom_name || w.exercise}: ${bits.join(' ') || 'logged'}${w.notes ? ` (${w.notes})` : ''}`)
    }
  }
  if (activities.length) {
    lines.push('Recent activities (newest first):')
    for (const a of activities.slice(0, 30)) {
      lines.push(`- ${new Date(a.start_at).toISOString().slice(0, 10)} ${a.type} "${a.name}": ${a.distance_km ? Number(a.distance_km).toFixed(1) + 'km' : ''} ${a.moving_sec ? fmtDur(a.moving_sec) : ''} ${a.elevation_m ? Math.round(a.elevation_m) + 'm elev' : ''} ${a.avg_hr ? Math.round(a.avg_hr) + 'bpm' : ''}`.trim())
    }
  }
  if (!workouts.length && !activities.length) lines.push('No fitness data logged yet.')
  return lines.join('\n')
}

export function FitnessCoach({ appId, userId, workouts, activities, onChanged }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey! I'm your AI fitness coach. I can see your workout history — ask me to analyze your week, build a training plan, spot plateaus, suggest recovery, or just log a workout for you ('I did 3x15 push-ups')." }
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  const callApi = async (msgs, pendingFunctionResults) => {
    const res = await fetch('/api/fitness-assist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
        context: buildContext(workouts, activities),
        pendingFunctionResults,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Something went wrong')
    return data
  }

  const executeCall = async (fc) => {
    if (fc.name !== 'log_workout') return { ok: false, summary: `Unknown action: ${fc.name}` }
    const a = fc.args
    const valid = ['pushups', 'situps', 'pullups', 'running', 'cycling', 'strength', 'custom']
    const exercise = valid.includes(a.exercise) ? a.exercise : 'custom'
    const num = v => v == null ? null : Number(v)
    const { error } = await supabase.from('workouts').insert({
      app_id: appId, user_id: userId, exercise,
      custom_name: a.custom_name || (exercise === 'custom' ? a.exercise : ''),
      sets: num(a.sets), reps: num(a.reps), weight_kg: num(a.weight_kg),
      duration_min: num(a.duration_min), distance_km: num(a.distance_km),
      performed_at: a.performed_at || new Date().toISOString(),
      notes: a.notes || '',
    })
    if (error) return { ok: false, summary: error.message }
    onChanged?.()
    return { ok: true, summary: `Logged ${a.custom_name || exercise}.` }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 380 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%',
            background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)', color: m.role === 'user' ? '#fff' : 'var(--text)',
            borderRadius: 12, padding: '9px 12px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
          }}>{m.content}</div>
        ))}
        {busy && <div style={{ alignSelf: 'flex-start', color: 'var(--text-3)', fontSize: 13, padding: '4px 8px' }}><i className="ti ti-loader-2 spin" /> Thinking…</div>}
        {error && <div style={{ alignSelf: 'flex-start', color: 'var(--danger)', fontSize: 12.5, padding: '4px 8px' }}><i className="ti ti-alert-circle" /> {error}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask your coach, or describe a workout to log it…"
          style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }} />
        <button onClick={send} disabled={busy || !input.trim()} style={{
          border: 'none', borderRadius: 10, padding: '0 16px', background: 'var(--accent)', color: '#fff',
          cursor: busy || !input.trim() ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, fontSize: 14, fontWeight: 600,
        }}><i className="ti ti-send" /></button>
      </div>
    </div>
  )
}
