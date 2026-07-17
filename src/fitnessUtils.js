// Shared fitness helpers: GPX parsing, Strava polyline decoding, formatting.

export function fmtKm(n) { return n == null ? '—' : `${Number(n).toFixed(2)} km` }
export function fmtDur(sec) {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}
export function fmtPace(distanceKm, movingSec) {
  if (!distanceKm || !movingSec) return '—'
  const secPerKm = movingSec / distanceKm
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export const ACTIVITY_ICONS = {
  Run: 'ti-run', TrailRun: 'ti-run', Ride: 'ti-bike', MountainBikeRide: 'ti-bike', GravelRide: 'ti-bike',
  VirtualRide: 'ti-bike', Walk: 'ti-walk', Hike: 'ti-trekking', Swim: 'ti-swimming',
  WeightTraining: 'ti-barbell', Workout: 'ti-stretching', Yoga: 'ti-yoga',
}
export function activityIcon(type) { return ACTIVITY_ICONS[type] || 'ti-activity' }

// Parse GPX XML → { points: [{lat, lon, ele, time}], name }
export function parseGpx(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Not a valid GPX file')
  const name = doc.querySelector('trk > name, metadata > name')?.textContent || 'Imported route'
  const pts = [...doc.querySelectorAll('trkpt')].map(pt => ({
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon')),
    ele: pt.querySelector('ele') ? parseFloat(pt.querySelector('ele').textContent) : null,
    time: pt.querySelector('time')?.textContent || null,
  })).filter(p => !isNaN(p.lat) && !isNaN(p.lon))
  if (!pts.length) throw new Error('No track points found in this GPX file')
  return { name, points: pts }
}

// Haversine distance (km) over a points array
export function gpxStats(points) {
  let dist = 0, gain = 0
  for (let i = 1; i < points.length; i++) {
    dist += haversine(points[i - 1], points[i])
    if (points[i].ele != null && points[i - 1].ele != null) {
      const d = points[i].ele - points[i - 1].ele
      if (d > 0) gain += d
    }
  }
  let movingSec = null
  const t0 = points[0].time ? new Date(points[0].time) : null
  const t1 = points[points.length - 1].time ? new Date(points[points.length - 1].time) : null
  if (t0 && t1 && !isNaN(t0) && !isNaN(t1)) movingSec = Math.max(0, (t1 - t0) / 1000)
  return { distanceKm: dist, elevationM: gain, movingSec, startTime: t0 }
}
function haversine(a, b) {
  const R = 6371, toRad = x => x * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ── Auto-segmentation: detect activity-type changes within one GPX track ──
// Classifies each point by a smoothed local speed, then merges consecutive
// same-type points into segments (folding very short blips into a
// neighbor), so a single recording that includes e.g. a walk to the
// trailhead + a run + cooldown walk gets split into separate typed
// activities instead of being imported as one blended blob.
const SPEED_THRESHOLDS_KMH = { walk: 6.5, run: 15 } // <6.5 Walk, 6.5–15 Run, >15 Ride
const MIN_SEGMENT_SEC = 90 // segments shorter than this get folded into a neighbor

function classifySpeed(kmh) {
  if (kmh < SPEED_THRESHOLDS_KMH.walk) return 'Walk'
  if (kmh < SPEED_THRESHOLDS_KMH.run) return 'Run'
  return 'Ride'
}

export function segmentActivity(points) {
  if (points.length < 3 || !points.every(p => p.time)) {
    // No timestamps (or too few points) to compute speed — treat as one segment
    const stats = gpxStats(points)
    return [{ type: 'Run', points, ...stats }]
  }

  // Smoothed instantaneous speed per point (rolling window over ~5 points)
  const speeds = points.map(() => 0)
  for (let i = 1; i < points.length; i++) {
    const dt = (new Date(points[i].time) - new Date(points[i - 1].time)) / 1000
    if (dt <= 0) { speeds[i] = speeds[i - 1]; continue }
    const dKm = haversine(points[i - 1], points[i])
    speeds[i] = (dKm / dt) * 3600 // km/h
  }
  const window = 5
  const smoothed = speeds.map((_, i) => {
    const lo = Math.max(0, i - window), hi = Math.min(speeds.length, i + window + 1)
    const slice = speeds.slice(lo, hi)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
  const types = smoothed.map(classifySpeed)

  // Merge into runs of the same type
  let raw = []
  let start = 0
  for (let i = 1; i <= types.length; i++) {
    if (i === types.length || types[i] !== types[start]) {
      raw.push({ type: types[start], startIdx: start, endIdx: i - 1 })
      start = i
    }
  }

  // Fold segments shorter than MIN_SEGMENT_SEC into the longer neighbor
  const segDur = s => (new Date(points[s.endIdx].time) - new Date(points[s.startIdx].time)) / 1000
  let changed = true
  while (changed && raw.length > 1) {
    changed = false
    for (let i = 0; i < raw.length; i++) {
      if (segDur(raw[i]) < MIN_SEGMENT_SEC) {
        const prev = raw[i - 1], next = raw[i + 1]
        const target = prev && (!next || segDur(prev) >= segDur(next)) ? prev : next
        if (target) {
          target.startIdx = Math.min(target.startIdx, raw[i].startIdx)
          target.endIdx = Math.max(target.endIdx, raw[i].endIdx)
          raw.splice(i, 1)
          changed = true
          break
        }
      }
    }
  }
  // Re-merge any now-adjacent same-type segments
  const merged = []
  for (const seg of raw) {
    const last = merged[merged.length - 1]
    if (last && last.type === seg.type && last.endIdx >= seg.startIdx - 1) last.endIdx = seg.endIdx
    else merged.push({ ...seg })
  }

  return merged.map(seg => {
    const segPoints = points.slice(seg.startIdx, seg.endIdx + 1)
    const stats = gpxStats(segPoints)
    return { type: seg.type, points: segPoints, ...stats }
  })
}

// Decode a Strava/Google encoded polyline → [{lat, lon}]
export function decodePolyline(str) {
  if (!str) return []
  const points = []
  let index = 0, lat = 0, lon = 0
  while (index < str.length) {
    for (const which of ['lat', 'lon']) {
      let shift = 0, result = 0, byte
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      const delta = (result & 1) ? ~(result >> 1) : (result >> 1)
      if (which === 'lat') lat += delta; else lon += delta
    }
    points.push({ lat: lat / 1e5, lon: lon / 1e5 })
  }
  return points
}

// Build a minimal GPX XML from points (for exporting)
export function buildGpx(name, points) {
  const trkpts = points.map(p =>
    `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele != null ? `<ele>${p.ele}</ele>` : ''}${p.time ? `<time>${p.time}</time>` : ''}</trkpt>`
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="AllPurposeApp" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name.replace(/[<>&]/g, '')}</name><trkseg>${trkpts}</trkseg></trk></gpx>`
}

// Load Leaflet from CDN once, resolve with the global L
let leafletPromise = null
export function loadLeaflet() {
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L)
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve(window.L)
    script.onerror = () => reject(new Error('Could not load the map library'))
    document.head.appendChild(script)
  })
  return leafletPromise
}
