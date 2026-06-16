import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ── Constants ─────────────────────────────────────────────────
const SIZE = 10
const SHIPS = [
  { name: 'Carrier',    len: 5, color: '#1e40af' },
  { name: 'Battleship', len: 4, color: '#1d4ed8' },
  { name: 'Cruiser',    len: 3, color: '#2563eb' },
  { name: 'Submarine',  len: 3, color: '#3b82f6' },
  { name: 'Destroyer',  len: 2, color: '#60a5fa' },
]
const SHELL_TRAVEL_MS = 1400 // ms before shell lands after gun fires

// ── Pure helpers ──────────────────────────────────────────────
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
function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase()
}

// ── AI ────────────────────────────────────────────────────────
function aiShot(shots, ships) {
  const hits = shots.filter(([r, c]) => isHit(ships, r, c))
  const sunkCells = ships.filter(s => s.sunk).flatMap(s => s.cells)
  const unsunkHits = hits.filter(([r, c]) => !sunkCells.some(([sr, sc]) => sr === r && sc === c))
  const tried = new Set(shots.map(([r, c]) => `${r},${c}`))
  const candidates = []
  if (unsunkHits.length > 0) {
    for (const [hr, hc] of unsunkHits)
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = hr+dr, nc = hc+dc
        if (nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!tried.has(`${nr},${nc}`)) candidates.push([nr,nc])
      }
  }
  if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)]
  const all = []
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (!tried.has(`${r},${c}`)) all.push([r,c])
  return all[Math.floor(Math.random() * all.length)]
}

// ── Ship SVG model ────────────────────────────────────────────
function ShipModel({ name, len, horiz, cellSize, sunk, hit, firing }) {
  const w = horiz ? len * cellSize : cellSize
  const h = horiz ? cellSize : len * cellSize
  const pad = 2
  const color   = sunk ? '#7f1d1d' : hit ? '#b45309' : getShipColor(name)
  const lighter = sunk ? '#991b1b' : hit ? '#d97706' : '#93c5fd'
  const darker  = sunk ? '#450a0a' : hit ? '#92400e' : '#1e3a8a'
  const L = len * cellSize - pad*2
  const T = cellSize - pad*2
  return (
    <svg width={w} height={h} style={{ display:'block', overflow:'visible' }}>
      <g transform={horiz ? `translate(${pad},${pad})` : `translate(${pad},${pad}) rotate(90,${T/2},${T/2}) translate(0,${-(L-T)/2})`}>
        <rect x={0} y={T*0.2} width={L} height={T*0.8} rx={T*0.15} fill={color}/>
        <rect x={T*0.3} y={T*0.1} width={L-T*0.5} height={T*0.35} rx={T*0.08} fill={lighter} opacity={0.4}/>
        <polygon points={`0,${T*0.5} ${T*0.35},${T*0.2} ${T*0.35},${T}`} fill={darker} opacity={0.5}/>
        <rect x={L-T*0.25} y={T*0.35} width={T*0.25} height={T*0.65} rx={T*0.08} fill={darker} opacity={0.4}/>
        {len>=4 && <rect x={L*0.35} y={0} width={L*0.22} height={T*0.3} rx={T*0.06} fill={lighter} opacity={0.6}/>}
        {len>=3 && <circle cx={L*0.28} cy={T*0.25} r={T*0.09} fill={lighter} opacity={0.7}/>}
        {len>=5 && <circle cx={L*0.65} cy={T*0.25} r={T*0.09} fill={lighter} opacity={0.7}/>}
        {len>=4 && <line x1={L*0.47} y1={0} x2={L*0.47} y2={-T*0.3} stroke={lighter} strokeWidth={1.5} opacity={0.6}/>}
        {/* Gun barrel — points up */}
        {len>=3 && (
          <g>
            <line
              x1={L*0.28} y1={T*0.25}
              x2={L*0.28} y2={firing ? -T*0.8 : -T*0.1}
              stroke={lighter} strokeWidth={2.5} strokeLinecap="round"
              style={{ transition: firing ? 'none' : 'y2 0.3s' }}
            />
          </g>
        )}
        {len>=5 && (
          <line
            x1={L*0.65} y1={T*0.25}
            x2={L*0.65} y2={firing ? -T*0.8 : -T*0.1}
            stroke={lighter} strokeWidth={2.5} strokeLinecap="round"
          />
        )}
        {/* Muzzle flash */}
        {firing && len>=3 && <>
          <circle cx={L*0.28} cy={-T*0.9} r={T*0.18} fill="#fbbf24" opacity={0.9}/>
          <circle cx={L*0.28} cy={-T*0.9} r={T*0.1}  fill="#fff"    opacity={0.8}/>
        </>}
        {firing && len>=5 && <>
          <circle cx={L*0.65} cy={-T*0.9} r={T*0.18} fill="#fbbf24" opacity={0.9}/>
          <circle cx={L*0.65} cy={-T*0.9} r={T*0.1}  fill="#fff"    opacity={0.8}/>
        </>}
        {/* Sunk cracks */}
        {sunk && <>
          <line x1={L*0.3} y1={T*0.2} x2={L*0.4} y2={T*0.8} stroke="#fca5a5" strokeWidth={1.5} opacity={0.8}/>
          <line x1={L*0.6} y1={T*0.15} x2={L*0.7} y2={T*0.9} stroke="#fca5a5" strokeWidth={1.5} opacity={0.8}/>
        </>}
      </g>
    </svg>
  )
}

// ── Shell arc animation ───────────────────────────────────────
// Renders a cannonball arcing from srcX,srcY to dstX,dstY
function ShellArc({ srcX, srcY, dstX, dstY, duration, onLand }) {
  const [progress, setProgress] = useState(0)
  const startRef = useRef(null)
  const rafRef   = useRef(null)

  useEffect(() => {
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts
      const p = Math.min((ts - startRef.current) / duration, 1)
      setProgress(p)
      if (p < 1) rafRef.current = requestAnimationFrame(animate)
      else onLand && onLand()
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Parabolic arc
  const x = srcX + (dstX - srcX) * progress
  const arcH = Math.max(Math.abs(dstY - srcY), Math.abs(dstX - srcX)) * 0.6
  const y = srcY + (dstY - srcY) * progress - arcH * 4 * progress * (1 - progress)
  const size = 6

  return (
    <div style={{ position:'absolute', left:0, top:0, pointerEvents:'none', zIndex:30 }}>
      <svg style={{ overflow:'visible', position:'absolute', left:0, top:0 }} width={0} height={0}>
        <circle cx={x} cy={y} r={size/2} fill="#fbbf24" opacity={0.95}/>
        <circle cx={x} cy={y} r={size/3} fill="#fff"    opacity={0.7}/>
        {/* Trail */}
        {[0.05,0.1,0.15].map((back,i) => {
          const tp = Math.max(0, progress - back)
          const tx = srcX + (dstX-srcX)*tp
          const ty = srcY + (dstY-srcY)*tp - arcH*4*tp*(1-tp)
          return <circle key={i} cx={tx} cy={ty} r={(size/2)*(1-i*0.3)} fill="#f97316" opacity={(0.5-i*0.15)}/>
        })}
      </svg>
    </div>
  )
}

// ── Water splash ──────────────────────────────────────────────
function Splash({ x, y, size }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => f+1), 60)
    return () => clearInterval(t)
  }, [])
  if (frame > 10) return null
  const h = size * 1.1 * Math.sin((frame/10) * Math.PI)
  const opacity = 1 - frame/11
  const r = size*0.35
  return (
    <div style={{ position:'absolute', left:x-r, top:y-h-r, width:r*2, height:h+r*2, pointerEvents:'none', zIndex:25 }}>
      <svg width={r*2} height={h+r*2} style={{ overflow:'visible' }}>
        {/* Base ring */}
        <ellipse cx={r} cy={h+r} rx={r*0.85} ry={r*0.3} fill="#93c5fd" opacity={opacity*0.5}/>
        {/* Main column */}
        <line x1={r} y1={h+r} x2={r} y2={r*0.3} stroke="#bfdbfe" strokeWidth={size*0.18} strokeLinecap="round" opacity={opacity}/>
        {/* Spray arms */}
        {[-0.7,-0.35,0.35,0.7].map((dx,i) => (
          <line key={i}
            x1={r} y1={r*0.5+h*0.3}
            x2={r+dx*size*0.55} y2={0}
            stroke="#e0f2fe" strokeWidth={size*0.1} strokeLinecap="round" opacity={opacity*0.65}/>
        ))}
        {/* Droplets */}
        {[-0.9,0,0.9].map((dx,i) => (
          <circle key={i} cx={r+dx*r*0.7} cy={r*0.2+frame*size*0.04} r={size*0.06} fill="#bfdbfe" opacity={opacity*0.8}/>
        ))}
      </svg>
    </div>
  )
}

// ── Explosion (hit) ───────────────────────────────────────────
function Explosion({ x, y, size }) {
  const [frame, setFrame] = useState(0)
  const seedRef = useRef([...Array(8)].map(()=>Math.random()))
  useEffect(() => {
    const t = setInterval(() => setFrame(f => f+1), 70)
    return () => clearInterval(t)
  }, [])
  if (frame > 10) return null
  const maxR = size * 0.7
  const r = maxR * (frame/10)
  const opacity = 1 - frame/11
  const colors = ['#fbbf24','#f97316','#ef4444','#dc2626','#b91c1c']
  const color = colors[Math.min(frame, colors.length-1)]
  return (
    <div style={{ position:'absolute', left:x-maxR, top:y-maxR, width:maxR*2, height:maxR*2, pointerEvents:'none', zIndex:25 }}>
      <svg width={maxR*2} height={maxR*2}>
        {/* Shockwave ring */}
        <circle cx={maxR} cy={maxR} r={r*1.1} stroke={color} strokeWidth={2} fill="none" opacity={opacity*0.4}/>
        {/* Core */}
        <circle cx={maxR} cy={maxR} r={r*0.6} fill={color} opacity={opacity*0.9}/>
        <circle cx={maxR} cy={maxR} r={r*0.3} fill="#fff"  opacity={opacity*0.7}/>
        {/* Sparks */}
        {seedRef.current.map((seed, i) => {
          const angle = (i/8)*Math.PI*2 + seed*0.5
          const sr = r * (0.6 + seed*0.5)
          return (
            <circle key={i}
              cx={maxR + Math.cos(angle)*sr}
              cy={maxR + Math.sin(angle)*sr}
              r={maxR*0.07} fill={colors[i%colors.length]} opacity={opacity}/>
          )
        })}
        {/* Smoke */}
        {frame>4 && <circle cx={maxR} cy={maxR-r*0.3} r={r*0.5} fill="#6b7280" opacity={(frame-4)/11*0.4}/>}
      </svg>
    </div>
  )
}

// ── Sinking animation ─────────────────────────────────────────
function SinkingShip({ ship, cellSize }) {
  const [frame, setFrame] = useState(0)
  const FRAMES = 20
  useEffect(() => {
    const t = setInterval(() => setFrame(f => f+1), 100)
    return () => clearInterval(t)
  }, [])
  if (frame > FRAMES) return null
  const progress = frame / FRAMES
  const sinkOffset = progress * cellSize * 0.7
  const tilt = progress * (ship.horiz ? 12 : -8)
  const opacity = Math.max(0, 1 - progress * 1.2)
  const [r0, c0] = ship.cells[0]
  const top  = r0 * cellSize
  const left = c0 * cellSize
  const w = ship.horiz ? ship.len * cellSize : cellSize
  const h = ship.horiz ? cellSize : ship.len * cellSize
  return (
    <div style={{
      position:'absolute', top, left, width:w, height:h,
      pointerEvents:'none', zIndex:10,
      transform:`translateY(${sinkOffset}px) rotate(${tilt}deg)`,
      opacity,
      transformOrigin:'center',
    }}>
      <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={true} hit={false}/>
      {/* Bubbles */}
      {frame>5 && [0.25,0.5,0.75].map((x,i) => (
        <div key={i} style={{
          position:'absolute',
          left:`${x*100}%`, top:`${-frame*3}%`,
          width:cellSize*0.08, height:cellSize*0.08,
          borderRadius:'50%', background:'#bfdbfe',
          opacity:opacity*0.7,
        }}/>
      ))}
    </div>
  )
}

// ── Event banner ──────────────────────────────────────────────
function EventBanner({ event }) {
  // event: { text, type } — type: 'hit'|'miss'|'sunk'|'info'|'firing'|'enemy_firing'
  const colors = {
    hit:          { bg:'#7f1d1d', border:'#ef4444', text:'#fca5a5', icon:'💥' },
    miss:         { bg:'#1e3a5f', border:'#3b82f6', text:'#93c5fd', icon:'💦' },
    sunk:         { bg:'#713f12', border:'#f59e0b', text:'#fde68a', icon:'🔥' },
    info:         { bg:'var(--bg-2)', border:'var(--border-2)', text:'var(--text)', icon:'ℹ️' },
    firing:       { bg:'#1a1a2e', border:'#818cf8', text:'#c7d2fe', icon:'🎯' },
    enemy_firing: { bg:'#1a1a1a', border:'#ef4444', text:'#fca5a5', icon:'⚠️' },
  }
  const c = colors[event?.type] || colors.info
  if (!event) return <div style={{ height:44 }}/>
  return (
    <div style={{
      background:c.bg, border:`1px solid ${c.border}`, borderRadius:'var(--radius)',
      padding:'9px 18px', fontSize:14, fontWeight:700,
      color:c.text, textAlign:'center',
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      minHeight:44, transition:'all 0.2s',
      boxShadow:`0 0 12px ${c.border}44`,
    }}>
      <span>{c.icon}</span>
      <span>{event.text}</span>
    </div>
  )
}

// ── Battle grid ───────────────────────────────────────────────
function BattleGrid({
  ships, shots, onShot, showShips, cellSize, disabled,
  firingShip,           // { name } — ship currently firing (show muzzle flash)
  impactAnim,           // { cell, type: 'explosion'|'splash' }
  sinkingShip,          // ship object currently sinking
  shellArc,             // { srcX, srcY, dstX, dstY } or null
  onShellLanded,
}) {
  const [hover, setHover] = useState(null)
  const shotSet     = new Set((shots||[]).map(([r,c])=>`${r},${c}`))
  const updatedShips = checkSunk(ships, shots||[])
  const renderedShips = new Set()

  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <div style={{ display:'inline-block', border:'1px solid var(--border-2)', borderRadius:4, overflow:'visible', position:'relative' }}>
        {/* Column labels */}
        <div style={{ display:'flex', paddingLeft:cellSize }}>
          {Array.from({length:SIZE},(_,i)=>(
            <div key={i} style={{ width:cellSize, textAlign:'center', fontSize:Math.max(8,cellSize*0.35), color:'var(--text-3)', fontWeight:600, lineHeight:`${cellSize*0.7}px` }}>
              {String.fromCharCode(65+i)}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ position:'relative', cursor:disabled?'default':'crosshair' }} onMouseLeave={()=>setHover(null)}>
          {Array.from({length:SIZE},(_,r)=>(
            <div key={r} style={{ display:'flex' }}>
              <div style={{ width:cellSize, display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.max(8,cellSize*0.35), color:'var(--text-3)', fontWeight:600 }}>{r+1}</div>
              {Array.from({length:SIZE},(_,c)=>{
                const key=`${r},${c}`
                const wasShot=shotSet.has(key)
                const ship=updatedShips.find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c))
                const hit=wasShot&&!!ship
                const miss=wasShot&&!ship
                const sunk=hit&&ship?.sunk
                const isHov=hover&&hover[0]===r&&hover[1]===c&&!disabled&&!wasShot
                return (
                  <div key={c}
                    onMouseEnter={()=>!disabled&&setHover([r,c])}
                    onClick={()=>!disabled&&!wasShot&&onShot&&onShot(r,c)}
                    style={{
                      width:cellSize,height:cellSize,
                      border:'1px solid var(--border)',
                      background: miss?'rgba(59,130,246,0.12)':sunk?'rgba(127,29,29,0.25)':hit?'rgba(239,68,68,0.18)':isHov?'rgba(99,102,241,0.14)':'transparent',
                      position:'relative', boxSizing:'border-box', transition:'background 0.1s',
                    }}
                  >
                    {miss&&<div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                      <div style={{ width:cellSize*0.22,height:cellSize*0.22,borderRadius:'50%',background:'#60a5fa',opacity:0.7 }}/>
                    </div>}
                    {hit&&!sunk&&<svg style={{ position:'absolute',inset:0 }} width={cellSize} height={cellSize}>
                      <line x1={cellSize*0.2} y1={cellSize*0.2} x2={cellSize*0.8} y2={cellSize*0.8} stroke="#ef4444" strokeWidth={2}/>
                      <line x1={cellSize*0.8} y1={cellSize*0.2} x2={cellSize*0.2} y2={cellSize*0.8} stroke="#ef4444" strokeWidth={2}/>
                    </svg>}
                    {isHov&&<svg style={{ position:'absolute',inset:0 }} width={cellSize} height={cellSize}>
                      <circle cx={cellSize/2} cy={cellSize/2} r={cellSize*0.35} stroke="#818cf8" strokeWidth={1.5} fill="none" opacity={0.7}/>
                      <line x1={cellSize/2} y1={cellSize*0.1}  x2={cellSize/2} y2={cellSize*0.35} stroke="#818cf8" strokeWidth={1.5}/>
                      <line x1={cellSize/2} y1={cellSize*0.65} x2={cellSize/2} y2={cellSize*0.9}  stroke="#818cf8" strokeWidth={1.5}/>
                      <line x1={cellSize*0.1}  y1={cellSize/2} x2={cellSize*0.35} y2={cellSize/2} stroke="#818cf8" strokeWidth={1.5}/>
                      <line x1={cellSize*0.65} y1={cellSize/2} x2={cellSize*0.9}  y2={cellSize/2} stroke="#818cf8" strokeWidth={1.5}/>
                    </svg>}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Ship models */}
          {showShips && updatedShips.map(ship=>{
            if(renderedShips.has(ship.name)) return null
            renderedShips.add(ship.name)
            const [r0,c0]=ship.cells[0]
            const hasHit=ship.cells.some(([r,c])=>shotSet.has(`${r},${c}`))
            const isFiring=firingShip?.name===ship.name
            // Don't render if sinking animation is active for this ship
            if(sinkingShip?.name===ship.name) return null
            return (
              <div key={ship.name} style={{
                position:'absolute',
                top:r0*cellSize, left:c0*cellSize,
                width:ship.horiz?ship.len*cellSize:cellSize,
                height:ship.horiz?cellSize:ship.len*cellSize,
                pointerEvents:'none', zIndex:5,
                opacity:ship.sunk?0:1,
                transition:'opacity 0.3s',
                filter:isFiring?'brightness(1.3)':'none',
              }}>
                <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={ship.sunk} hit={hasHit&&!ship.sunk} firing={isFiring}/>
              </div>
            )
          })}

          {/* Sinking animation */}
          {sinkingShip && <SinkingShip ship={sinkingShip} cellSize={cellSize}/>}

          {/* Shell arc */}
          {shellArc && (
            <ShellArc
              srcX={shellArc.srcX} srcY={shellArc.srcY}
              dstX={shellArc.dstX} dstY={shellArc.dstY}
              duration={SHELL_TRAVEL_MS}
              onLand={onShellLanded}
            />
          )}

          {/* Impact animations */}
          {impactAnim?.type==='explosion' && (
            <Explosion x={(impactAnim.cell[1]+0.5)*cellSize} y={(impactAnim.cell[0]+0.5)*cellSize} size={cellSize}/>
          )}
          {impactAnim?.type==='splash' && (
            <Splash x={(impactAnim.cell[1]+0.5)*cellSize} y={(impactAnim.cell[0]+0.5)*cellSize} size={cellSize}/>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Drag-and-drop placement ───────────────────────────────────
function PlacementBoard({ onDone, cellSize, opponentUsername }) {
  const [placedShips,setPlacedShips]=useState([])
  const [grid,setGrid]=useState(emptyGrid())
  const [rotations,setRotations]=useState(()=>Object.fromEntries(SHIPS.map(s=>[s.name,true])))
  const [dragging,setDragging]=useState(null)
  const [dragOver,setDragOver]=useState(null)
  const [touchDrag,setTouchDrag]=useState(null)
  const gridRef=useRef(null)

  const placedNames=new Set(placedShips.map(s=>s.name))
  const allPlaced=placedShips.length===SHIPS.length

  const getGridCell=(clientX,clientY)=>{
    const el=gridRef.current; if(!el) return null
    const rect=el.getBoundingClientRect()
    const c=Math.floor((clientX-rect.left)/cellSize)
    const r=Math.floor((clientY-rect.top)/cellSize)
    if(r<0||r>=SIZE||c<0||c>=SIZE) return null
    return [r,c]
  }

  const removeShip=(name)=>{
    const newGrid=grid.map(row=>row.map(cell=>cell===name?null:cell))
    setGrid(newGrid); setPlacedShips(prev=>prev.filter(s=>s.name!==name))
  }

  const tryPlace=(name,len,horiz,r0,c0)=>{
    if(!canPlace(grid,r0,c0,len,horiz)) return false
    const cells=shipCells(r0,c0,len,horiz)
    const newGrid=grid.map(row=>[...row])
    cells.forEach(([r,c])=>{ newGrid[r][c]=name })
    setGrid(newGrid)
    setPlacedShips(prev=>[...prev.filter(s=>s.name!==name),{name,len,cells,horiz,sunk:false}])
    return true
  }

  const onBankMouseDown=(e,ship)=>{ e.preventDefault(); setDragging({name:ship.name,len:ship.len,horiz:rotations[ship.name],offsetIdx:0}) }
  const onBankTouchStart=(e,ship)=>{ const t=e.touches[0]; setTouchDrag({name:ship.name,len:ship.len,horiz:rotations[ship.name],offsetIdx:0,x:t.clientX,y:t.clientY}) }

  const onTouchMove=(e)=>{
    if(!touchDrag) return; e.preventDefault()
    const t=e.touches[0]; setTouchDrag(prev=>({...prev,x:t.clientX,y:t.clientY}))
    setDragOver(getGridCell(t.clientX,t.clientY))
  }
  const onTouchEnd=(e)=>{
    if(!touchDrag) return
    const t=e.changedTouches[0]; const cell=getGridCell(t.clientX,t.clientY)
    if(cell){
      const{name,len,horiz,offsetIdx}=touchDrag; const[r,c]=cell
      removeShip(name); tryPlace(name,len,horiz,horiz?r:r-offsetIdx,horiz?c-offsetIdx:c)
    }
    setTouchDrag(null); setDragOver(null)
  }

  const onGridDrop=(r,c)=>{
    if(!dragging) return
    const{name,len,horiz,offsetIdx}=dragging
    removeShip(name); tryPlace(name,len,horiz,horiz?r:r-offsetIdx,horiz?c-offsetIdx:c)
    setDragging(null); setDragOver(null)
  }

  const rotateShip=(name)=>{
    const placed=placedShips.find(s=>s.name===name)
    const len=SHIPS.find(s=>s.name===name).len
    if(placed){
      const newH=!placed.horiz; const[r0,c0]=placed.cells[0]
      removeShip(name)
      if(!tryPlace(name,len,newH,r0,c0)) tryPlace(name,len,placed.horiz,r0,c0)
      else setRotations(prev=>({...prev,[name]:newH}))
    } else setRotations(prev=>({...prev,[name]:!prev[name]}))
  }

  const randomize=()=>{
    const placed=randomPlacement(); const newGrid=emptyGrid()
    placed.forEach(s=>s.cells.forEach(([r,c])=>{ newGrid[r][c]=s.name }))
    setGrid(newGrid); setPlacedShips(placed)
    setRotations(Object.fromEntries(placed.map(s=>[s.name,s.horiz])))
  }
  const reset=()=>{ setPlacedShips([]); setGrid(emptyGrid()); setRotations(Object.fromEntries(SHIPS.map(s=>[s.name,true]))) }

  const d=dragging||touchDrag
  const previewCells=d&&dragOver?shipCells(d.horiz?dragOver[0]:dragOver[0]-d.offsetIdx, d.horiz?dragOver[1]-d.offsetIdx:dragOver[1], d.len, d.horiz).filter(([r,c])=>r>=0&&r<SIZE&&c>=0&&c<SIZE):[]
  const previewValid=d&&dragOver?canPlace(grid.map(row=>row.map(cell=>cell===d.name?null:cell)), d.horiz?dragOver[0]:dragOver[0]-d.offsetIdx, d.horiz?dragOver[1]-d.offsetIdx:dragOver[1], d.len, d.horiz):false

  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:12,width:'100%' }}
      onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {opponentUsername && (
        <div style={{ background:'#166534',border:'1px solid #22c55e',borderRadius:'var(--radius)',padding:'8px 16px',color:'#86efac',fontSize:13,fontWeight:600,textAlign:'center',width:'100%',maxWidth:550 }}>
          ✅ {opponentUsername} is ready! Place your ships and click Ready.
        </div>
      )}
      <div style={{ display:'flex',gap:8 }}>
        <button onClick={randomize} style={{ padding:'6px 14px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg-2)',color:'var(--text)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>🎲 Random</button>
        {placedShips.length>0&&<button onClick={reset} style={{ padding:'6px 14px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg-2)',color:'var(--text)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>↺ Reset</button>}
        <button onClick={()=>allPlaced&&onDone(placedShips)} disabled={!allPlaced}
          style={{ padding:'6px 20px',background:allPlaced?'#22c55e':'var(--bg-3)',border:`1px solid ${allPlaced?'#22c55e':'var(--border-2)'}`,borderRadius:'var(--radius)',color:allPlaced?'#fff':'var(--text-3)',fontSize:12,fontWeight:600,cursor:allPlaced?'pointer':'not-allowed',fontFamily:'inherit',transition:'all 0.2s' }}>
          {allPlaced?'✓ Ready!':`Place all ships (${placedShips.length}/${SHIPS.length})`}
        </button>
      </div>
      <div style={{ display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center',alignItems:'flex-start' }}>
        {/* Bank */}
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2 }}>Fleet — drag to board</div>
          {SHIPS.map(ship=>{
            const placed=placedNames.has(ship.name); const horiz=rotations[ship.name]
            return (
              <div key={ship.name} style={{ display:'flex',alignItems:'center',gap:8,opacity:placed?0.45:1 }}>
                <div style={{ fontSize:10,color:'var(--text-3)',width:70,flexShrink:0 }}>{ship.name} ({ship.len})</div>
                <div
                  draggable={!placed}
                  onMouseDown={e=>!placed&&onBankMouseDown(e,ship)}
                  onTouchStart={e=>!placed&&onBankTouchStart(e,ship)}
                  onClick={()=>rotateShip(ship.name)}
                  title="Click to rotate"
                  style={{ cursor:placed?'pointer':'grab',display:'inline-block',width:horiz?ship.len*cellSize:cellSize,height:horiz?cellSize:ship.len*cellSize,flexShrink:0,outline:!placed?'2px dashed var(--border-2)':'none',borderRadius:4,filter:placed?'grayscale(1)':'none' }}
                >
                  <ShipModel name={ship.name} len={ship.len} horiz={horiz} cellSize={cellSize} sunk={false} hit={false} firing={false}/>
                </div>
                <span style={{ fontSize:9,color:placed?'#22c55e':'var(--text-3)' }}>{placed?'✓ placed':'tap to rotate'}</span>
              </div>
            )
          })}
        </div>
        {/* Grid */}
        <div>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4 }}>Your Board</div>
          <div style={{ display:'inline-block',border:'1px solid var(--border-2)',borderRadius:4,position:'relative' }}>
            <div style={{ display:'flex',paddingLeft:cellSize }}>
              {Array.from({length:SIZE},(_,i)=>(
                <div key={i} style={{ width:cellSize,textAlign:'center',fontSize:Math.max(8,cellSize*0.35),color:'var(--text-3)',fontWeight:600,lineHeight:`${cellSize*0.7}px` }}>{String.fromCharCode(65+i)}</div>
              ))}
            </div>
            <div ref={gridRef} style={{ position:'relative' }}>
              {Array.from({length:SIZE},(_,r)=>(
                <div key={r} style={{ display:'flex' }}>
                  <div style={{ width:cellSize,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(8,cellSize*0.35),color:'var(--text-3)',fontWeight:600 }}>{r+1}</div>
                  {Array.from({length:SIZE},(_,c)=>{
                    const isPrev=previewCells.some(([pr,pc])=>pr===r&&pc===c)
                    return (
                      <div key={c}
                        onMouseEnter={()=>setDragOver([r,c])}
                        onMouseUp={()=>onGridDrop(r,c)}
                        style={{ width:cellSize,height:cellSize,border:'1px solid var(--border)',background:isPrev?(previewValid?'rgba(99,102,241,0.25)':'rgba(239,68,68,0.25)'):'transparent',boxSizing:'border-box' }}
                      />
                    )
                  })}
                </div>
              ))}
              {/* Placed ships */}
              {placedShips.map(ship=>(
                <div key={ship.name} onClick={()=>rotateShip(ship.name)} title="Click to rotate"
                  style={{ position:'absolute',top:ship.cells[0][0]*cellSize,left:ship.cells[0][1]*cellSize,width:ship.horiz?ship.len*cellSize:cellSize,height:ship.horiz?cellSize:ship.len*cellSize,cursor:'pointer',zIndex:5 }}>
                  <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={false} hit={false} firing={false}/>
                  <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    <span style={{ background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:9,padding:'2px 5px',borderRadius:3 }}>↻</span>
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

// ── Ship health ───────────────────────────────────────────────
function ShipHealth({ ships, shots, label }) {
  const checked=checkSunk(ships,shots)
  return (
    <div style={{ background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 10px' }}>
      <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',letterSpacing:'0.08em',marginBottom:6 }}>{label}</div>
      {checked.map(s=>(
        <div key={s.name} style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}>
          <div style={{ width:8,height:8,borderRadius:2,background:s.sunk?'#ef4444':'#22c55e',flexShrink:0,transition:'background 0.3s' }}/>
          <span style={{ fontSize:11,color:s.sunk?'var(--text-3)':'var(--text)',textDecoration:s.sunk?'line-through':'none' }}>{s.name}</span>
          <span style={{ fontSize:10,color:'var(--text-3)',marginLeft:'auto' }}>{s.len}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function Battleship() {
  const [screen,setScreen]=useState('menu')
  const [mode,setMode]=useState(null)
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)

  // AI state
  const [phase,setPhase]=useState('placing')
  const [playerShips,setPlayerShips]=useState([])
  const [aiShips,setAiShips]=useState([])
  const [playerShots,setPlayerShots]=useState([])
  const [aiShots,setAiShots]=useState([])
  const [turn,setTurn]=useState('player')
  const [winner,setWinner]=useState(null)

  // Animation state — AI mode
  const [enemyFiringShip, setEnemyFiringShip] = useState(null)
  const [playerFiringShip,setPlayerFiringShip]= useState(null)
  const [enemyImpact,     setEnemyImpact]     = useState(null)
  const [playerImpact,    setPlayerImpact]    = useState(null)
  const [enemySinkShip,   setEnemySinkShip]   = useState(null)
  const [playerSinkShip,  setPlayerSinkShip]  = useState(null)
  const [enemyShell,      setEnemyShell]      = useState(null)
  const [playerShell,     setPlayerShell]     = useState(null)
  const [pendingShot,     setPendingShot]     = useState(null) // shot queued during shell travel
  const [banner,          setBanner]          = useState(null)

  // Online state
  const [lobby,           setLobby]          = useState(null)
  const [lobbies,         setLobbies]        = useState([])
  const [onlinePhase,     setOnlinePhase]    = useState('lobby')
  const [opponentReady,   setOpponentReady]  = useState(false)
  const [opponentProfile, setOpponentProfile]= useState(null)
  const [myShots,         setMyShots]        = useState([])
  const [oppShots,        setOppShots]       = useState([])
  const [myShips,         setMyShips]        = useState([])
  const [onlineTurn,      setOnlineTurn]     = useState(null)
  const [onlineWinner,    setOnlineWinner]   = useState(null)
  const [joinCode,        setJoinCode]       = useState('')
  const [joinError,       setJoinError]      = useState('')
  const [onlineEnemyFiring,  setOnlineEnemyFiring]  = useState(null)
  const [onlineEnemyImpact,  setOnlineEnemyImpact]  = useState(null)
  const [onlineMyImpact,     setOnlineMyImpact]     = useState(null)
  const [onlineEnemyShell,   setOnlineEnemyShell]   = useState(null)
  const [onlineMyShell,      setOnlineMyShell]      = useState(null)
  const [onlineBanner,       setOnlineBanner]       = useState(null)
  const [onlineEnemySink,    setOnlineEnemySink]    = useState(null)
  const [onlineMySink,       setOnlineMySink]       = useState(null)
  const [selectedCell,       setSelectedCell]       = useState(null) // cell chosen before firing
  const [pendingOnlineShot,  setPendingOnlineShot]  = useState(null)
  const subRef=useRef(null)

  // Responsive
  const [winSize,setWinSize]=useState({w:window.innerWidth,h:window.innerHeight})
  useEffect(()=>{ const h=()=>setWinSize({w:window.innerWidth,h:window.innerHeight}); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h) },[])
  const isMobile=winSize.w<760
  const cellSize=isMobile
    ? Math.floor((winSize.w-56)/(SIZE+1))
    : Math.floor(Math.min((winSize.w-160)/(2*(SIZE+1)),(winSize.h-240)/(SIZE+1)))

  const ns={userSelect:'none',WebkitUserSelect:'none'}

  // Auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user??null)
      if(session?.user) supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))
    })
  },[])

  const showBanner=(setter,text,type,dur=2200)=>{
    setter({text,type})
    setTimeout(()=>setter(null),dur)
  }

  // Find a ship on a grid that can fire (not sunk, has cells)
  const getRandomFiringShip=(ships)=>ships.filter(s=>!s.sunk&&s.len>=2)[Math.floor(Math.random()*ships.filter(s=>!s.sunk&&s.len>=2).length)]||null

  // ── AI mode ───────────────────────────────────────────────
  const startAI=()=>{
    setAiShips(randomPlacement()); setPlayerShots([]); setAiShots([])
    setTurn('player'); setWinner(null); setBanner(null)
    setEnemyFiringShip(null); setPlayerFiringShip(null)
    setEnemyImpact(null); setPlayerImpact(null)
    setEnemySinkShip(null); setPlayerSinkShip(null)
    setEnemyShell(null); setPlayerShell(null)
    setPendingShot(null)
    setPhase('placing'); setMode('ai'); setScreen('game')
  }

  const handlePlacementDone=(ships)=>{ setPlayerShips(ships); setPhase('playing'); showBanner(setBanner,'Your turn — fire at enemy grid','info') }

  const handlePlayerShot=useCallback((r,c)=>{
    if(turn!=='player'||winner) return
    if(playerShots.some(([sr,sc])=>sr===r&&sc===c)) return

    // Phase 1: Show muzzle flash on player's ship
    const firingShip=getRandomFiringShip(playerShips)
    if(firingShip) setPlayerFiringShip(firingShip)
    showBanner(setBanner,'🎯 You are firing…','firing',SHELL_TRAVEL_MS+400)

    // Phase 2: Shell arc from player's grid to enemy grid (visual only, symbolic coords)
    setEnemyShell({ srcX: cellSize/2, srcY: -cellSize, dstX: (c+0.5)*cellSize, dstY: (r+0.5)*cellSize })
    setPendingShot([r,c])
    setTurn(null) // lock until shell lands

    setTimeout(()=>setPlayerFiringShip(null), 350)
  },[turn,winner,playerShots,playerShips,cellSize])

  // Called when shell lands on enemy grid
  const onPlayerShellLanded=useCallback(()=>{
    setEnemyShell(null)
    if(!pendingShot) return
    const [r,c]=pendingShot; setPendingShot(null)
    const newShots=[...playerShots,[r,c]]
    const updatedAI=checkSunk(aiShips,newShots)
    const hit=isHit(aiShips,r,c)
    const newlySunk=updatedAI.find(s=>s.sunk&&!aiShips.find(a=>a.name===s.name)?.sunk)

    setEnemyImpact({cell:[r,c],type:hit?'explosion':'splash'})
    setTimeout(()=>setEnemyImpact(null),900)

    setAiShips(updatedAI); setPlayerShots(newShots)

    if(newlySunk){
      setEnemySinkShip(newlySunk)
      setTimeout(()=>setEnemySinkShip(null),2200)
      showBanner(setBanner,`🔥 You sunk the enemy ${newlySunk.name}!`,'sunk',2500)
    } else {
      showBanner(setBanner,hit?'💥 HIT!':'💦 MISS',hit?'hit':'miss')
    }

    if(allSunk(updatedAI)){ setWinner('player'); setPhase('over'); return }
    setTurn('ai')

    // AI fires after delay
    setTimeout(()=>{
      setAiShots(prev=>{
        const curPlayer=checkSunk(playerShips,prev)
        const shot=aiShot(prev,curPlayer.length?curPlayer:playerShips)
        // Show AI ship firing
        const aiFiringShip=getRandomFiringShip(curPlayer.length?curPlayer:playerShips)
        // Note: we show on playerGrid so use playerFiringShip... actually fire from AI ships (enemy grid for player = player grid here is confusing)
        // We show muzzle on enemy grid's firing ship. Since we don't show enemy ships, we show the banner.
        showBanner(setBanner,'⚠️ AI is firing…','enemy_firing',SHELL_TRAVEL_MS+400)
        setPlayerShell({ srcX: (shot[1]+0.5)*cellSize, srcY: -cellSize, dstX: (shot[1]+0.5)*cellSize, dstY: (shot[0]+0.5)*cellSize })
        setTimeout(()=>{
          setPlayerShell(null)
          const newAiShots=[...prev,shot]
          const updatedP=checkSunk(playerShips,newAiShots)
          const aiHit=isHit(playerShips,shot[0],shot[1])
          const aiNewlySunk=updatedP.find(s=>s.sunk&&!curPlayer.find(p=>p.name===s.name)?.sunk)
          setPlayerImpact({cell:shot,type:aiHit?'explosion':'splash'})
          setTimeout(()=>setPlayerImpact(null),900)
          setPlayerShips(updatedP)
          if(aiNewlySunk){
            setPlayerSinkShip(aiNewlySunk)
            setTimeout(()=>setPlayerSinkShip(null),2200)
            showBanner(setBanner,`💥 AI sunk your ${aiNewlySunk.name}!`,'sunk',2500)
          } else {
            showBanner(setBanner,aiHit?'🔥 AI hit your ship!':'💦 AI missed!',aiHit?'hit':'miss')
          }
          if(allSunk(updatedP)){ setWinner('ai'); setPhase('over') }
          else { setTurn('player'); setTimeout(()=>showBanner(setBanner,'Your turn — fire!','info',10000),400) }
        }, SHELL_TRAVEL_MS)
        return newAiShots
      })
    },1200)
  },[pendingShot,playerShots,aiShips,playerShips,cellSize])

  // ── Online ─────────────────────────────────────────────────
  const loadLobbies=async()=>{
    const{data}=await supabase.from('battleship_lobbies').select('*,host:profiles!battleship_lobbies_host_id_fkey(username)').eq('status','waiting').order('created_at',{ascending:false})
    setLobbies(data||[])
  }

  const createLobby=async()=>{
    if(!user) return
    const code=makeCode()
    const{data}=await supabase.from('battleship_lobbies').insert({code,host_id:user.id,status:'waiting'}).select().single()
    setLobby(data)
    await supabase.from('battleship_players').insert({lobby_id:data.id,user_id:user.id,ships:[],shots:[],ready:false})
    setOnlinePhase('placing'); subscribeToLobby(data.id)
  }

  const joinLobby=async(lobbyId)=>{
    if(!user) return; setJoinError('')
    const{data:lb}=await supabase.from('battleship_lobbies').select('*').eq('id',lobbyId).single()
    if(!lb||lb.status!=='waiting'){ setJoinError('Lobby not available'); return }
    if(lb.host_id===user.id){ setJoinError("That's your own lobby!"); return }
    await supabase.from('battleship_lobbies').update({guest_id:user.id,status:'placing'}).eq('id',lobbyId)
    await supabase.from('battleship_players').insert({lobby_id:lobbyId,user_id:user.id,ships:[],shots:[],ready:false})
    setLobby({...lb,guest_id:user.id,status:'placing'}); setOnlinePhase('placing')
    supabase.from('profiles').select('*').eq('id',lb.host_id).single().then(({data})=>setOpponentProfile(data))
    subscribeToLobby(lobbyId)
  }

  const joinByCode=async()=>{
    const{data}=await supabase.from('battleship_lobbies').select('*').eq('code',joinCode.toUpperCase()).single()
    if(!data){ setJoinError('Lobby not found'); return }
    await joinLobby(data.id)
  }

  const subscribeToLobby=(lobbyId)=>{
    if(subRef.current) subRef.current.unsubscribe()
    subRef.current=supabase.channel(`bs:${lobbyId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'battleship_lobbies',filter:`id=eq.${lobbyId}`},p=>setLobby(p.new))
      .on('postgres_changes',{event:'*',schema:'public',table:'battleship_players',filter:`lobby_id=eq.${lobbyId}`},p=>handleOnlinePlayerUpdate(p.new))
      .subscribe()
  }

  const handleOnlinePlayerUpdate=useCallback((row)=>{
    if(!user||row.user_id===user.id) return
    setOpponentReady(row.ready)
    const newOppShots=row.shots||[]
    setOppShots(prev=>{
      if(newOppShots.length>prev.length){
        const latest=newOppShots[newOppShots.length-1]
        const oppName=opponentProfile?.username||'Opponent'
        showBanner(setOnlineBanner,`${oppName} has fired!`,'enemy_firing',SHELL_TRAVEL_MS+600)
        setOnlineMyShell({srcX:(latest[1]+0.5)*cellSize,srcY:-cellSize,dstX:(latest[1]+0.5)*cellSize,dstY:(latest[0]+0.5)*cellSize})
        setPendingOnlineShot(latest)
      }
      return newOppShots
    })
    supabase.from('profiles').select('*').eq('id',row.user_id).single().then(({data})=>{ if(data) setOpponentProfile(data) })
  },[user,opponentProfile,cellSize])

  const onOnlineMyShellLanded=useCallback(()=>{
    setOnlineMyShell(null)
    if(!pendingOnlineShot) return
    const shot=pendingOnlineShot; setPendingOnlineShot(null)
    setMyShips(cur=>{
      const hit=isHit(cur,shot[0],shot[1])
      setOnlineMyImpact({cell:shot,type:hit?'explosion':'splash'})
      setTimeout(()=>setOnlineMyImpact(null),900)
      const updated=checkSunk(cur,oppShots)
      const newlySunk=updated.find(s=>s.sunk&&!cur.find(p=>p.name===s.name)?.sunk)
      if(newlySunk){
        setOnlineMySink(newlySunk); setTimeout(()=>setOnlineMySink(null),2200)
        showBanner(setOnlineBanner,`💥 Your ${newlySunk.name} was sunk!`,'sunk',2500)
      } else {
        showBanner(setOnlineBanner,hit?'🔥 Enemy hit your ship!':'💦 Enemy missed!',hit?'hit':'miss')
      }
      return cur
    })
    setOnlineTurn(user?.id)
    setTimeout(()=>showBanner(setOnlineBanner,'Your turn — fire!','info',10000),400)
  },[pendingOnlineShot,oppShots,user])

  const submitShipsOnline=async(ships)=>{
    if(!lobby||!user) return; setMyShips(ships)
    await supabase.from('battleship_players').update({ships,ready:true,updated_at:new Date().toISOString()}).eq('lobby_id',lobby.id).eq('user_id',user.id)
    const{data:rows}=await supabase.from('battleship_players').select('*').eq('lobby_id',lobby.id)
    if(rows&&rows.every(r=>r.ready)){
      await supabase.from('battleship_lobbies').update({status:'playing'}).eq('id',lobby.id)
      setOnlineTurn(lobby.host_id); setOnlinePhase('playing')
    } else setOnlinePhase('waiting_opponent')
  }

  useEffect(()=>{
    if(onlinePhase==='waiting_opponent'&&opponentReady&&lobby){
      supabase.from('battleship_players').select('*').eq('lobby_id',lobby.id).then(({data})=>{
        if(data&&data.every(r=>r.ready)){
          supabase.from('battleship_lobbies').update({status:'playing'}).eq('id',lobby.id)
          setOnlineTurn(lobby.host_id); setOnlinePhase('playing')
        }
      })
    }
  },[opponentReady,onlinePhase,lobby])

  // Cell selection + fire button for online
  const handleCellSelect=(r,c)=>{
    if(onlineTurn!==user?.id||onlineWinner) return
    if(myShots.some(([sr,sc])=>sr===r&&sc===c)) return
    setSelectedCell([r,c])
  }

  const handleFireButton=async()=>{
    if(!selectedCell||onlineTurn!==user?.id||onlineWinner) return
    const[r,c]=selectedCell; setSelectedCell(null)
    const newShots=[...myShots,[r,c]]; setMyShots(newShots)
    setOnlineTurn(null)
    const oppName=opponentProfile?.username||'Opponent'
    showBanner(setOnlineBanner,'🎯 You are firing…','firing',SHELL_TRAVEL_MS+400)
    setOnlineEnemyShell({srcX:cellSize/2,srcY:-cellSize,dstX:(c+0.5)*cellSize,dstY:(r+0.5)*cellSize})
    setPendingOnlineShot({ pending: [r,c], shots: newShots })
    await supabase.from('battleship_players').update({shots:newShots,updated_at:new Date().toISOString()}).eq('lobby_id',lobby.id).eq('user_id',user.id)
    const{data:oppRow}=await supabase.from('battleship_players').select('ships').eq('lobby_id',lobby.id).neq('user_id',user.id).single()
    const oppShipsData=oppRow?.ships||[]
    const hit=isHit(oppShipsData,r,c)
    const checked=checkSunk(oppShipsData,newShots)
    if(allSunk(checked)){
      setOnlineWinner(user.id)
      await supabase.from('battleship_lobbies').update({status:'finished'}).eq('id',lobby.id)
      setOnlinePhase('over')
    }
  }

  const onOnlineEnemyShellLanded=useCallback(()=>{
    setOnlineEnemyShell(null)
    if(!pendingOnlineShot?.pending) return
    const[r,c]=pendingOnlineShot.pending; const shots=pendingOnlineShot.shots
    setPendingOnlineShot(null)
    supabase.from('battleship_players').select('ships').eq('lobby_id',lobby?.id||'').neq('user_id',user?.id||'').single().then(({data:oppRow})=>{
      const oppShipsData=oppRow?.ships||[]
      const hit=isHit(oppShipsData,r,c)
      setOnlineEnemyImpact({cell:[r,c],type:hit?'explosion':'splash'})
      setTimeout(()=>setOnlineEnemyImpact(null),900)
      const checked=checkSunk(oppShipsData,shots)
      const newlySunk=checked.find(s=>s.sunk&&!checkSunk(oppShipsData,shots.slice(0,-1)).find(p=>p.name===s.name)?.sunk)
      if(newlySunk){
        setOnlineEnemySink(newlySunk); setTimeout(()=>setOnlineEnemySink(null),2200)
        showBanner(setOnlineBanner,`🔥 You sunk the enemy ${newlySunk.name}!`,'sunk',2500)
      } else {
        showBanner(setOnlineBanner,hit?'💥 HIT!':'💦 MISS',hit?'hit':'miss')
      }
    })
  },[pendingOnlineShot,lobby,user])

  useEffect(()=>{
    if(onlinePhase==='playing'&&myShips.length>0){
      const updated=checkSunk(myShips,oppShots)
      if(allSunk(updated)){ setOnlineWinner('opponent'); setOnlinePhase('over') }
    }
  },[oppShots,myShips,onlinePhase])

  useEffect(()=>{ if(mode==='online'&&onlinePhase==='lobby') loadLobbies() },[mode,onlinePhase])
  useEffect(()=>()=>subRef.current?.unsubscribe(),[])

  const resetAll=()=>{
    setScreen('menu'); setMode(null); setPhase('placing')
    setOnlinePhase('lobby'); setLobby(null); setOpponentReady(false)
    setMyShots([]); setOppShots([]); setMyShips([])
    setOnlineTurn(null); setOnlineWinner(null); setJoinCode(''); setJoinError('')
    setSelectedCell(null); setBanner(null); setOnlineBanner(null)
    subRef.current?.unsubscribe()
  }

  const isMyTurnOnline = onlineTurn === user?.id

  // ── Menu ──────────────────────────────────────────────────
  if(screen==='menu') return (
    <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,background:'var(--bg)',padding:24,...ns }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48,marginBottom:8 }}>🚢</div>
        <div style={{ fontWeight:800,fontSize:28,letterSpacing:'0.1em' }}>BATTLESHIP</div>
        <div style={{ fontSize:12,color:'var(--text-3)',marginTop:4 }}>Sink the enemy fleet</div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:300 }}>
        <button onClick={startAI} style={{ padding:'14px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-lg)',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>🤖 vs Computer</button>
        <button onClick={()=>{ setMode('online'); setScreen('game'); setOnlinePhase('lobby') }} style={{ padding:'14px',background:'var(--bg-2)',border:'2px solid var(--border-2)',borderRadius:'var(--radius-lg)',color:'var(--text)',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>🌐 Play Online</button>
      </div>
    </div>
  )

  // ── Online lobby ──────────────────────────────────────────
  if(mode==='online'&&onlinePhase==='lobby') return (
    <div style={{ position:'absolute',inset:0,background:'var(--bg)',overflowY:'auto',padding:16,...ns }}>
      <div style={{ maxWidth:500,margin:'0 auto' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20 }}>
          <button onClick={resetAll} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit' }}>← Back</button>
          <span style={{ fontWeight:800,fontSize:18 }}>Online Lobbies</span>
          <button onClick={loadLobbies} style={{ marginLeft:'auto',background:'none',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',padding:'4px 10px',color:'var(--text-2)',cursor:'pointer',fontSize:12,fontFamily:'inherit' }}>↻</button>
        </div>
        <button onClick={createLobby} style={{ width:'100%',padding:'12px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-lg)',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:16 }}>+ Create Lobby</button>
        <div style={{ display:'flex',gap:8,marginBottom:20 }}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Lobby code…"
            style={{ flex:1,padding:'9px 12px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg)',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none' }}/>
          <button onClick={joinByCode} style={{ padding:'9px 16px',background:'var(--bg-2)',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',color:'var(--text)',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>Join</button>
        </div>
        {joinError&&<div style={{ color:'var(--danger)',fontSize:12,marginBottom:12 }}>{joinError}</div>}
        <div style={{ fontWeight:700,fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Open Lobbies</div>
        {lobbies.length===0
          ? <div style={{ textAlign:'center',color:'var(--text-3)',fontSize:13,padding:24 }}>No open lobbies — create one!</div>
          : lobbies.map(lb=>(
            <div key={lb.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600,fontSize:13 }}>{lb.host?.username||'Unknown'}'s game</div>
                <div style={{ fontSize:11,color:'var(--text-3)' }}>Code: {lb.code}</div>
              </div>
              <button onClick={()=>joinLobby(lb.id)} style={{ padding:'7px 16px',background:'var(--accent)',border:'none',borderRadius:'var(--radius)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>Join</button>
            </div>
          ))
        }
      </div>
    </div>
  )

  // ── Waiting ───────────────────────────────────────────────
  if(mode==='online'&&onlinePhase==='waiting_opponent') return (
    <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,background:'var(--bg)',...ns }}>
      <div style={{ fontSize:36 }}>⏳</div>
      <div style={{ fontWeight:700,fontSize:18 }}>Waiting for opponent…</div>
      {lobby&&<div style={{ fontSize:13,color:'var(--text-3)' }}>Code: <strong style={{ color:'var(--accent)',letterSpacing:'0.1em' }}>{lobby.code}</strong></div>}
    </div>
  )

  // ── Placement ─────────────────────────────────────────────
  if((mode==='ai'&&phase==='placing')||(mode==='online'&&onlinePhase==='placing')) return (
    <div style={{ position:'absolute',inset:0,background:'var(--bg)',overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',padding:12,gap:10,...ns }}>
      <div style={{ display:'flex',alignItems:'center',gap:12,width:'100%',maxWidth:700 }}>
        <button onClick={resetAll} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit' }}>← Menu</button>
        <span style={{ fontWeight:800,fontSize:16 }}>Place Your Ships</span>
        {mode==='online'&&lobby&&<span style={{ fontSize:11,color:'var(--text-3)',marginLeft:'auto' }}>Code: <strong style={{ color:'var(--accent)' }}>{lobby.code}</strong></span>}
      </div>
      <PlacementBoard
        cellSize={Math.min(cellSize,34)}
        onDone={mode==='ai'?handlePlacementDone:submitShipsOnline}
        opponentUsername={opponentReady?(opponentProfile?.username||'Opponent'):null}
      />
    </div>
  )

  // ── Game over ─────────────────────────────────────────────
  if((mode==='ai'&&phase==='over')||(mode==='online'&&onlinePhase==='over')){
    const won=mode==='ai'?winner==='player':onlineWinner===user?.id
    return (
      <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,background:'var(--bg)',...ns }}>
        <div style={{ fontSize:48 }}>{won?'🏆':'💀'}</div>
        <div style={{ fontWeight:800,fontSize:28,color:won?'#22c55e':'var(--danger)' }}>{won?'Victory!':'Defeated!'}</div>
        <div style={{ fontSize:14,color:'var(--text-3)' }}>{won?'You sunk the enemy fleet!':'Your fleet was destroyed!'}</div>
        <div style={{ display:'flex',gap:12 }}>
          <button onClick={resetAll} style={{ padding:'10px 24px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text)',fontSize:14,cursor:'pointer',fontFamily:'inherit' }}>Menu</button>
          {mode==='ai'&&<button onClick={startAI} style={{ padding:'10px 24px',background:'var(--accent)',border:'none',borderRadius:'var(--radius)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>Play again</button>}
        </div>
      </div>
    )
  }

  // ── AI playing ────────────────────────────────────────────
  if(mode==='ai'&&phase==='playing'){
    const updatedAI=checkSunk(aiShips,playerShots)
    const updatedPlayer=checkSunk(playerShips,aiShots)

    const enemyGridEl=(
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Enemy Waters</div>
        <BattleGrid
          ships={updatedAI} shots={playerShots}
          onShot={turn==='player'?handlePlayerShot:undefined}
          showShips={false} cellSize={cellSize}
          disabled={turn!=='player'||!!enemyShell}
          firingShip={null}
          impactAnim={enemyImpact}
          sinkingShip={enemySinkShip}
          shellArc={enemyShell}
          onShellLanded={onPlayerShellLanded}
        />
      </div>
    )
    const playerGridEl=(
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Your Fleet</div>
        <BattleGrid
          ships={updatedPlayer} shots={aiShots}
          showShips={true} cellSize={cellSize} disabled={true}
          firingShip={playerFiringShip}
          impactAnim={playerImpact}
          sinkingShip={playerSinkShip}
          shellArc={playerShell}
          onShellLanded={()=>setPlayerShell(null)}
        />
      </div>
    )

    if(isMobile) return (
      <div style={{ position:'absolute',inset:0,background:'var(--bg)',overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'10px 8px',...ns }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,width:'100%' }}>
          <button onClick={resetAll} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'inherit' }}>← Menu</button>
          <span style={{ fontWeight:700,fontSize:14,flex:1,textAlign:'center' }}>Battleship</span>
        </div>
        <EventBanner event={banner}/>
        {enemyGridEl}
        {playerGridEl}
      </div>
    )

    return (
      <div style={{ position:'absolute',inset:0,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:14,padding:16,...ns }}>
        {enemyGridEl}
        <div style={{ display:'flex',flexDirection:'column',gap:8,minWidth:140 }}>
          <button onClick={resetAll} style={{ padding:'6px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer',fontSize:11,fontFamily:'inherit' }}>← Menu</button>
          <EventBanner event={banner}/>
          <ShipHealth ships={updatedAI}     shots={playerShots} label="ENEMY FLEET"/>
          <ShipHealth ships={updatedPlayer} shots={aiShots}     label="YOUR FLEET"/>
        </div>
        {playerGridEl}
      </div>
    )
  }

  // ── Online playing ────────────────────────────────────────
  if(mode==='online'&&onlinePhase==='playing'){
    const myShipsChecked=checkSunk(myShips,oppShots)
    const oppName=opponentProfile?.username||'Opponent'
    const myName=profile?.username||'You'

    const enemyGridEl=(
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Enemy Waters</div>
        <BattleGrid
          ships={[]} shots={myShots}
          onShot={isMyTurnOnline?handleCellSelect:undefined}
          showShips={false} cellSize={cellSize}
          disabled={!isMyTurnOnline||!!onlineEnemyShell}
          firingShip={null}
          impactAnim={onlineEnemyImpact}
          sinkingShip={onlineEnemySink}
          shellArc={onlineEnemyShell}
          onShellLanded={onOnlineEnemyShellLanded}
        />
        {/* Highlight selected cell */}
        {selectedCell&&isMyTurnOnline&&(
          <div style={{ fontSize:11,color:'var(--accent)' }}>
            Selected: {String.fromCharCode(65+selectedCell[1])}{selectedCell[0]+1}
          </div>
        )}
      </div>
    )
    const myGridEl=(
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
        <div style={{ fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em' }}>Your Fleet</div>
        <BattleGrid
          ships={myShipsChecked} shots={oppShots}
          showShips={true} cellSize={cellSize} disabled={true}
          firingShip={null}
          impactAnim={onlineMyImpact}
          sinkingShip={onlineMySink}
          shellArc={onlineMyShell}
          onShellLanded={onOnlineMyShellLanded}
        />
      </div>
    )

    const fireBtn=(
      <button
        onClick={handleFireButton}
        disabled={!selectedCell||!isMyTurnOnline}
        style={{
          padding:'12px 28px',
          background:selectedCell&&isMyTurnOnline?'#dc2626':'var(--bg-3)',
          border:`2px solid ${selectedCell&&isMyTurnOnline?'#dc2626':'var(--border-2)'}`,
          borderRadius:'var(--radius-lg)',
          color:selectedCell&&isMyTurnOnline?'#fff':'var(--text-3)',
          fontSize:15,fontWeight:700,cursor:selectedCell&&isMyTurnOnline?'pointer':'not-allowed',
          fontFamily:'inherit',
          transition:'all 0.2s',
          boxShadow:selectedCell&&isMyTurnOnline?'0 0 16px rgba(220,38,38,0.4)':'none',
        }}>
        🔥 FIRE{selectedCell?` → ${String.fromCharCode(65+selectedCell[1])}${selectedCell[0]+1}`:''}
      </button>
    )

    if(isMobile) return (
      <div style={{ position:'absolute',inset:0,background:'var(--bg)',overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',gap:8,padding:'10px 8px',...ns }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,width:'100%' }}>
          <button onClick={resetAll} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'inherit' }}>← Menu</button>
          <span style={{ fontWeight:700,fontSize:14,flex:1,textAlign:'center' }}>Battleship</span>
        </div>
        <EventBanner event={onlineBanner}/>
        {enemyGridEl}
        {isMyTurnOnline&&fireBtn}
        {myGridEl}
      </div>
    )

    return (
      <div style={{ position:'absolute',inset:0,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:14,padding:16,...ns }}>
        {enemyGridEl}
        <div style={{ display:'flex',flexDirection:'column',gap:8,minWidth:150,alignItems:'center' }}>
          <button onClick={resetAll} style={{ width:'100%',padding:'6px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer',fontSize:11,fontFamily:'inherit' }}>← Menu</button>
          <EventBanner event={onlineBanner}/>
          {fireBtn}
          <ShipHealth ships={myShipsChecked} shots={oppShots} label="YOUR FLEET"/>
          {lobby&&<div style={{ fontSize:10,color:'var(--text-3)',textAlign:'center' }}>Code: <strong>{lobby.code}</strong></div>}
        </div>
        {myGridEl}
      </div>
    )
  }

  return null
}
