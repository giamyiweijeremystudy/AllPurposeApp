import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'
import { FitnessMap } from './FitnessMap.jsx'
import { parseGpx, gpxStats, segmentActivity, buildGpx, fmtKm, fmtDur, fmtPace, activityIcon } from './fitnessUtils.js'
import { Sheet, FieldGrid, sheetInputStyle } from './FitnessSheet.jsx'

const ACTIVITY_TYPES = ['Run', 'TrailRun', 'Ride', 'MountainBikeRide', 'GravelRide', 'Walk', 'Hike', 'Swim', 'WeightTraining', 'Workout', 'Yoga']

export function FitnessActivities({ appId, userId, activities, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [manualModal, setManualModal] = useState(false)
  const [segmentReview, setSegmentReview] = useState(null) // { name, segments } pending confirm
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState('')

  const types = ['all', ...new Set(activities.map(a => a.type))]
  const visible = activities.filter(a =>
    (typeFilter === 'all' || a.type === typeFilter) &&
    (!search.trim() || a.name.toLowerCase().includes(search.toLowerCase()))
  )

  const insertSegments = async (name, segments, xmlByIndex) => {
    const rows = segments.map((seg, i) => ({
      app_id: appId, user_id: userId, source: 'gpx',
      name: segments.length > 1 ? `${name} — ${seg.type} ${i + 1}` : name,
      type: seg.type, start_at: (seg.startTime || new Date()).toISOString(),
      distance_km: seg.distanceKm, moving_sec: seg.movingSec ? Math.round(seg.movingSec) : null,
      elevation_m: seg.elevationM, gpx: xmlByIndex[i],
    }))
    const { error } = await supabase.from('fitness_activities').insert(rows)
    if (error) throw error
    return rows.length
  }

  const importGpx = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true); setMsg('')
    try {
      const xml = await file.text()
      const { name, points } = parseGpx(xml)
      const segments = segmentActivity(points)
      const xmlByIndex = segments.map(seg => buildGpx(name, seg.points))

      if (segments.length > 1) {
        // Multiple activity types detected in one recording — let the user
        // confirm/adjust before splitting it into separate activities.
        setSegmentReview({ name, segments, xmlByIndex })
        setImporting(false)
        return
      }
      const count = await insertSegments(name, segments, xmlByIndex)
      setMsg(`Imported "${name}" (${segments[0].distanceKm.toFixed(1)} km, ${segments[0].type.toLowerCase()})`)
      onChanged()
    } catch (err) { setMsg(`⚠️ ${err.message}`) } finally { setImporting(false) }
  }

  if (detail) return <ActivityDetail activity={detail} onBack={() => setDetail(null)} onChanged={() => { onChanged(); setDetail(null) }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search + filter + import/log */}
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
        <button onClick={() => setManualModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8, padding: '9px 12px',
          background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-plus" /> Log activity
        </button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: msg.startsWith('⚠') ? 'var(--danger)' : 'var(--success)' }}>{msg}</div>}

      {/* Timeline */}
      {visible.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.7, border: '1px dashed var(--border-2)', borderRadius: 'var(--radius-lg)' }}>
          No activities yet.<br />Import a GPX file, or log one manually with the button above.
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
                {a.source === 'gpx' && ' · GPX'}
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

      {manualModal && (
        <ManualActivityModal appId={appId} userId={userId} onClose={() => setManualModal(false)} onSaved={() => { setManualModal(false); onChanged() }} />
      )}

      {segmentReview && (
        <SegmentReviewModal
          review={segmentReview}
          onCancel={() => setSegmentReview(null)}
          onConfirm={async (segments) => {
            setImporting(true)
            try {
              const xmlByIndex = segments.map(seg => buildGpx(segmentReview.name, seg.points))
              const count = await insertSegments(segmentReview.name, segments, xmlByIndex)
              setMsg(`Imported ${count} activities from "${segmentReview.name}"`)
              onChanged()
            } catch (err) { setMsg(`⚠️ ${err.message}`) } finally { setImporting(false); setSegmentReview(null) }
          }}
          onImportAsOne={async () => {
            setImporting(true)
            try {
              const allPoints = segmentReview.segments.flatMap(s => s.points)
              const stats = gpxStats(allPoints)
              const single = [{ type: segmentReview.segments[0].type, points: allPoints, ...stats }]
              const xml = [buildGpx(segmentReview.name, allPoints)]
              const count = await insertSegments(segmentReview.name, single, xml)
              setMsg(`Imported "${segmentReview.name}" as one activity`)
              onChanged()
            } catch (err) { setMsg(`⚠️ ${err.message}`) } finally { setImporting(false); setSegmentReview(null) }
          }}
        />
      )}
    </div>
  )
}

// ── Segment review — shown when a GPX recording contains multiple ──
// detected activity types (e.g. walk + run + walk)
function SegmentReviewModal({ review, onCancel, onConfirm, onImportAsOne }) {
  const [segments, setSegments] = useState(review.segments.map(s => ({ ...s })))
  const setType = (i, type) => setSegments(prev => prev.map((s, idx) => idx === i ? { ...s, type } : s))

  return (
    <Sheet title="Multiple activities detected" onClose={onCancel}>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5, marginTop: -4 }}>
        This recording looks like it includes {segments.length} different activities based on pace. Adjust the types below if needed, then import.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px' }}>
            <i className={`ti ${activityIcon(seg.type)}`} style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }} />
            <select value={seg.type} onChange={e => setType(i, e.target.value)} style={{ ...sheetInputStyle, flex: '0 0 110px', padding: '6px 8px', fontSize: 12.5 }}>
              {['Walk', 'Run', 'Ride'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>
              {fmtKm(seg.distanceKm)} · {fmtDur(seg.movingSec)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <button onClick={() => onConfirm(segments)} style={{ border: 'none', borderRadius: 8, padding: '12px 0', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Import as {segments.length} activities
        </button>
        <button onClick={onImportAsOne} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '11px 0', background: 'transparent', color: 'var(--text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          Import as one activity instead
        </button>
        <button onClick={onCancel} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>Cancel</button>
      </div>
    </Sheet>
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

// ── Manual activity entry ────────────────────────────────────
function ManualActivityModal({ appId, userId, onClose, onSaved }) {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const [d, setD] = useState({
    name: '', type: 'Run',
    start_at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    distance_km: '', moving_sec_min: '', elevation_m: '', avg_hr: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setD(x => ({ ...x, [k]: v }))
  const num = v => v === '' || v == null ? null : Number(v)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('fitness_activities').insert({
      app_id: appId, user_id: userId, source: 'manual',
      name: d.name.trim() || d.type, type: d.type, start_at: new Date(d.start_at).toISOString(),
      distance_km: num(d.distance_km), moving_sec: d.moving_sec_min ? Math.round(Number(d.moving_sec_min) * 60) : null,
      elevation_m: num(d.elevation_m), avg_hr: num(d.avg_hr), notes: d.notes.trim(),
    })
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <Sheet title="Log activity" onClose={onClose}>
      <input placeholder="Name (e.g. Morning run)" value={d.name} onChange={e => set('name', e.target.value)} style={sheetInputStyle} autoFocus />
      <FieldGrid>
        <select value={d.type} onChange={e => set('type', e.target.value)} style={sheetInputStyle}>
          {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="datetime-local" value={d.start_at} onChange={e => set('start_at', e.target.value)} style={sheetInputStyle} />
        <input type="number" inputMode="decimal" placeholder="Distance (km)" value={d.distance_km} onChange={e => set('distance_km', e.target.value)} style={sheetInputStyle} />
        <input type="number" inputMode="decimal" placeholder="Duration (min)" value={d.moving_sec_min} onChange={e => set('moving_sec_min', e.target.value)} style={sheetInputStyle} />
        <input type="number" inputMode="decimal" placeholder="Elevation (m)" value={d.elevation_m} onChange={e => set('elevation_m', e.target.value)} style={sheetInputStyle} />
        <input type="number" inputMode="decimal" placeholder="Avg HR (bpm)" value={d.avg_hr} onChange={e => set('avg_hr', e.target.value)} style={sheetInputStyle} />
      </FieldGrid>
      <textarea placeholder="Notes (optional)" value={d.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...sheetInputStyle, resize: 'none', fontFamily: 'inherit' }} />

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={onClose} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '12px 0', background: 'transparent', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '12px 0', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  )
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
