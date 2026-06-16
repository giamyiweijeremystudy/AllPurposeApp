import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ── Constants ────────────────────────────────────────────────
const SIZE = 10
const SHIPS = [
  { name: 'Carrier',    len: 5, color: '#1e40af' },
  { name: 'Battleship', len: 4, color: '#1d4ed8' },
  { name: 'Cruiser',    len: 3, color: '#2563eb' },
  { name: 'Submarine',  len: 3, color: '#3b82f6' },
  { name: 'Destroyer',  len: 2, color: '#60a5fa' },
]

// ── Pure helpers ─────────────────────────────────────────────
const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null))

function shipCells(row, col, len, horiz) {
  return Array.from({ length: len }, (_, i) => horiz ? [row, col + i] : [row + i, col])
}

function canPlace(grid, row, col, len, horiz) {
  for (const [r, c] of shipCells(row, col, len, horiz)) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false
    if (grid[r][c]) return false
  }
  return true
}

function randomPlacement() {
  const grid = emptyGrid()
  const placed = []
  for (const ship of SHIPS) {
    let ok = false
    while (!ok) {
      const horiz = Math.random() > 0.5
      const row = Math.floor(Math.random() * SIZE)
      const col = Math.floor(Math.random() * SIZE)
      if (canPlace(grid, row, col, ship.len, horiz)) {
        const cells = shipCells(row, col, ship.len, horiz)
        cells.forEach(([r, c]) => { grid[r][c] = ship.name })
        placed.push({ name: ship.name, len: ship.len, cells, horiz, sunk: false })
        ok = true
      }
    }
  }
  return placed
}

function checkSunk(ships, shots) {
  return ships.map(ship => ({
    ...ship,
    sunk: ship.cells.every(([r, c]) => shots.some(([sr, sc]) => sr === r && sc === c))
  }))
}

function isHit(ships, r, c) {
  return ships.some(s => s.cells.some(([sr, sc]) => sr === r && sc === c))
}

function allSunk(ships) {
  return ships.length > 0 && ships.every(s => s.sunk)
}

function getShipColor(name) {
  return SHIPS.find(s => s.name === name)?.color || '#3b82f6'
}

// ── AI ───────────────────────────────────────────────────────
function aiShot(shots, ships) {
  const hits = shots.filter(([r, c]) => isHit(ships, r, c))
  const sunkCells = ships.filter(s => s.sunk).flatMap(s => s.cells)
  const unsunkHits = hits.filter(([r, c]) => !sunkCells.some(([sr, sc]) => sr === r && sc === c))
  const tried = new Set(shots.map(([r, c]) => `${r},${c}`))
  const candidates = []
  if (unsunkHits.length > 0) {
    for (const [hr, hc] of unsunkHits)
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = hr + dr, nc = hc + dc
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !tried.has(`${nr},${nc}`))
          candidates.push([nr, nc])
      }
  }
  if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)]
  const all = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!tried.has(`${r},${c}`)) all.push([r, c])
  return all[Math.floor(Math.random() * all.length)]
}

function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase()
}

// ── Ship SVG model ───────────────────────────────────────────
function ShipModel({ name, len, horiz, cellSize, sunk, hit }) {
  const w = horiz ? len * cellSize : cellSize
  const h = horiz ? cellSize : len * cellSize
  const pad = 2
  const color = sunk ? '#7f1d1d' : hit ? '#b45309' : getShipColor(name)
  const lighter = sunk ? '#991b1b' : hit ? '#d97706' : '#93c5fd'
  const darker  = sunk ? '#450a0a' : hit ? '#92400e' : '#1e3a8a'

  // Draw ship along its length (always horizontal in SVG, rotate if needed)
  const L = len * cellSize - pad * 2
  const T = cellSize - pad * 2

  const svg = (
    <svg width={w} height={h} style={{ display:'block', overflow:'visible' }}>
      <g transform={horiz ? `translate(${pad},${pad})` : `translate(${pad},${pad}) rotate(90,${T/2},${T/2}) translate(0,${-(L-T)/2})`}>
        {/* Hull base */}
        <rect x={0} y={T*0.2} width={L} height={T*0.8} rx={T*0.15} fill={color}/>
        {/* Deck */}
        <rect x={T*0.3} y={T*0.1} width={L - T*0.5} height={T*0.35} rx={T*0.08} fill={lighter} opacity={0.4}/>
        {/* Bow taper */}
        <polygon points={`0,${T*0.5} ${T*0.35},${T*0.2} ${T*0.35},${T}`} fill={darker} opacity={0.5}/>
        {/* Stern */}
        <rect x={L - T*0.25} y={T*0.35} width={T*0.25} height={T*0.65} rx={T*0.08} fill={darker} opacity={0.4}/>
        {/* Superstructure */}
        {len >= 4 && <rect x={L*0.35} y={0} width={L*0.22} height={T*0.3} rx={T*0.06} fill={lighter} opacity={0.6}/>}
        {/* Turrets */}
        {len >= 3 && <circle cx={L*0.28} cy={T*0.25} r={T*0.09} fill={lighter} opacity={0.7}/>}
        {len >= 5 && <circle cx={L*0.65} cy={T*0.25} r={T*0.09} fill={lighter} opacity={0.7}/>}
        {/* Mast */}
        {len >= 4 && <line x1={L*0.47} y1={0} x2={L*0.47} y2={-T*0.3} stroke={lighter} strokeWidth={1.5} opacity={0.6}/>}
        {/* Sunk cracks */}
        {sunk && <>
          <line x1={L*0.3} y1={T*0.2} x2={L*0.4} y2={T*0.8} stroke="#fca5a5" strokeWidth={1.5} opacity={0.8}/>
          <line x1={L*0.6} y1={T*0.15} x2={L*0.7} y2={T*0.9} stroke="#fca5a5" strokeWidth={1.5} opacity={0.8}/>
        </>}
      </g>
    </svg>
  )
  return svg
}

// ── Explosion animation ──────────────────────────────────────
function Explosion({ x, y, size }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => f + 1), 80)
    return () => clearInterval(t)
  }, [])
  if (frame > 8) return null
  const r = size * 0.5 * (frame / 8)
  const opacity = 1 - frame / 9
  const colors = ['#fbbf24','#f97316','#ef4444','#dc2626']
  const color = colors[Math.min(frame, colors.length - 1)]
  return (
    <div style={{ position:'absolute', left: x - r, top: y - r, width: r*2, height: r*2, pointerEvents:'none', zIndex:20 }}>
      <svg width={r*2} height={r*2}>
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2 + frame * 0.3
          const er = r * 0.6 * (0.5 + Math.random() * 0.5)
          return <circle key={i} cx={r + Math.cos(angle)*er} cy={r + Math.sin(angle)*er} r={r*0.18} fill={color} opacity={opacity}/>
        })}
        <circle cx={r} cy={r} r={r*0.4} fill={color} opacity={opacity*0.8}/>
        <circle cx={r} cy={r} r={r*0.2} fill="#fff" opacity={opacity*0.6}/>
      </svg>
    </div>
  )
}

// ── Splash animation (miss) ──────────────────────────────────
function Splash({ x, y, size }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => f + 1), 70)
    return () => clearInterval(t)
  }, [])
  if (frame > 7) return null
  const h = size * 0.8 * Math.sin((frame / 7) * Math.PI)
  const opacity = 1 - frame / 8
  return (
    <div style={{ position:'absolute', left: x - size*0.3, top: y - h, width: size*0.6, height: h + size*0.3, pointerEvents:'none', zIndex:20 }}>
      <svg width={size*0.6} height={h + size*0.3}>
        <ellipse cx={size*0.3} cy={h + size*0.15} rx={size*0.25} ry={size*0.12} fill="#93c5fd" opacity={opacity*0.6}/>
        <line x1={size*0.3} y1={h + size*0.15} x2={size*0.3} y2={size*0.05} stroke="#bfdbfe" strokeWidth={3} opacity={opacity}/>
        {[-1,1].map(d => <line key={d} x1={size*0.3} y1={h*0.4} x2={size*0.3 + d*size*0.18} y2={0} stroke="#bfdbfe" strokeWidth={2} opacity={opacity*0.7}/>)}
      </svg>
    </div>
  )
}

// ── Grid with ships rendered as models ───────────────────────
function BattleGrid({ ships, shots, onShot, showShips, cellSize, disabled, animCell, animType }) {
  const [hover, setHover] = useState(null)
  const gridRef = useRef(null)

  const shotSet = new Set((shots || []).map(([r,c]) => `${r},${c}`))
  const updatedShips = checkSunk(ships, shots || [])

  // For each cell, determine what to show
  const getCellInfo = (r, c) => {
    const key = `${r},${c}`
    const wasShot = shotSet.has(key)
    const ship = updatedShips.find(s => s.cells.some(([sr,sc]) => sr===r && sc===c))
    const hit = wasShot && !!ship
    const miss = wasShot && !ship
    const sunk = hit && ship?.sunk
    return { wasShot, ship, hit, miss, sunk }
  }

  // Cells occupied by each ship (for rendering ship model once per ship)
  const renderedShips = new Set()

  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      {/* Row/col labels + grid */}
      <div style={{ display:'inline-block', border:'1px solid var(--border-2)', borderRadius:4, overflow:'visible', position:'relative' }}>
        {/* Column labels */}
        <div style={{ display:'flex', paddingLeft: cellSize }}>
          {Array.from({ length: SIZE }, (_, i) => (
            <div key={i} style={{ width:cellSize, textAlign:'center', fontSize: Math.max(8, cellSize*0.35), color:'var(--text-3)', fontWeight:600, lineHeight: `${cellSize*0.7}px` }}>
              {String.fromCharCode(65+i)}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        <div
          ref={gridRef}
          style={{ position:'relative', cursor: disabled ? 'default' : 'crosshair' }}
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: SIZE }, (_, r) => (
            <div key={r} style={{ display:'flex' }}>
              <div style={{ width:cellSize, display:'flex', alignItems:'center', justifyContent:'center', fontSize: Math.max(8, cellSize*0.35), color:'var(--text-3)', fontWeight:600 }}>{r+1}</div>
              {Array.from({ length: SIZE }, (_, c) => {
                const { wasShot, hit, miss, sunk } = getCellInfo(r, c)
                const isHover = hover && hover[0]===r && hover[1]===c && !disabled && !wasShot
                return (
                  <div
                    key={c}
                    onMouseEnter={() => !disabled && setHover([r,c])}
                    onClick={() => !disabled && !wasShot && onShot && onShot(r, c)}
                    style={{
                      width: cellSize, height: cellSize,
                      border: '1px solid var(--border)',
                      background: miss ? 'rgba(100,116,139,0.25)' : sunk ? 'rgba(127,29,29,0.3)' : hit ? 'rgba(239,68,68,0.2)' : isHover ? 'rgba(99,102,241,0.15)' : 'transparent',
                      position:'relative',
                      boxSizing:'border-box',
                      transition:'background 0.1s',
                    }}
                  >
                    {/* Miss dot */}
                    {miss && (
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width: cellSize*0.25, height: cellSize*0.25, borderRadius:'50%', background:'#94a3b8' }}/>
                      </div>
                    )}
                    {/* Hit cross */}
                    {hit && !sunk && (
                      <svg style={{ position:'absolute', inset:0 }} width={cellSize} height={cellSize}>
                        <line x1={cellSize*0.2} y1={cellSize*0.2} x2={cellSize*0.8} y2={cellSize*0.8} stroke="#ef4444" strokeWidth={2}/>
                        <line x1={cellSize*0.8} y1={cellSize*0.2} x2={cellSize*0.2} y2={cellSize*0.8} stroke="#ef4444" strokeWidth={2}/>
                      </svg>
                    )}
                    {/* Hover target reticle */}
                    {isHover && (
                      <svg style={{ position:'absolute', inset:0 }} width={cellSize} height={cellSize}>
                        <circle cx={cellSize/2} cy={cellSize/2} r={cellSize*0.35} stroke="#818cf8" strokeWidth={1.5} fill="none" opacity={0.7}/>
                        <line x1={cellSize/2} y1={cellSize*0.1} x2={cellSize/2} y2={cellSize*0.35} stroke="#818cf8" strokeWidth={1.5}/>
                        <line x1={cellSize/2} y1={cellSize*0.65} x2={cellSize/2} y2={cellSize*0.9} stroke="#818cf8" strokeWidth={1.5}/>
                        <line x1={cellSize*0.1} y1={cellSize/2} x2={cellSize*0.35} y2={cellSize/2} stroke="#818cf8" strokeWidth={1.5}/>
                        <line x1={cellSize*0.65} y1={cellSize/2} x2={cellSize*0.9} y2={cellSize/2} stroke="#818cf8" strokeWidth={1.5}/>
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Ship models rendered as absolutely positioned overlays */}
          {showShips && updatedShips.map(ship => {
            if (renderedShips.has(ship.name)) return null
            renderedShips.add(ship.name)
            const [r0, c0] = ship.cells[0]
            const top  = r0 * cellSize
            const left = c0 * cellSize
            const hasHit = ship.cells.some(([r,c]) => shotSet.has(`${r},${c}`))
            return (
              <div key={ship.name} style={{
                position:'absolute',
                top, left,
                width:  ship.horiz ? ship.len * cellSize : cellSize,
                height: ship.horiz ? cellSize : ship.len * cellSize,
                pointerEvents:'none',
                opacity: ship.sunk ? 0.55 : 1,
                transition: 'opacity 0.5s',
                filter: ship.sunk ? 'grayscale(0.5) brightness(0.7)' : 'none',
                zIndex: 5,
              }}>
                <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={ship.sunk} hit={hasHit && !ship.sunk}/>
              </div>
            )
          })}

          {/* Animations */}
          {animCell && animType === 'explosion' && (
            <Explosion
              x={(animCell[1] + 0.5) * cellSize}
              y={(animCell[0] + 0.5) * cellSize}
              size={cellSize}
            />
          )}
          {animCell && animType === 'splash' && (
            <Splash
              x={(animCell[1] + 0.5) * cellSize}
              y={(animCell[0] + 0.5) * cellSize}
              size={cellSize}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Drag-and-drop placement board ────────────────────────────
function PlacementBoard({ onDone, cellSize, opponentUsername, onlineMode }) {
  const [placedShips, setPlacedShips] = useState([])
  const [grid, setGrid]               = useState(emptyGrid())
  const [rotations, setRotations]     = useState(() => Object.fromEntries(SHIPS.map(s => [s.name, true]))) // true = horiz
  const [dragging, setDragging]       = useState(null) // { name, len, horiz, offsetIdx }
  const [dragOver, setDragOver]       = useState(null) // [r, c]
  const [touchDrag, setTouchDrag]     = useState(null)
  const gridRef = useRef(null)

  const placedNames = new Set(placedShips.map(s => s.name))
  const allPlaced = placedShips.length === SHIPS.length

  const getGridCell = (clientX, clientY) => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const c = Math.floor((clientX - rect.left) / cellSize)
    const r = Math.floor((clientY - rect.top) / cellSize)
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null
    return [r, c]
  }

  // Snap cell accounting for drag offset
  const getSnapCell = (clientX, clientY) => {
    if (!dragging) return null
    const raw = getGridCell(clientX, clientY)
    if (!raw) return null
    const [r, c] = raw
    const { len, horiz, offsetIdx } = dragging
    const r0 = horiz ? r : r - offsetIdx
    const c0 = horiz ? c - offsetIdx : c
    return [r0, c0]
  }

  const removeShip = (name) => {
    const ship = placedShips.find(s => s.name === name)
    if (!ship) return
    const newGrid = grid.map(row => row.map(cell => cell === name ? null : cell))
    setGrid(newGrid)
    setPlacedShips(prev => prev.filter(s => s.name !== name))
  }

  const tryPlace = (name, len, horiz, r0, c0) => {
    if (!canPlace(grid, r0, c0, len, horiz)) return false
    const cells = shipCells(r0, c0, len, horiz)
    const newGrid = grid.map(row => [...row])
    cells.forEach(([r, c]) => { newGrid[r][c] = name })
    setGrid(newGrid)
    setPlacedShips(prev => [...prev.filter(s => s.name !== name), { name, len, cells, horiz, sunk: false }])
    return true
  }

  // Mouse drag handlers
  const onBankMouseDown = (e, ship) => {
    e.preventDefault()
    const horiz = rotations[ship.name]
    setDragging({ name: ship.name, len: ship.len, horiz, offsetIdx: 0 })
  }

  const onGridMouseEnter = (r, c) => {
    if (!dragging) return
    const snap = getSnapCell(
      (c + 0.5) * cellSize + (gridRef.current?.getBoundingClientRect().left || 0),
      (r + 0.5) * cellSize + (gridRef.current?.getBoundingClientRect().top  || 0),
    )
    setDragOver([r, c])
  }

  const onGridDrop = (r, c) => {
    if (!dragging) return
    const { name, len, horiz, offsetIdx } = dragging
    const r0 = horiz ? r : r - offsetIdx
    const c0 = horiz ? c - offsetIdx : c
    removeShip(name)
    tryPlace(name, len, horiz, r0, c0)
    setDragging(null)
    setDragOver(null)
  }

  // Touch drag
  const onBankTouchStart = (e, ship) => {
    const t = e.touches[0]
    const horiz = rotations[ship.name]
    setTouchDrag({ name: ship.name, len: ship.len, horiz, offsetIdx: 0, x: t.clientX, y: t.clientY })
  }

  const onTouchMove = (e) => {
    if (!touchDrag) return
    e.preventDefault()
    const t = e.touches[0]
    setTouchDrag(prev => ({ ...prev, x: t.clientX, y: t.clientY }))
    const cell = getGridCell(t.clientX, t.clientY)
    setDragOver(cell)
  }

  const onTouchEnd = (e) => {
    if (!touchDrag) return
    const t = e.changedTouches[0]
    const cell = getGridCell(t.clientX, t.clientY)
    if (cell) {
      const { name, len, horiz, offsetIdx } = touchDrag
      const [r, c] = cell
      const r0 = horiz ? r : r - offsetIdx
      const c0 = horiz ? c - offsetIdx : c
      removeShip(name)
      tryPlace(name, len, horiz, r0, c0)
    }
    setTouchDrag(null)
    setDragOver(null)
  }

  const rotateShip = (name) => {
    // If placed, remove first, rotate, re-place
    const placed = placedShips.find(s => s.name === name)
    if (placed) {
      const newHoriz = !placed.horiz
      const [r0, c0] = placed.cells[0]
      removeShip(name)
      const len = SHIPS.find(s => s.name === name).len
      // Try same origin, else try transposed
      if (!tryPlace(name, len, newHoriz, r0, c0)) {
        // re-place original
        tryPlace(name, len, placed.horiz, r0, c0)
      } else {
        setRotations(prev => ({ ...prev, [name]: newHoriz }))
      }
    } else {
      setRotations(prev => ({ ...prev, [name]: !prev[name] }))
    }
  }

  const randomize = () => {
    const placed = randomPlacement()
    const newGrid = emptyGrid()
    placed.forEach(s => s.cells.forEach(([r,c]) => { newGrid[r][c] = s.name }))
    setGrid(newGrid)
    setPlacedShips(placed)
    setRotations(Object.fromEntries(placed.map(s => [s.name, s.horiz])))
  }

  const reset = () => {
    setPlacedShips([]); setGrid(emptyGrid())
    setRotations(Object.fromEntries(SHIPS.map(s => [s.name, true])))
  }

  // Preview cells for drag
  const previewCells = (() => {
    const d = dragging || touchDrag
    if (!d || !dragOver) return []
    const { len, horiz, offsetIdx } = d
    const [r, c] = dragOver
    const r0 = horiz ? r : r - offsetIdx
    const c0 = horiz ? c - offsetIdx : c
    return shipCells(r0, c0, len, horiz).filter(([r,c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE)
  })()

  const previewValid = (() => {
    const d = dragging || touchDrag
    if (!d || !dragOver) return false
    const { name, len, horiz, offsetIdx } = d
    const [r, c] = dragOver
    const r0 = horiz ? r : r - offsetIdx
    const c0 = horiz ? c - offsetIdx : c
    // Temporarily remove if already placed
    const tempGrid = grid.map(row => row.map(cell => cell === name ? null : cell))
    return canPlace(tempGrid, r0, c0, len, horiz)
  })()

  return (
    <div
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, width:'100%' }}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {opponentUsername && (
        <div style={{ background:'#166534', border:'1px solid #22c55e', borderRadius:'var(--radius)', padding:'8px 16px', color:'#86efac', fontSize:13, fontWeight:600, textAlign:'center', width:'100%', maxWidth:500 }}>
          ✅ {opponentUsername} is ready! Place your ships and click Ready.
        </div>
      )}

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={randomize} style={{ padding:'6px 14px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          🎲 Random
        </button>
        {placedShips.length > 0 && (
          <button onClick={reset} style={{ padding:'6px 14px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            ↺ Reset
          </button>
        )}
        <button
          onClick={() => allPlaced && onDone(placedShips)}
          disabled={!allPlaced}
          style={{ padding:'6px 20px', background: allPlaced ? '#22c55e' : 'var(--bg-3)', border:`1px solid ${allPlaced ? '#22c55e' : 'var(--border-2)'}`, borderRadius:'var(--radius)', color: allPlaced ? '#fff' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor: allPlaced ? 'pointer' : 'not-allowed', fontFamily:'inherit', transition:'all 0.2s' }}>
          {allPlaced ? '✓ Ready!' : `Place all ships (${placedShips.length}/${SHIPS.length})`}
        </button>
      </div>

      <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', alignItems:'flex-start' }}>
        {/* Ship bank */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth: cellSize * 6 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Fleet — drag to board</div>
          {SHIPS.map(ship => {
            const placed = placedNames.has(ship.name)
            const horiz = rotations[ship.name]
            return (
              <div key={ship.name} style={{ display:'flex', alignItems:'center', gap:8, opacity: placed ? 0.45 : 1 }}>
                <div style={{ fontSize:10, color:'var(--text-3)', width:70, flexShrink:0 }}>{ship.name} ({ship.len})</div>
                <div
                  draggable={!placed}
                  onMouseDown={e => !placed && onBankMouseDown(e, ship)}
                  onTouchStart={e => !placed && onBankTouchStart(e, ship)}
                  onClick={() => rotateShip(ship.name)}
                  title="Click to rotate"
                  style={{
                    cursor: placed ? 'pointer' : 'grab',
                    display:'inline-block',
                    width:  horiz ? ship.len * cellSize : cellSize,
                    height: horiz ? cellSize : ship.len * cellSize,
                    flexShrink:0,
                    outline: !placed ? '2px dashed var(--border-2)' : 'none',
                    borderRadius:4,
                    filter: placed ? 'grayscale(1)' : 'none',
                  }}
                >
                  <ShipModel name={ship.name} len={ship.len} horiz={horiz} cellSize={cellSize} sunk={false} hit={false}/>
                </div>
                {!placed && (
                  <span style={{ fontSize:9, color:'var(--text-3)' }}>tap to rotate</span>
                )}
                {placed && (
                  <span style={{ fontSize:9, color:'#22c55e' }}>✓ placed</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Your Board</div>
          <div style={{ display:'inline-block', border:'1px solid var(--border-2)', borderRadius:4, position:'relative' }}>
            {/* Column labels */}
            <div style={{ display:'flex', paddingLeft: cellSize }}>
              {Array.from({ length: SIZE }, (_, i) => (
                <div key={i} style={{ width:cellSize, textAlign:'center', fontSize: Math.max(8,cellSize*0.35), color:'var(--text-3)', fontWeight:600, lineHeight:`${cellSize*0.7}px` }}>
                  {String.fromCharCode(65+i)}
                </div>
              ))}
            </div>
            <div ref={gridRef} style={{ position:'relative' }}>
              {Array.from({ length: SIZE }, (_, r) => (
                <div key={r} style={{ display:'flex' }}>
                  <div style={{ width:cellSize, display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.max(8,cellSize*0.35), color:'var(--text-3)', fontWeight:600 }}>{r+1}</div>
                  {Array.from({ length: SIZE }, (_, c) => {
                    const isPrev = previewCells.some(([pr,pc]) => pr===r && pc===c)
                    const isShip = !!grid[r][c]
                    return (
                      <div
                        key={c}
                        onMouseEnter={() => setDragOver([r,c])}
                        onMouseUp={() => onGridDrop(r, c)}
                        style={{
                          width:cellSize, height:cellSize,
                          border:'1px solid var(--border)',
                          background: isPrev ? (previewValid ? 'rgba(99,102,241,0.25)' : 'rgba(239,68,68,0.25)') : 'transparent',
                          boxSizing:'border-box',
                          position:'relative',
                        }}
                      />
                    )
                  })}
                </div>
              ))}

              {/* Placed ships as models */}
              {placedShips.map(ship => (
                <div
                  key={ship.name}
                  onClick={() => rotateShip(ship.name)}
                  title="Click to rotate"
                  style={{
                    position:'absolute',
                    top:  ship.cells[0][0] * cellSize,
                    left: ship.cells[0][1] * cellSize,
                    width:  ship.horiz ? ship.len * cellSize : cellSize,
                    height: ship.horiz ? cellSize : ship.len * cellSize,
                    cursor:'pointer',
                    zIndex:5,
                  }}
                >
                  <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={false} hit={false}/>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity=1}
                    onMouseLeave={e => e.currentTarget.style.opacity=0}
                  >
                    <span style={{ background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:9, padding:'2px 5px', borderRadius:3 }}>↻</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ship health sidebar ───────────────────────────────────────
function ShipHealth({ ships, shots, label }) {
  const checked = checkSunk(ships, shots)
  return (
    <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
      {checked.map(s => (
        <div key={s.name} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <div style={{ width:8, height:8, borderRadius:2, background: s.sunk ? '#ef4444' : '#22c55e', flexShrink:0, transition:'background 0.3s' }}/>
          <span style={{ fontSize:11, color: s.sunk ? 'var(--text-3)' : 'var(--text)', textDecoration: s.sunk ? 'line-through' : 'none' }}>{s.name}</span>
          <span style={{ fontSize:10, color:'var(--text-3)', marginLeft:'auto' }}>{s.len}</span>
        </div>
      ))}
    </div>
  )
}

function StatusBar({ msg, color }) {
  return (
    <div style={{ background: color || 'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 16px', fontSize:13, fontWeight:600, textAlign:'center', color:'var(--text)', minHeight:38 }}>
      {msg}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────
export function Battleship() {
  const [screen, setScreen] = useState('menu')
  const [mode,   setMode]   = useState(null)
  const [user,   setUser]   = useState(null)
  const [profile, setProfile] = useState(null)

  // AI state
  const [phase,        setPhase]       = useState('placing')
  const [playerShips,  setPlayerShips] = useState([])
  const [aiShips,      setAiShips]     = useState([])
  const [playerShots,  setPlayerShots] = useState([])
  const [aiShots,      setAiShots]     = useState([])
  const [turn,         setTurn]        = useState('player')
  const [winner,       setWinner]      = useState(null)
  const [lastMsg,      setLastMsg]     = useState('')
  const [animEnemy,    setAnimEnemy]   = useState(null) // { cell, type }
  const [animPlayer,   setAnimPlayer]  = useState(null)

  // Online state
  const [lobby,           setLobby]          = useState(null)
  const [lobbies,         setLobbies]        = useState([])
  const [onlinePhase,     setOnlinePhase]    = useState('lobby')
  const [opponentReady,   setOpponentReady]  = useState(false)
  const [opponentProfile, setOpponentProfile]= useState(null)
  const [myShots,         setMyShots]        = useState([])
  const [oppShots,        setOppShots]       = useState([])
  const [myShips,         setMyShips]        = useState([])
  const [oppShips,        setOppShips]       = useState([]) // revealed after game over
  const [onlineTurn,      setOnlineTurn]     = useState(null)
  const [onlineWinner,    setOnlineWinner]   = useState(null)
  const [joinCode,        setJoinCode]       = useState('')
  const [joinError,       setJoinError]      = useState('')
  const [animOnlineEnemy, setAnimOnlineEnemy]= useState(null)
  const [animOnlineMe,    setAnimOnlineMe]   = useState(null)
  const subRef = useRef(null)

  // Responsive
  const [winSize, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const h = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  const isMobile = winSize.w < 760
  const cellSize = isMobile
    ? Math.floor((winSize.w - 56) / (SIZE + 1))
    : Math.floor(Math.min((winSize.w - 160) / (2 * (SIZE + 1)), (winSize.h - 220) / (SIZE + 1)))

  const ns = { userSelect:'none', WebkitUserSelect:'none' }

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user)
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setProfile(data))
    })
  }, [])

  const triggerAnim = (setter, cell, type, delay = 0) => {
    setTimeout(() => {
      setter({ cell, type })
      setTimeout(() => setter(null), 800)
    }, delay)
  }

  // ── AI ──────────────────────────────────────────────────────
  const startAI = () => {
    setAiShips(randomPlacement())
    setPlayerShots([]); setAiShots([])
    setTurn('player'); setWinner(null); setLastMsg('')
    setAnimEnemy(null); setAnimPlayer(null)
    setPhase('placing'); setMode('ai'); setScreen('game')
  }

  const handlePlacementDone = (ships) => {
    setPlayerShips(ships); setPhase('playing')
  }

  const handlePlayerShot = useCallback((r, c) => {
    if (turn !== 'player' || winner) return
    if (playerShots.some(([sr,sc]) => sr===r && sc===c)) return

    const newShots   = [...playerShots, [r,c]]
    const updatedAI  = checkSunk(aiShips, newShots)
    const hit        = isHit(aiShips, r, c)
    const shipSunk   = updatedAI.find(s => s.sunk && !aiShips.find(a => a.name===s.name)?.sunk)

    triggerAnim(setAnimEnemy, [r,c], hit ? 'explosion' : 'splash')
    setAiShips(updatedAI)
    setPlayerShots(newShots)
    setLastMsg(shipSunk ? `🔥 You sunk their ${shipSunk.name}!` : hit ? '💥 Hit!' : '💦 Miss!')

    if (allSunk(updatedAI)) { setWinner('player'); setPhase('over'); return }
    setTurn('ai')

    setTimeout(() => {
      setAiShots(prev => {
        const curPlayer = checkSunk(playerShips, prev)
        const shot      = aiShot(prev, curPlayer.length ? curPlayer : playerShips)
        const newAiShots= [...prev, shot]
        const updatedP  = checkSunk(playerShips, newAiShots)
        const aiHit     = isHit(playerShips, shot[0], shot[1])
        const aiSunk    = updatedP.find(s => s.sunk && !curPlayer.find(p => p.name===s.name)?.sunk)
        triggerAnim(setAnimPlayer, shot, aiHit ? 'explosion' : 'splash')
        setPlayerShips(updatedP)
        setLastMsg(aiSunk ? `💥 AI sunk your ${aiSunk.name}!` : aiHit ? '🔥 AI hit your ship!' : '💦 AI missed!')
        if (allSunk(updatedP)) { setWinner('ai'); setPhase('over') }
        else setTurn('player')
        return newAiShots
      })
    }, 900)
  }, [turn, winner, playerShots, aiShips, playerShips])

  // ── Online ──────────────────────────────────────────────────
  const loadLobbies = async () => {
    const { data } = await supabase
      .from('battleship_lobbies')
      .select('*, host:profiles!battleship_lobbies_host_id_fkey(username)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
    setLobbies(data || [])
  }

  const createLobby = async () => {
    if (!user) return
    const code = makeCode()
    const { data } = await supabase.from('battleship_lobbies')
      .insert({ code, host_id: user.id, status: 'waiting' })
      .select().single()
    setLobby(data)
    await supabase.from('battleship_players')
      .insert({ lobby_id: data.id, user_id: user.id, ships: [], shots: [], ready: false })
    setOnlinePhase('placing')
    subscribeToLobby(data.id)
  }

  const joinLobby = async (lobbyId) => {
    if (!user) return
    setJoinError('')
    const { data: lb } = await supabase.from('battleship_lobbies').select('*').eq('id', lobbyId).single()
    if (!lb || lb.status !== 'waiting') { setJoinError('Lobby not available'); return }
    if (lb.host_id === user.id) { setJoinError("That's your own lobby!"); return }
    await supabase.from('battleship_lobbies').update({ guest_id: user.id, status: 'placing' }).eq('id', lobbyId)
    await supabase.from('battleship_players').insert({ lobby_id: lobbyId, user_id: user.id, ships: [], shots: [], ready: false })
    setLobby({ ...lb, guest_id: user.id, status: 'placing' })
    setOnlinePhase('placing')
    // Load opponent profile
    supabase.from('profiles').select('*').eq('id', lb.host_id).single().then(({ data }) => setOpponentProfile(data))
    subscribeToLobby(lobbyId)
  }

  const joinByCode = async () => {
    const { data } = await supabase.from('battleship_lobbies').select('*').eq('code', joinCode.toUpperCase()).single()
    if (!data) { setJoinError('Lobby not found'); return }
    await joinLobby(data.id)
  }

  const subscribeToLobby = (lobbyId) => {
    if (subRef.current) subRef.current.unsubscribe()
    subRef.current = supabase.channel(`bs:${lobbyId}`)
      .on('postgres_changes', { event: '*', schema:'public', table:'battleship_lobbies', filter:`id=eq.${lobbyId}` },
        p => setLobby(p.new))
      .on('postgres_changes', { event: '*', schema:'public', table:'battleship_players', filter:`lobby_id=eq.${lobbyId}` },
        p => handleOnlinePlayerUpdate(p.new))
      .subscribe()
  }

  const handleOnlinePlayerUpdate = useCallback((row) => {
    if (!user || row.user_id === user.id) return
    setOpponentReady(row.ready)
    const newOppShots = row.shots || []
    setOppShots(prev => {
      if (newOppShots.length > prev.length) {
        const latest = newOppShots[newOppShots.length - 1]
        setMyShips(cur => {
          const hit = isHit(cur, latest[0], latest[1])
          triggerAnim(setAnimOnlineMe, latest, hit ? 'explosion' : 'splash')
          return cur
        })
        setOnlineTurn(u => user?.id) // their shot came in → now my turn
      }
      return newOppShots
    })
    // Load opponent profile if not yet
    supabase.from('profiles').select('*').eq('id', row.user_id).single()
      .then(({ data }) => { if (data) setOpponentProfile(data) })
  }, [user])

  const submitShipsOnline = async (ships) => {
    if (!lobby || !user) return
    setMyShips(ships)
    await supabase.from('battleship_players')
      .update({ ships, ready: true, updated_at: new Date().toISOString() })
      .eq('lobby_id', lobby.id).eq('user_id', user.id)
    // Check if both ready
    const { data: rows } = await supabase.from('battleship_players').select('*').eq('lobby_id', lobby.id)
    if (rows && rows.every(r => r.ready)) {
      await supabase.from('battleship_lobbies').update({ status: 'playing' }).eq('id', lobby.id)
      setOnlineTurn(lobby.host_id)
      setOnlinePhase('playing')
    } else {
      setOnlinePhase('waiting_opponent')
    }
  }

  useEffect(() => {
    if (onlinePhase === 'waiting_opponent' && opponentReady) {
      // Re-check if both rows are ready
      if (!lobby) return
      supabase.from('battleship_players').select('*').eq('lobby_id', lobby.id).then(({ data }) => {
        if (data && data.every(r => r.ready)) {
          supabase.from('battleship_lobbies').update({ status: 'playing' }).eq('id', lobby.id)
          setOnlineTurn(lobby.host_id)
          setOnlinePhase('playing')
        }
      })
    }
  }, [opponentReady, onlinePhase, lobby])

  const handleOnlineShot = async (r, c) => {
    if (onlineTurn !== user?.id || onlineWinner) return
    if (myShots.some(([sr,sc]) => sr===r && sc===c)) return
    const newShots = [...myShots, [r, c]]
    setMyShots(newShots)
    setOnlineTurn(null) // wait for opponent's shot to come back
    await supabase.from('battleship_players')
      .update({ shots: newShots, updated_at: new Date().toISOString() })
      .eq('lobby_id', lobby.id).eq('user_id', user.id)

    // Fetch opponent ships to check win
    const { data: oppRow } = await supabase.from('battleship_players')
      .select('ships').eq('lobby_id', lobby.id).neq('user_id', user.id).single()
    const oppShipsData = oppRow?.ships || []
    const hit = isHit(oppShipsData, r, c)
    triggerAnim(setAnimOnlineEnemy, [r,c], hit ? 'explosion' : 'splash')
    const checked = checkSunk(oppShipsData, newShots)
    if (allSunk(checked)) {
      setOppShips(checked)
      setOnlineWinner(user.id)
      await supabase.from('battleship_lobbies').update({ status: 'finished' }).eq('id', lobby.id)
      setOnlinePhase('over')
    }
  }

  useEffect(() => {
    if (onlinePhase === 'playing' && myShips.length > 0) {
      const updated = checkSunk(myShips, oppShots)
      if (allSunk(updated)) {
        setOnlineWinner('opponent')
        setOnlinePhase('over')
      }
    }
  }, [oppShots, myShips, onlinePhase])

  useEffect(() => {
    if (mode === 'online' && onlinePhase === 'lobby') loadLobbies()
  }, [mode, onlinePhase])

  useEffect(() => () => subRef.current?.unsubscribe(), [])

  const resetAll = () => {
    setScreen('menu'); setMode(null); setPhase('placing')
    setOnlinePhase('lobby'); setLobby(null); setOpponentReady(false)
    setMyShots([]); setOppShots([]); setMyShips([]); setOppShips([])
    setOnlineTurn(null); setOnlineWinner(null); setJoinCode(''); setJoinError('')
    subRef.current?.unsubscribe()
  }

  // ── Menu ─────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', padding:24, ...ns }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🚢</div>
        <div style={{ fontWeight:800, fontSize:28, letterSpacing:'0.1em' }}>BATTLESHIP</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>Sink the enemy fleet</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:300 }}>
        <button onClick={startAI} style={{ padding:'14px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          🤖 vs Computer
        </button>
        <button onClick={() => { setMode('online'); setScreen('game'); setOnlinePhase('lobby') }} style={{ padding:'14px', background:'var(--bg-2)', border:'2px solid var(--border-2)', borderRadius:'var(--radius-lg)', color:'var(--text)', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          🌐 Play Online
        </button>
      </div>
    </div>
  )

  // ── Online lobby ─────────────────────────────────────────────
  if (mode === 'online' && onlinePhase === 'lobby') return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', padding:16, ...ns }}>
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={resetAll} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>← Back</button>
          <span style={{ fontWeight:800, fontSize:18 }}>Online Lobbies</span>
          <button onClick={loadLobbies} style={{ marginLeft:'auto', background:'none', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', padding:'4px 10px', color:'var(--text-2)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>↻</button>
        </div>
        <button onClick={createLobby} style={{ width:'100%', padding:'12px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:16 }}>
          + Create Lobby
        </button>
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Lobby code…"
            style={{ flex:1, padding:'9px 12px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none' }}/>
          <button onClick={joinByCode} style={{ padding:'9px 16px', background:'var(--bg-2)', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Join</button>
        </div>
        {joinError && <div style={{ color:'var(--danger)', fontSize:12, marginBottom:12 }}>{joinError}</div>}
        <div style={{ fontWeight:700, fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Open Lobbies</div>
        {lobbies.length === 0
          ? <div style={{ textAlign:'center', color:'var(--text-3)', fontSize:13, padding:24 }}>No open lobbies — create one!</div>
          : lobbies.map(lb => (
            <div key={lb.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{lb.host?.username || 'Unknown'}'s game</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>Code: {lb.code}</div>
              </div>
              <button onClick={() => joinLobby(lb.id)} style={{ padding:'7px 16px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Join</button>
            </div>
          ))
        }
      </div>
    </div>
  )

  // ── Waiting for opponent ─────────────────────────────────────
  if (mode === 'online' && onlinePhase === 'waiting_opponent') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
      <div style={{ fontSize:36 }}>⏳</div>
      <div style={{ fontWeight:700, fontSize:18 }}>Waiting for opponent…</div>
      {lobby && <div style={{ fontSize:13, color:'var(--text-3)' }}>Code: <strong style={{ color:'var(--accent)', letterSpacing:'0.1em' }}>{lobby.code}</strong></div>}
    </div>
  )

  // ── Placement ────────────────────────────────────────────────
  if ((mode === 'ai' && phase === 'placing') || (mode === 'online' && onlinePhase === 'placing')) return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:12, gap:10, ...ns }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:700 }}>
        <button onClick={resetAll} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>← Menu</button>
        <span style={{ fontWeight:800, fontSize:16 }}>Place Your Ships</span>
        {mode === 'online' && lobby && <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:'auto' }}>Code: <strong style={{ color:'var(--accent)' }}>{lobby.code}</strong></span>}
      </div>
      <PlacementBoard
        cellSize={Math.min(cellSize, 34)}
        onDone={mode === 'ai' ? handlePlacementDone : submitShipsOnline}
        opponentUsername={opponentReady ? (opponentProfile?.username || 'Opponent') : null}
        onlineMode={mode === 'online'}
      />
    </div>
  )

  // ── Game over ─────────────────────────────────────────────────
  if ((mode === 'ai' && phase === 'over') || (mode === 'online' && onlinePhase === 'over')) {
    const won = mode === 'ai' ? winner === 'player' : onlineWinner === user?.id
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
        <div style={{ fontSize:48 }}>{won ? '🏆' : '💀'}</div>
        <div style={{ fontWeight:800, fontSize:28, color: won ? '#22c55e' : 'var(--danger)' }}>{won ? 'Victory!' : 'Defeated!'}</div>
        <div style={{ fontSize:14, color:'var(--text-3)' }}>{won ? 'You sunk the enemy fleet!' : 'Your fleet was destroyed!'}</div>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={resetAll} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
          {mode === 'ai' && <button onClick={startAI} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>}
        </div>
      </div>
    )
  }

  // ── AI playing ───────────────────────────────────────────────
  if (mode === 'ai' && phase === 'playing') {
    const updatedAI     = checkSunk(aiShips, playerShots)
    const updatedPlayer = checkSunk(playerShips, aiShots)
    const statusMsg = turn === 'player' ? '🎯 Your turn — fire at enemy grid' : '⏳ AI is thinking…'

    const enemyGrid = (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Enemy Waters</div>
        <BattleGrid ships={updatedAI} shots={playerShots} onShot={handlePlayerShot} showShips={false} cellSize={cellSize} disabled={turn !== 'player'} animCell={animEnemy?.cell} animType={animEnemy?.type}/>
      </div>
    )
    const playerGrid = (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Fleet</div>
        <BattleGrid ships={updatedPlayer} shots={aiShots} showShips={true} cellSize={cellSize} disabled={true} animCell={animPlayer?.cell} animType={animPlayer?.type}/>
      </div>
    )

    if (isMobile) return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'10px 8px', ...ns }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%' }}>
          <button onClick={resetAll} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>← Menu</button>
          <span style={{ fontWeight:700, fontSize:14, flex:1, textAlign:'center' }}>Battleship</span>
        </div>
        <StatusBar msg={lastMsg || statusMsg}/>
        {enemyGrid}
        {playerGrid}
      </div>
    )

    return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', gap:14, padding:16, ...ns }}>
        {enemyGrid}
        <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:130 }}>
          <button onClick={resetAll} style={{ padding:'6px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>← Menu</button>
          <StatusBar msg={lastMsg || statusMsg}/>
          <ShipHealth ships={updatedAI}     shots={playerShots} label="ENEMY FLEET"/>
          <ShipHealth ships={updatedPlayer} shots={aiShots}     label="YOUR FLEET"/>
        </div>
        {playerGrid}
      </div>
    )
  }

  // ── Online playing ───────────────────────────────────────────
  if (mode === 'online' && onlinePhase === 'playing') {
    const isMyTurn = onlineTurn === user?.id
    const myShipsChecked = checkSunk(myShips, oppShots)
    const statusMsg = isMyTurn ? '🎯 Your turn — fire!' : "⏳ Opponent's turn…"

    const enemyGrid = (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Enemy Waters</div>
        <BattleGrid ships={[]} shots={myShots} onShot={handleOnlineShot} showShips={false} cellSize={cellSize} disabled={!isMyTurn} animCell={animOnlineEnemy?.cell} animType={animOnlineEnemy?.type}/>
      </div>
    )
    const myGrid = (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Fleet</div>
        <BattleGrid ships={myShipsChecked} shots={oppShots} showShips={true} cellSize={cellSize} disabled={true} animCell={animOnlineMe?.cell} animType={animOnlineMe?.type}/>
      </div>
    )

    if (isMobile) return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'10px 8px', ...ns }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%' }}>
          <button onClick={resetAll} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>← Menu</button>
          <span style={{ fontWeight:700, fontSize:14, flex:1, textAlign:'center' }}>Battleship</span>
        </div>
        <StatusBar msg={statusMsg}/>
        {enemyGrid}
        {myGrid}
      </div>
    )

    return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', gap:14, padding:16, ...ns }}>
        {enemyGrid}
        <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:130 }}>
          <button onClick={resetAll} style={{ padding:'6px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>← Menu</button>
          <StatusBar msg={statusMsg}/>
          <ShipHealth ships={myShipsChecked} shots={oppShots} label="YOUR FLEET"/>
          {lobby && <div style={{ fontSize:10, color:'var(--text-3)', textAlign:'center' }}>Code: <strong>{lobby.code}</strong></div>}
        </div>
        {myGrid}
      </div>
    )
  }

  return null
}
