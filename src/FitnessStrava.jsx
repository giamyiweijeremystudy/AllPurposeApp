import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { decodePolyline, buildGpx } from './fitnessUtils.js'

// PRESERVED BUT NOT WIRED IN — Strava sync was removed from the live UI
// (no paid/external account required for the app to work), but this is
// kept intact in case it's reimplemented later. To bring it back:
//   1. Re-add api/strava.js (already restored) and set STRAVA_CLIENT_ID /
//      STRAVA_CLIENT_SECRET in Vercel env vars.
//   2. Recreate the strava_accounts table (see git history commit
//      "Add Fitness hub..." for the original CREATE TABLE statement).
//   3. Import { StravaCard } from './FitnessStrava.jsx' in
//      FitnessActivities.jsx and render <StravaCard appId={appId}
//      userId={userId} onSynced={onChanged} /> above the search bar.

// ── Strava connection card ───────────────────────────────────
export function StravaCard({ appId, userId, onSynced }) {
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

