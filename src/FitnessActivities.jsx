import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'
import { FitnessMap } from './FitnessMap.jsx'
import { parseGpx, gpxStats, decodePolyline, buildGpx, fmtKm, fmtDur, fmtPace, activityIcon } from './fitnessUtils.js'

export function FitnessActivities({ appId, userId, activities, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  const types = ['all', ...new Set(activities.map(a => a.type))]
  const visible = activities.filter(a =>
    (typeFilter === 'all' || a.type === typeFilter) &&
    (!search.trim() || a.name.toLowerCase().includes(search.toLowerCase()))
  )

  const importGpx = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true); setMsg('')
    try {
      const xml = await file.text()
      const { name, points } = parseGpx(xml)
      const stats = gpxStats(points)
      const { error } = await supabase.from('fitness_activities').insert({
        app_id: appId, user_id: userId, source: 'gpx', name,
        type: 'Run', start_at: stats.startTime ? stats.startTime.toISOString() : new Date().toISOString(),
        distance_km: stats.distanceKm, moving_sec: stats.movingSec ? Math.round(stats.movingSec) : null,
        elevation_m: stats.elevationM, gpx: xml,
      })
      if (error) throw error
      setMsg(`Imported "${name}" (${stats.distanceKm.toFixed(1)} km)`)
      onChanged()
    } catch (err) { setMsg(`⚠️ ${err.message}`) } finally { setImporting(false) }
  }

  if (detail) return <ActivityDetail activity={detail} onBack={() => setDetail(null)} onChanged={() => { onChanged(); setDetail(null) }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StravaCard appId={appId} userId={userId} onSynced={onChanged} />

      {/* Search + filter + GPX import */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities…"
          style={{ ...inp, flex: '2 1 160px' }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inp, flex: '1 1 100px' }}>
          {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
        </select>
        <input ref={fileRef} type="file" accept=".gpx" onChange={importGpx} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={{
          display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px',
          background: 'var(--bg)', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-file-upload" /> {importing ? 'Importing…' : 'Import GPX'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('⚠') ? 'var(--danger)' : 'var(--success)' }}>{msg}</div>}

      {/* Timeline */}
      {visible.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7, border: '1px dashed var(--border-2)', borderRadius: 'var(--radius-lg)' }}>
          No activities yet.<br />Connect Strava above and sync, or import a GPX file to get started.
        </div>
      ) : visible.map(a => (
        <button key={a.id} className="module-card" onClick={() => setDetail(a)} style={{ padding: 14, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ti ${activityIcon(a.type)}`} style={{ fontSize: 18, color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>{a.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {a.type} · {new Date(a.start_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                {a.source === 'strava' && <> · <i className="ti ti-brand-strava" style={{ color: '#fc4c02' }} /></>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            <Metric label="Distance" value={fmtKm(a.distance_km)} />
            <Metric label="Time" value={fmtDur(a.moving_sec)} />
            <Metric label="Pace" value={fmtPace(a.distance_km, a.moving_sec)} />
            {a.elevation_m != null && <Metric label="Elev" value={`${Math.round(a.elevation_m)} m`} />}
          </div>
        </button>
      ))}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

// ── Strava connection card ───────────────────────────────────
function StravaCard({ appId, userId, onSynced }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('strava_accounts').select('*').eq('user_id', userId).maybeSingle()
    setAccount(data || null); setLoading(false)
  }
  useEffect(() => { if (userId) load() }, [userId])

  // Handle the OAuth redirect (?strava_code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const isStrava = params.get('scope')?.includes('activity') || params.get('strava') === '1'
    if (code && isStrava) {
      window.history.replaceState({}, '', window.location.pathname)
      ;(async () => {
        setMsg('Connecting to Strava…')
        try {
          const r = await fetch('/api/strava', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'exchange', code }) })
          const d = await r.json()
          if (!r.ok) throw new Error(d?.error || 'Connection failed')
          await supabase.from('strava_accounts').upsert({
            user_id: userId, athlete_id: d.athleteId, athlete_name: d.athleteName,
            access_token: d.accessToken, refresh_token: d.refreshToken, expires_at: d.expiresAt,
          })
          setMsg('Connected!')
          load()
        } catch (e) { setMsg(`⚠️ ${e.message}`) }
      })()
    }
  }, [userId])

  const connect = async () => {
    setMsg('')
    try {
      const r = await fetch('/api/strava', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'config' }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Strava not configured')
      const redirect = encodeURIComponent(window.location.origin + window.location.pathname)
      window.location.href = `https://www.strava.com/oauth/authorize?client_id=${d.clientId}&response_type=code&redirect_uri=${redirect}&approval_prompt=auto&scope=read,activity:read_all`
    } catch (e) { setMsg(`⚠️ ${e.message}`) }
  }

  const disconnect = async () => {
    await supabase.from('strava_accounts').delete().eq('user_id', userId)
    setAccount(null)
  }

  const getFreshToken = async () => {
    if (account.expires_at * 1000 > Date.now() + 60_000) return account.access_token
    const r = await fetch('/api/strava', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh', refreshToken: account.refresh_token }) })
    const d = await r.json()
    if (!r.ok) throw new Error(d?.error || 'Could not refresh Strava session — try reconnecting')
    await supabase.from('strava_accounts').update({ access_token: d.accessToken, refresh_token: d.refreshToken, expires_at: d.expiresAt }).eq('user_id', userId)
    setAccount(a => ({ ...a, access_token: d.accessToken, refresh_token: d.refreshToken, expires_at: d.expiresAt }))
    return d.accessToken
  }

  const sync = async () => {
    setSyncing(true); setMsg('Fetching activities from the last 2 days…')
    try {
      const token = await getFreshToken()
      const r = await fetch('/api/strava', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', accessToken: token }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Sync failed')

      // Import new only — skip strava_ids we already have
      const ids = d.activities.map(a => a.strava_id)
      let existing = []
      if (ids.length) {
        const { data } = await supabase.from('fitness_activities').select('strava_id').eq('user_id', userId).in('strava_id', ids)
        existing = (data || []).map(x => String(x.strava_id))
      }
      const fresh = d.activities.filter(a => !existing.includes(String(a.strava_id)))
      if (fresh.length) {
        const rows = fresh.map(({ polyline, ...a }) => ({
          app_id: appId, user_id: userId, source: 'strava', ...a,
          gpx: polyline ? polylineToGpx(a.name, polyline) : null,
        }))
        const { error } = await supabase.from('fitness_activities').insert(rows)
        if (error) throw error
      }
      await supabase.from('strava_accounts').update({ last_sync: new Date().toISOString() }).eq('user_id', userId)
      setAccount(a => ({ ...a, last_sync: new Date().toISOString() }))
      setMsg(fresh.length ? `✅ Imported ${fresh.length} new activit${fresh.length === 1 ? 'y' : 'ies'}.` : 'Already up to date — no new activities in the last 2 days.')
      if (fresh.length) onSynced()
    } catch (e) { setMsg(`⚠️ ${e.message}`) } finally { setSyncing(false) }
  }

  if (loading) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg)', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <i className="ti ti-brand-strava" style={{ fontSize: 22, color: '#fc4c02' }} />
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{account ? `Connected — ${account.athlete_name || 'Strava athlete'}` : 'Strava'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {account
              ? account.last_sync ? `Last synced ${new Date(account.last_sync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Never synced'
              : 'Connect to import your activities'}
          </div>
        </div>
        {account ? (
          <>
            <button onClick={sync} disabled={syncing} style={{
              display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '9px 14px',
              background: 'var(--accent-grad)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--glow)',
            }}>
              <i className={`ti ${syncing ? 'ti-loader-2 spin' : 'ti-refresh'}`} /> {syncing ? 'Syncing…' : 'Sync Strava activities'}
            </button>
            <button onClick={disconnect} title="Disconnect" style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14 }}>
              <i className="ti ti-plug-off" />
            </button>
          </>
        ) : (
          <button onClick={connect} style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '9px 14px',
            background: '#fc4c02', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}>
            Connect Strava
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12.5, marginTop: 8, color: msg.startsWith('⚠') ? 'var(--danger)' : 'var(--text-2)' }}>{msg}</div>}
    </div>
  )
}

// Convert an encoded polyline into minimal GPX so the map component can render it
function polylineToGpx(name, polyline) {
  const pts = decodePolyline(polyline)
  if (!pts.length) return null
  return buildGpx(name, pts)
}

// ── Activity detail ──────────────────────────────────────────
function ActivityDetail({ activity, onBack, onChanged }) {
  const [points, setPoints] = useState(null)
  const [notes, setNotes] = useState(activity.notes || '')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (activity.gpx) {
      try { setPoints(parseGpx(activity.gpx).points) } catch { setPoints(null) }
    }
  }, [activity])

  const saveNotes = async () => {
    await supabase.from('fitness_activities').update({ notes }).eq('id', activity.id)
  }
  const del = async () => {
    await supabase.from('fitness_activities').delete().eq('id', activity.id)
    onChanged()
  }
  const exportGpx = () => {
    const blob = new Blob([activity.gpx], { type: 'application/gpx+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${activity.name.replace(/[^a-z0-9]+/gi, '_')}.gpx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 0' }}>
        <i className="ti ti-arrow-left" /> All activities
      </button>

      <div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{activity.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
          {activity.type} · {new Date(activity.start_at).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {activity.source !== 'manual' && ` · via ${activity.source}`}
        </div>
      </div>

      {points && <FitnessMap points={points} height={300} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        <DetailStat label="Distance" value={fmtKm(activity.distance_km)} />
        <DetailStat label="Moving time" value={fmtDur(activity.moving_sec)} />
        <DetailStat label="Elapsed" value={fmtDur(activity.elapsed_sec)} />
        <DetailStat label="Pace" value={fmtPace(activity.distance_km, activity.moving_sec)} />
        {activity.avg_speed_kmh != null && <DetailStat label="Avg speed" value={`${Number(activity.avg_speed_kmh).toFixed(1)} km/h`} />}
        {activity.elevation_m != null && <DetailStat label="Elevation" value={`${Math.round(activity.elevation_m)} m`} />}
        {activity.avg_hr != null && <DetailStat label="Avg HR" value={`${Math.round(activity.avg_hr)} bpm`} />}
        {activity.calories != null && <DetailStat label="Energy" value={`${Math.round(activity.calories)} kJ`} />}
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} rows={3}
          placeholder="How did it feel?"
          style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {activity.gpx && (
          <button onClick={exportGpx} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', background: 'var(--bg)', color: 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <i className="ti ti-download" /> Export GPX
          </button>
        )}
        <div style={{ flex: 1 }} />
        {confirming ? (
          <>
            <button onClick={del} style={{ border: 'none', borderRadius: 8, padding: '9px 14px', background: 'var(--danger)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Confirm delete</button>
            <button onClick={() => setConfirming(false)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', background: 'transparent', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', background: 'transparent', color: 'var(--danger)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <i className="ti ti-trash" /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

function DetailStat({ label, value }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  )
}

const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', fontSize: 13.5, background: 'var(--bg)', color: 'var(--text)' }
