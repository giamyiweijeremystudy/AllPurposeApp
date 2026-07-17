// Strava OAuth + sync proxy. The client secret lives only here (env vars).
// Actions (POST JSON { action, ... }):
//   config   → { clientId } so the client can build the authorize URL
//   exchange → { code } → tokens + athlete (client stores them via its own
//              RLS-protected supabase session)
//   refresh  → { refreshToken } → fresh tokens
//   sync     → { accessToken } → activities from the last 2 days, normalized
//
// Requires STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Vercel env vars.
// Create an API application at https://www.strava.com/settings/api —
// set the Authorization Callback Domain to your app's domain.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  const { action } = req.body || {}

  if (action === 'config') {
    if (!clientId) return res.status(500).json({ error: 'Strava is not configured yet. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Vercel env vars (create an app at strava.com/settings/api).' })
    return res.status(200).json({ clientId })
  }
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Strava is not configured yet. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Vercel env vars.' })
  }

  try {
    if (action === 'exchange') {
      const { code } = req.body
      if (!code) return res.status(400).json({ error: 'code is required' })
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data?.message || 'Token exchange failed' })
      return res.status(200).json({
        accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at,
        athleteId: data.athlete?.id, athleteName: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' '),
      })
    }

    if (action === 'refresh') {
      const { refreshToken } = req.body
      if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' })
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data?.message || 'Token refresh failed' })
      return res.status(200).json({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at })
    }

    if (action === 'sync') {
      const { accessToken } = req.body
      if (!accessToken) return res.status(400).json({ error: 'accessToken is required' })
      const after = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60 // last 2 days
      const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data?.message || 'Could not fetch activities (token may be expired)' })

      const activities = (Array.isArray(data) ? data : []).map(a => ({
        strava_id: a.id,
        name: a.name || 'Activity',
        type: a.sport_type || a.type || 'Workout',
        start_at: a.start_date,
        distance_km: a.distance != null ? a.distance / 1000 : null,
        moving_sec: a.moving_time ?? null,
        elapsed_sec: a.elapsed_time ?? null,
        elevation_m: a.total_elevation_gain ?? null,
        avg_speed_kmh: a.average_speed != null ? a.average_speed * 3.6 : null,
        avg_hr: a.average_heartrate ?? null,
        calories: a.kilojoules != null ? a.kilojoules : null,
        cadence: a.average_cadence ?? null,
        power_w: a.average_watts ?? null,
        polyline: a.map?.summary_polyline || null, // encoded polyline for route preview
      }))
      return res.status(200).json({ activities })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('strava proxy error', e)
    return res.status(500).json({ error: 'Failed to reach Strava' })
  }
}
