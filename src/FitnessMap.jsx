import { useEffect, useRef, useState } from 'react'
import { loadLeaflet } from './fitnessUtils.js'

// Interactive route map (Leaflet via CDN): zoom/pan, fullscreen toggle,
// start/finish markers, km distance markers, optional elevation profile.
export function FitnessMap({ points, height = 260 }) {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!points?.length) return
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

      // Start / finish markers
      const startIcon = L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#30a46c;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
      const endIcon = L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#e5484d;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
      L.marker(latlngs[0], { icon: startIcon }).addTo(map)
      L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(map)

      // Distance markers every km
      let acc = 0, next = 1
      const toRad = x => x * Math.PI / 180
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
        acc += 2 * 6371 * Math.asin(Math.sqrt(h))
        if (acc >= next) {
          const km = next
          L.marker([b.lat, b.lon], {
            icon: L.divIcon({
              html: `<div style="background:#5b5bf6;color:#fff;border-radius:8px;padding:1px 5px;font-size:10px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${km}</div>`,
              className: '', iconSize: [22, 16], iconAnchor: [11, 8],
            }),
          }).addTo(map)
          next++
        }
      }
      setTimeout(() => map.invalidateSize(), 60)
    }).catch(e => setError(e.message))
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [points, fullscreen])

  const elevations = (points || []).map(p => p.ele).filter(e => e != null)
  const hasEle = elevations.length > 10

  if (error) return <div style={{ padding: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>
  if (!points?.length) return null

  return (
    <div style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } : {}}>
      <div style={{ position: 'relative', flex: fullscreen ? 1 : undefined }}>
        <div ref={mapEl} style={{ height: fullscreen ? '100%' : height, borderRadius: fullscreen ? 0 : 12, overflow: 'hidden', width: '100%' }} />
        <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1000, border: 'none', borderRadius: 8, width: 34, height: 34,
          background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', boxShadow: 'var(--shadow-lg)', fontSize: 15,
        }}>
          <i className={`ti ${fullscreen ? 'ti-arrows-minimize' : 'ti-arrows-maximize'}`} />
        </button>
      </div>
      {hasEle && !fullscreen && <ElevationProfile elevations={elevations} />}
    </div>
  )
}

function ElevationProfile({ elevations }) {
  const w = 600, h = 70
  const min = Math.min(...elevations), max = Math.max(...elevations)
  const range = Math.max(1, max - min)
  const step = w / (elevations.length - 1)
  const pts = elevations.map((e, i) => `${(i * step).toFixed(1)},${(h - ((e - min) / range) * (h - 10) - 5).toFixed(1)}`).join(' ')
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 4 }}>
        Elevation · {Math.round(min)}–{Math.round(max)} m
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60, display: 'block' }} preserveAspectRatio="none">
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill="var(--accent-soft)" stroke="none" />
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      </svg>
    </div>
  )
}
