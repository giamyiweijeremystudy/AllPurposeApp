// ── Date helpers ─────────────────────────────────────────────

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}
export function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}
export function endOfWeek(date) {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}
export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
export function addWeeks(date, n) { return addDays(date, n * 7) }
export function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}
export function addYears(date, n) {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + n)
  return d
}
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
export function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function parseDateStr(str) {
  const [y,m,d] = str.split('-').map(Number)
  return new Date(y, m-1, d)
}
export function formatTime(date) {
  return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
}
export function formatDate(date) {
  return date.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' })
}

// ── Recurrence expansion ─────────────────────────────────────

export function expandRecurringEvent(event, rangeStart, rangeEnd) {
  const occurrences = []
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const duration = end - start
  const recEnd = event.recurrence_end ? new Date(event.recurrence_end + 'T23:59:59') : addYears(rangeEnd, 1)

  let cursor = new Date(start)
  let safetyLimit = 500

  while (cursor <= rangeEnd && cursor <= recEnd && safetyLimit-- > 0) {
    const occStart = new Date(cursor)
    const occEnd = new Date(cursor.getTime() + duration)

    if (occStart >= rangeStart) {
      occurrences.push({
        ...event,
        id: `${event.id}_${toDateStr(occStart)}`,
        _originalId: event.id,
        _isRecurrence: true,
        start_at: occStart.toISOString(),
        end_at: occEnd.toISOString(),
      })
    }

    if (event.recurrence === 'daily') cursor = addDays(cursor, 1)
    else if (event.recurrence === 'weekly') cursor = addWeeks(cursor, 1)
    else if (event.recurrence === 'monthly') cursor = addMonths(cursor, 1)
    else if (event.recurrence === 'yearly') cursor = addYears(cursor, 1)
    else break
  }
  return occurrences
}

export function getEventsForRange(rawEvents, rangeStart, rangeEnd) {
  const result = []
  for (const ev of rawEvents) {
    if (ev.recurrence && ev.recurrence !== 'none') {
      const occurrences = expandRecurringEvent(ev, rangeStart, rangeEnd)
      result.push(...occurrences)
    } else {
      const s = new Date(ev.start_at)
      const e = new Date(ev.end_at)
      if (e >= rangeStart && s <= rangeEnd) result.push(ev)
    }
  }
  return result
}

// ── Public holidays ──────────────────────────────────────────
// Uses Nager.Date free API — no key required

const holidayCache = {}

export async function fetchHolidays(year, countryCode = 'SG') {
  const key = `${year}-${countryCode}`
  if (holidayCache[key]) return holidayCache[key]
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`)
    if (!res.ok) return []
    const data = await res.json()
    holidayCache[key] = data.map(h => ({
      id: `holiday-${h.date}`,
      title: h.localName || h.name,
      start_at: h.date + 'T00:00:00',
      end_at: h.date + 'T23:59:59',
      all_day: true,
      _isHoliday: true,
      color: '#6b7280',
    }))
    return holidayCache[key]
  } catch {
    return []
  }
}

// ── Event positioning for month grid ─────────────────────────

export function layoutEventsForWeek(events, weekStart) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const rows = [] // each row is a sparse array of 7 slots

  const sorted = [...events].sort((a, b) => {
    const as = new Date(a.start_at), bs = new Date(b.start_at)
    const ae = new Date(a.end_at), be = new Date(b.end_at)
    const aSpan = Math.ceil((ae - as) / 86400000)
    const bSpan = Math.ceil((be - bs) / 86400000)
    return bSpan - aSpan || as - bs
  })

  const placed = new Set()

  for (const ev of sorted) {
    if (placed.has(ev.id)) continue
    const evStart = new Date(ev.start_at)
    const evEnd = new Date(ev.end_at)

    let startCol = -1, endCol = -1
    for (let i = 0; i < 7; i++) {
      if (isSameDay(days[i], evStart) || (evStart < days[i] && isSameDay(days[0], days[i]) && evEnd >= days[i])) {
        if (startCol === -1) startCol = i
      }
      if (evEnd >= days[i] && (isSameDay(days[i], evEnd) || evEnd > days[i])) {
        endCol = i
      }
    }
    if (startCol === -1) {
      // Event starts before this week
      if (evEnd >= days[0] && evStart <= days[6]) { startCol = 0 }
      else continue
    }
    if (endCol === -1 || endCol < startCol) endCol = Math.min(startCol, 6)
    endCol = Math.min(endCol, 6)

    // Find a row with space
    let rowIdx = 0
    while (true) {
      if (!rows[rowIdx]) rows[rowIdx] = Array(7).fill(null)
      let fits = true
      for (let c = startCol; c <= endCol; c++) {
        if (rows[rowIdx][c] !== null) { fits = false; break }
      }
      if (fits) {
        rows[rowIdx][startCol] = { ev, startCol, endCol, span: endCol - startCol + 1, continues: evEnd > days[6], continuesFrom: evStart < days[0] }
        for (let c = startCol + 1; c <= endCol; c++) rows[rowIdx][c] = 'filled'
        placed.add(ev.id)
        break
      }
      rowIdx++
      if (rowIdx > 10) break
    }
  }

  return rows
}
