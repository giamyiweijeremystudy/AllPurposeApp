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
