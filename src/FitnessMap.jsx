import { useEffect, useRef, useState } from 'react'
import { loadLeaflet, fmtDur, fmtPace } from './fitnessUtils.js'

const REPLAY_WALL_SECONDS = 20 // whole route compressed into this many real seconds of playback
const FOLLOW_ZOOM = 17 // how close the camera zooms in while following the blob

let pulseStyleInjected = false
function ensurePulseStyle() {
  if (pulseStyleInjected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.textContent = `
    @keyframes fitness-blob-pulse {
      0% { transform: scale(0.6); opacity: 0.55; }
      70% { transform: scale(1.9); opacity: 0; }
      100% { transform: scale(1.9); opacity: 0; }
    }`
  document.head.appendChild(style)
  pulseStyleInjected = true
}

function haversineKm(a, b) {
  const R = 6371, toRad = x => x * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
function lerp(a, b, t) { return a + (b - a) * t }

// Precompute cumulative distance (km) at every point — shared by the
// replay's live distance readout and the elevation chart's tooltip.
function cumulativeDistances(points) {
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]))
  return cum
}

// Interactive route map (Leaflet via CDN): zoom/pan, fullscreen toggle,
// start/finish markers, km distance markers, an elevation profile with a
// hover/drag tooltip, and an opt-in animated route replay — camera follows
// the blob zoomed in, with live distance/elevation readouts.
export function FitnessMap({ points, height = 260 }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const blobRef = useRef(null)
  const rafRef = useRef(null)
  const startWallRef = useRef(0)
  const savedViewRef = useRef(null) // {center, zoom} to restore when replay ends
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState('')

  const [replayOn, setReplayOn] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [live, setLive] = useState(null) // { distKm, ele }

  const distCumRef = useRef(null)
  useEffect(() => { distCumRef.current = points?.length ? cumulativeDistances(points) : null }, [points])

  // Time-normalized timeline so the blob's on-screen speed reflects real
  // pace (lingers during slow/rest stretches, dashes through fast ones).
  const timelineRef = useRef(null)
  useEffect(() => {
    if (!points?.length) { timelineRef.current = null; return }
    const hasTime = points.every(p => p.time)
    if (hasTime) {
      const t0 = new Date(points[0].time).getTime()
      const cum = points.map(p => (new Date(p.time).getTime() - t0) / 1000)
      timelineRef.current = { hasTime: true, cum, total: cum[cum.length - 1] || 1 }
    } else {
      timelineRef.current = { hasTime: false, total: points.length - 1 }
    }
  }, [points])

  // Position + live stats (distance, elevation, elapsed time, pace) at a
  // given fraction of the route
  const stateAt = (frac) => {
    const tl = timelineRef.current
    const cumDist = distCumRef.current
    if (!tl || !points?.length) return null
    let lo, hi, local
    if (tl.hasTime) {
      const target = frac * tl.total
      lo = 0; hi = tl.cum.length - 1
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (tl.cum[mid] <= target) lo = mid; else hi = mid }
      const span = tl.cum[hi] - tl.cum[lo] || 1
      local = Math.min(1, Math.max(0, (target - tl.cum[lo]) / span))
    } else {
      const target = frac * tl.total
      lo = Math.floor(target); hi = Math.min(points.length - 1, lo + 1)
      local = target - lo
    }
    const a = points[lo], b = points[hi]
    const distKm = cumDist ? lerp(cumDist[lo], cumDist[hi], local) : null
    const elapsedSec = tl.hasTime ? lerp(tl.cum[lo], tl.cum[hi], local) : null
    return {
      lat: lerp(a.lat, b.lat, local), lon: lerp(a.lon, b.lon, local),
      ele: (a.ele != null && b.ele != null) ? lerp(a.ele, b.ele, local) : (a.ele ?? b.ele ?? null),
      distKm, elapsedSec,
      paceLabel: (elapsedSec && distKm) ? fmtPace(distKm, elapsedSec) : null,
    }
  }

  // Init / rebuild the map whenever points or fullscreen changes
  useEffect(() => {
    let cancelled = false
    if (!points?.length) return
    ensurePulseStyle()
    loadLeaflet().then(L => {
      if (cancelled || !mapEl.current) return
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true })
      mapRef.current = map
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap contributors',
      }).addTo(map)
      const latlngs = points.map(p => [p.lat, p.lon])
      const line = L.polyline(latlngs, { color: '#5b5bf6', weight: 4, opacity: 0.9 }).addTo(map)
      map.fitBounds(line.getBounds(), { padding: [24, 24] })

      const startIcon = L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#30a46c;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
      const endIcon = L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#e5484d;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
      L.marker(latlngs[0], { icon: startIcon }).addTo(map)
      L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map)

      let acc = 0, next = 1
      for (let i = 1; i < points.length; i++) {
        acc += haversineKm(points[i - 1], points[i])
        if (acc >= next) {
          const km = next
          L.marker([points[i].lat, points[i].lon], {
            icon: L.divIcon({
              html: `<div style="background:#5b5bf6;color:#fff;border-radius:8px;padding:1px 5px;font-size:10px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${km}</div>`,
              className: '', iconSize: [22, 16], iconAnchor: [11, 8],
            }),
          }).addTo(map)
          next++
        }
      }

      // Replay blob (created hidden; shown when replay mode is toggled on)
      const blobIcon = L.divIcon({
        html: `<div style="position:relative;width:16px;height:16px;">
                 <div style="position:absolute;inset:0;border-radius:50%;background:#5b5bf6;animation:fitness-blob-pulse 1.4s ease-out infinite;"></div>
                 <div style="position:absolute;inset:2px;border-radius:50%;background:#5b5bf6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>
               </div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      })
      const blob = L.marker(latlngs[0], { icon: blobIcon, zIndexOffset: 1000 })
      blobRef.current = blob

      setTimeout(() => map.invalidateSize(), 60)
    }).catch(e => setError(e.message))
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [points, fullscreen])

  // Toggling replay: show/hide the blob, and save/restore the map view so
  // turning replay off returns to the full-route overview.
  useEffect(() => {
    const map = mapRef.current, blob = blobRef.current
    if (!map || !blob) return
    if (replayOn) {
      savedViewRef.current = { center: map.getCenter(), zoom: map.getZoom() }
      blob.addTo(map)
    } else {
      blob.remove()
      if (savedViewRef.current) map.setView(savedViewRef.current.center, savedViewRef.current.zoom, { animate: true })
    }
  }, [replayOn])

  // Keep the blob positioned + camera following + live stats updated
  // whenever progress changes (from the RAF loop, or a manual slider drag)
  useEffect(() => {
    if (!replayOn || !blobRef.current) return
    const s = stateAt(progress)
    if (!s) return
    blobRef.current.setLatLng([s.lat, s.lon])
    setLive({ distKm: s.distKm, ele: s.ele, elapsedSec: s.elapsedSec, paceLabel: s.paceLabel })
    if (mapRef.current) mapRef.current.setView([s.lat, s.lon], FOLLOW_ZOOM, { animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, replayOn, points])

  // Playback loop
  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return }
    startWallRef.current = performance.now() - progress * REPLAY_WALL_SECONDS * 1000
    const tick = (now) => {
      const elapsed = (now - startWallRef.current) / 1000
      const frac = Math.min(1, elapsed / REPLAY_WALL_SECONDS)
      setProgress(frac)
      if (frac >= 1) { setPlaying(false); return }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const togglePlay = () => {
    if (!playing && progress >= 1) setProgress(0)
    setPlaying(p => !p)
  }
  const scrub = (v) => { setPlaying(false); setProgress(v) }

  const elevPoints = (points || []).filter(p => p.ele != null)
  const hasEle = elevPoints.length > 10

  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>
  if (!points?.length) return null

  return (
    <div style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } : {}}>
      <div style={{ position: 'relative', flex: fullscreen ? 1 : undefined }}>
        <div ref={mapEl} style={{ height: fullscreen ? '100%' : height, borderRadius: fullscreen ? 0 : 12, overflow: 'hidden', width: '100%' }} />
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 6 }}>
          <button onClick={() => setReplayOn(r => !r)} title="Route replay" style={{
            border: 'none', borderRadius: 8, height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5,
            background: replayOn ? 'var(--accent)' : 'var(--bg)', color: replayOn ? '#fff' : 'var(--text)',
            cursor: 'pointer', boxShadow: 'var(--shadow-lg)', fontSize: 12.5, fontWeight: 600,
          }}>
            <i className="ti ti-map-pin-share" /> Replay
          </button>
          <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} style={{
            border: 'none', borderRadius: 8, width: 34, height: 34,
            background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', boxShadow: 'var(--shadow-lg)', fontSize: 15,
          }}>
            <i className={`ti ${fullscreen ? 'ti-arrows-minimize' : 'ti-arrows-maximize'}`} />
          </button>
        </div>

        {replayOn && live && (
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 1000,
            background: 'var(--bg)', borderRadius: 10, padding: '7px 12px', boxShadow: 'var(--shadow-lg)',
            display: 'flex', gap: 14, flexWrap: 'wrap', maxWidth: 'calc(100% - 20px)',
          }}>
            <LiveStat label="Distance" value={live.distKm != null ? `${live.distKm.toFixed(2)} km` : '—'} />
            {live.elapsedSec != null && <LiveStat label="Time" value={fmtDur(Math.round(live.elapsedSec))} />}
            {live.paceLabel && <LiveStat label="Pace" value={live.paceLabel} />}
            {live.ele != null && <LiveStat label="Elevation" value={`${Math.round(live.ele)} m`} />}
          </div>
        )}

        {replayOn && (
          <div style={{
            position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 1000,
            background: 'var(--bg)', borderRadius: 10, padding: '8px 10px', boxShadow: 'var(--shadow-lg)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <button onClick={togglePlay} style={{
              border: 'none', borderRadius: '50%', width: 30, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent-grad)', color: '#fff', cursor: 'pointer', fontSize: 13,
            }}>
              <i className={`ti ${playing ? 'ti-player-pause-filled' : 'ti-player-play-filled'}`} />
            </button>
            <input
              type="range" min={0} max={1000} value={Math.round(progress * 1000)}
              onChange={e => scrub(Number(e.target.value) / 1000)}
              style={{ flex: 1, accentColor: '#5b5bf6', cursor: 'pointer' }}
            />
          </div>
        )}
      </div>
      {hasEle && !fullscreen && <ElevationProfile points={elevPoints} />}
    </div>
  )
}

function LiveStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  )
}

// Elevation profile with a hover (mouse) / drag (touch) tooltip showing the
// elevation — and distance along the route — at the cursor's position.
function ElevationProfile({ points }) {
  const svgRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)
  const w = 600, h = 70

  const elevations = points.map(p => p.ele)
  const cumDist = cumulativeDistances(points)
  const min = Math.min(...elevations), max = Math.max(...elevations)
  const range = Math.max(1, max - min)
  const step = w / (elevations.length - 1)
  const xAt = i => i * step
  const yAt = e => h - ((e - min) / range) * (h - 10) - 5
  const pts = elevations.map((e, i) => `${xAt(i).toFixed(1)},${yAt(e).toFixed(1)}`).join(' ')

  const updateHover = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect()
    const relX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const idx = Math.round(relX * (elevations.length - 1))
    setHoverIdx(idx)
  }
  const onMove = e => updateHover(e.clientX)
  const onTouchMove = e => { if (e.touches[0]) { updateHover(e.touches[0].clientX); e.preventDefault() } }
  const clear = () => setHoverIdx(null)

  const hover = hoverIdx != null ? { x: xAt(hoverIdx), ele: elevations[hoverIdx], dist: cumDist[hoverIdx] } : null

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>Elevation · {Math.round(min)}–{Math.round(max)} m</span>
        {hover && <span style={{ color: 'var(--text)', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>{Math.round(hover.ele)} m at {hover.dist.toFixed(2)} km</span>}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={clear}
        onTouchMove={onTouchMove} onTouchEnd={clear} onTouchStart={onTouchMove}
      >
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill="var(--accent-soft)" stroke="none" />
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        {hover && (
          <>
            <line x1={hover.x} y1={0} x2={hover.x} y2={h} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={hover.x} cy={yAt(hover.ele)} r="4" fill="var(--accent)" stroke="white" strokeWidth="1.5" />
          </>
        )}
      </svg>
    </div>
  )
}
