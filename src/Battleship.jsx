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
const SHELL_MS = 1400

// ── Helpers ───────────────────────────────────────────────────
const emptyGrid = () => Array.from({length:SIZE}, () => Array(SIZE).fill(null))
function shipCells(row, col, len, horiz) {
  return Array.from({length:len}, (_,i) => horiz ? [row, col+i] : [row+i, col])
}
function canPlaceOnGrid(grid, name, row, col, len, horiz) {
  for (const [r,c] of shipCells(row, col, len, horiz)) {
    if (r<0||r>=SIZE||c<0||c>=SIZE) return false
    if (grid[r][c] && grid[r][c]!==name) return false
  }
  return true
}
function randomPlacement() {
  const grid = emptyGrid(), placed = []
  for (const ship of SHIPS) {
    let ok = false
    while (!ok) {
      const horiz = Math.random()>0.5
      const row = Math.floor(Math.random()*SIZE)
      const col = Math.floor(Math.random()*SIZE)
      if (canPlaceOnGrid(grid, ship.name, row, col, ship.len, horiz)) {
        const cells = shipCells(row, col, ship.len, horiz)
        cells.forEach(([r,c]) => { grid[r][c] = ship.name })
        placed.push({name:ship.name, len:ship.len, cells, horiz, sunk:false})
        ok = true
      }
    }
  }
  return placed
}
function checkSunk(ships, shots) {
  return ships.map(s => ({...s, sunk: s.cells.every(([r,c]) => shots.some(([sr,sc])=>sr===r&&sc===c))}))
}
function isHit(ships, r, c) { return ships.some(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c)) }
function allSunk(ships) { return ships.length>0 && ships.every(s=>s.sunk) }
function getShipColor(name) { return SHIPS.find(s=>s.name===name)?.color||'#3b82f6' }
function makeCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

function aiShot(shots, ships) {
  const hits = shots.filter(([r,c]) => isHit(ships,r,c))
  const sunkCells = ships.filter(s=>s.sunk).flatMap(s=>s.cells)
  const unsunkHits = hits.filter(([r,c]) => !sunkCells.some(([sr,sc])=>sr===r&&sc===c))
  const tried = new Set(shots.map(([r,c])=>`${r},${c}`))
  const cands = []
  if (unsunkHits.length>0)
    for (const [hr,hc] of unsunkHits)
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr=hr+dr, nc=hc+dc
        if (nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!tried.has(`${nr},${nc}`)) cands.push([nr,nc])
      }
  if (cands.length>0) return cands[Math.floor(Math.random()*cands.length)]
  const all=[]
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (!tried.has(`${r},${c}`)) all.push([r,c])
  return all[Math.floor(Math.random()*all.length)]
}

// ── SVG Ship ──────────────────────────────────────────────────
function ShipModel({name, len, horiz, cellSize, sunk, hit, firing}) {
  const w = horiz ? len*cellSize : cellSize
  const h = horiz ? cellSize : len*cellSize
  const p = 2
  const col   = sunk?'#7f1d1d':hit?'#b45309':getShipColor(name)
  const light = sunk?'#991b1b':hit?'#d97706':'#93c5fd'
  const dark  = sunk?'#450a0a':hit?'#92400e':'#1e3a8a'
  const L = len*cellSize - p*2
  const T = cellSize - p*2
  return (
    <svg width={w} height={h} style={{display:'block',overflow:'visible'}}>
      <g transform={horiz?`translate(${p},${p})`:`translate(${p},${p}) rotate(90,${T/2},${T/2}) translate(0,${-(L-T)/2})`}>
        <rect x={0} y={T*0.2} width={L} height={T*0.8} rx={T*0.15} fill={col}/>
        <rect x={T*0.3} y={T*0.1} width={L-T*0.5} height={T*0.35} rx={T*0.08} fill={light} opacity={0.4}/>
        <polygon points={`0,${T*0.5} ${T*0.35},${T*0.2} ${T*0.35},${T}`} fill={dark} opacity={0.5}/>
        <rect x={L-T*0.25} y={T*0.35} width={T*0.25} height={T*0.65} rx={T*0.08} fill={dark} opacity={0.4}/>
        {len>=4&&<rect x={L*0.35} y={0} width={L*0.22} height={T*0.3} rx={T*0.06} fill={light} opacity={0.6}/>}
        {len>=3&&<circle cx={L*0.28} cy={T*0.25} r={T*0.09} fill={light} opacity={0.7}/>}
        {len>=5&&<circle cx={L*0.65} cy={T*0.25} r={T*0.09} fill={light} opacity={0.7}/>}
        {len>=4&&<line x1={L*0.47} y1={0} x2={L*0.47} y2={-T*0.3} stroke={light} strokeWidth={1.5} opacity={0.6}/>}
        {len>=3&&<line x1={L*0.28} y1={T*0.25} x2={L*0.28} y2={firing?-T*0.8:-T*0.1} stroke={light} strokeWidth={2.5} strokeLinecap="round"/>}
        {len>=5&&<line x1={L*0.65} y1={T*0.25} x2={L*0.65} y2={firing?-T*0.8:-T*0.1} stroke={light} strokeWidth={2.5} strokeLinecap="round"/>}
        {firing&&len>=3&&<><circle cx={L*0.28} cy={-T*0.9} r={T*0.18} fill="#fbbf24" opacity={0.9}/><circle cx={L*0.28} cy={-T*0.9} r={T*0.1} fill="#fff" opacity={0.8}/></>}
        {firing&&len>=5&&<><circle cx={L*0.65} cy={-T*0.9} r={T*0.18} fill="#fbbf24" opacity={0.9}/><circle cx={L*0.65} cy={-T*0.9} r={T*0.1} fill="#fff" opacity={0.8}/></>}
        {sunk&&<><line x1={L*0.3} y1={T*0.2} x2={L*0.4} y2={T*0.8} stroke="#fca5a5" strokeWidth={1.5} opacity={0.8}/><line x1={L*0.6} y1={T*0.15} x2={L*0.7} y2={T*0.9} stroke="#fca5a5" strokeWidth={1.5} opacity={0.8}/></>}
      </g>
    </svg>
  )
}

// ── Shell arc ─────────────────────────────────────────────────
function ShellArc({srcX, srcY, dstX, dstY, duration, onLand}) {
  const [prog, setProg] = useState(0)
  const startRef = useRef(null), rafRef = useRef(null)
  useEffect(() => {
    const go = ts => {
      if (!startRef.current) startRef.current = ts
      const p = Math.min((ts-startRef.current)/duration, 1)
      setProg(p)
      if (p<1) rafRef.current = requestAnimationFrame(go)
      else onLand?.()
    }
    rafRef.current = requestAnimationFrame(go)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])
  const x = srcX + (dstX-srcX)*prog
  const arcH = Math.max(Math.abs(dstY-srcY), Math.abs(dstX-srcX))*0.6
  const y = srcY + (dstY-srcY)*prog - arcH*4*prog*(1-prog)
  return (
    <div style={{position:'absolute',left:0,top:0,pointerEvents:'none',zIndex:30}}>
      <svg style={{overflow:'visible',position:'absolute',left:0,top:0}} width={0} height={0}>
        {[0.15,0.1,0.05].map((back,i) => {
          const tp = Math.max(0,prog-back)
          const tx = srcX+(dstX-srcX)*tp, ty = srcY+(dstY-srcY)*tp-arcH*4*tp*(1-tp)
          return <circle key={i} cx={tx} cy={ty} r={3-i} fill="#f97316" opacity={0.4-i*0.1}/>
        })}
        <circle cx={x} cy={y} r={4} fill="#fbbf24" opacity={0.95}/>
        <circle cx={x} cy={y} r={2} fill="#fff" opacity={0.8}/>
      </svg>
    </div>
  )
}

// ── Splash ────────────────────────────────────────────────────
function Splash({x, y, size}) {
  const [f, setF] = useState(0)
  useEffect(() => { const t=setInterval(()=>setF(v=>v+1),60); return()=>clearInterval(t) }, [])
  if (f>10) return null
  const h = size*1.1*Math.sin((f/10)*Math.PI)
  const op = 1-f/11, r = size*0.35
  return (
    <div style={{position:'absolute',left:x-r,top:y-h-r,width:r*2,height:h+r*2,pointerEvents:'none',zIndex:25}}>
      <svg width={r*2} height={h+r*2} style={{overflow:'visible'}}>
        <ellipse cx={r} cy={h+r} rx={r*0.85} ry={r*0.3} fill="#93c5fd" opacity={op*0.5}/>
        <line x1={r} y1={h+r} x2={r} y2={r*0.3} stroke="#bfdbfe" strokeWidth={size*0.18} strokeLinecap="round" opacity={op}/>
        {[-0.7,-0.35,0.35,0.7].map((dx,i)=>(<line key={i} x1={r} y1={r*0.5+h*0.3} x2={r+dx*size*0.55} y2={0} stroke="#e0f2fe" strokeWidth={size*0.1} strokeLinecap="round" opacity={op*0.65}/>))}
      </svg>
    </div>
  )
}

// ── Explosion ─────────────────────────────────────────────────
function Explosion({x, y, size}) {
  const [f, setF] = useState(0)
  const seeds = useRef([...Array(8)].map(()=>Math.random()))
  useEffect(() => { const t=setInterval(()=>setF(v=>v+1),70); return()=>clearInterval(t) }, [])
  if (f>10) return null
  const maxR=size*0.7, r=maxR*(f/10), op=1-f/11
  const cols=['#fbbf24','#f97316','#ef4444','#dc2626','#b91c1c']
  const col=cols[Math.min(f,cols.length-1)]
  return (
    <div style={{position:'absolute',left:x-maxR,top:y-maxR,width:maxR*2,height:maxR*2,pointerEvents:'none',zIndex:25}}>
      <svg width={maxR*2} height={maxR*2}>
        <circle cx={maxR} cy={maxR} r={r*1.1} stroke={col} strokeWidth={2} fill="none" opacity={op*0.4}/>
        <circle cx={maxR} cy={maxR} r={r*0.6} fill={col} opacity={op*0.9}/>
        <circle cx={maxR} cy={maxR} r={r*0.3} fill="#fff" opacity={op*0.7}/>
        {seeds.current.map((seed,i) => {
          const angle=(i/8)*Math.PI*2+seed*0.5, sr=r*(0.6+seed*0.5)
          return <circle key={i} cx={maxR+Math.cos(angle)*sr} cy={maxR+Math.sin(angle)*sr} r={maxR*0.07} fill={cols[i%cols.length]} opacity={op}/>
        })}
        {f>4&&<circle cx={maxR} cy={maxR-r*0.3} r={r*0.5} fill="#6b7280" opacity={(f-4)/11*0.4}/>}
      </svg>
    </div>
  )
}

// ── Sinking ship ──────────────────────────────────────────────
function SinkingShip({ship, cellSize}) {
  const [f, setF] = useState(0)
  const N = 20
  useEffect(() => { const t=setInterval(()=>setF(v=>v+1),100); return()=>clearInterval(t) }, [])
  if (f>N) return null
  const prog=f/N, op=Math.max(0,1-prog*1.2)
  const [r0,c0]=ship.cells[0]
  return (
    <div style={{
      position:'absolute', top:r0*cellSize, left:c0*cellSize,
      width:ship.horiz?ship.len*cellSize:cellSize,
      height:ship.horiz?cellSize:ship.len*cellSize,
      pointerEvents:'none', zIndex:10, opacity:op,
      transform:`translateY(${prog*cellSize*0.7}px) rotate(${prog*(ship.horiz?12:-8)}deg)`,
      transformOrigin:'center',
    }}>
      <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk hit={false}/>
    </div>
  )
}

// ── Event banner ──────────────────────────────────────────────
function EventBanner({event}) {
  const styles = {
    hit:          {bg:'#7f1d1d',border:'#ef4444',text:'#fca5a5',icon:'💥'},
    miss:         {bg:'#1e3a5f',border:'#3b82f6',text:'#93c5fd',icon:'💦'},
    sunk:         {bg:'#713f12',border:'#f59e0b',text:'#fde68a',icon:'🔥'},
    info:         {bg:'var(--bg-2)',border:'var(--border-2)',text:'var(--text)',icon:'ℹ️'},
    firing:       {bg:'#1a1a2e',border:'#818cf8',text:'#c7d2fe',icon:'🎯'},
    enemy_firing: {bg:'#1a1a1a',border:'#ef4444',text:'#fca5a5',icon:'⚠️'},
  }
  const s = styles[event?.type]||styles.info
  return (
    <div style={{
      background:s.bg, border:`1px solid ${s.border}`, borderRadius:'var(--radius)',
      padding:'8px 16px', fontSize:13, fontWeight:700, color:s.text,
      textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      minHeight:40, boxShadow:`0 0 10px ${s.border}44`,
    }}>
      {event ? <><span>{s.icon}</span><span>{event.text}</span></> : <span style={{opacity:0}}>.</span>}
    </div>
  )
}

// ── Battle grid ───────────────────────────────────────────────
function BattleGrid({ships, shots, onShot, showShips, cellSize, disabled, firingShip, impactAnim, sinkingShip, shellArc, onShellLanded, sunkEnemyShips}) {
  const [hover, setHover] = useState(null)
  const shotSet = new Set((shots||[]).map(([r,c])=>`${r},${c}`))
  const updatedShips = checkSunk(ships, shots||[])
  const renderedShips = new Set()

  return (
    <div style={{position:'relative',display:'inline-block'}}>
      <div style={{display:'inline-block',border:'1px solid var(--border-2)',borderRadius:4,overflow:'visible',position:'relative'}}>
        <div style={{display:'flex',paddingLeft:cellSize}}>
          {Array.from({length:SIZE},(_,i)=>(
            <div key={i} style={{width:cellSize,textAlign:'center',fontSize:Math.max(8,cellSize*0.35),color:'var(--text-3)',fontWeight:600,lineHeight:`${cellSize*0.7}px`}}>{String.fromCharCode(65+i)}</div>
          ))}
        </div>
        <div style={{position:'relative',cursor:disabled?'default':'crosshair'}} onMouseLeave={()=>setHover(null)}>
          {Array.from({length:SIZE},(_,r)=>(
            <div key={r} style={{display:'flex'}}>
              <div style={{width:cellSize,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(8,cellSize*0.35),color:'var(--text-3)',fontWeight:600}}>{r+1}</div>
              {Array.from({length:SIZE},(_,c)=>{
                const key=`${r},${c}`
                const wasShot=shotSet.has(key)
                const ship=updatedShips.find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c))
                const hit=wasShot&&!!ship, miss=wasShot&&!ship, sunk=hit&&ship?.sunk
                const isHov=hover&&hover[0]===r&&hover[1]===c&&!disabled&&!wasShot
                return (
                  <div key={c}
                    onMouseEnter={()=>!disabled&&setHover([r,c])}
                    onClick={()=>!disabled&&!wasShot&&onShot&&onShot(r,c)}
                    style={{
                      width:cellSize, height:cellSize,
                      border:'1px solid var(--border)',
                      background: miss?'rgba(59,130,246,0.15)':sunk?'rgba(127,29,29,0.25)':hit?'rgba(239,68,68,0.2)':isHov?'rgba(99,102,241,0.14)':'transparent',
                      position:'relative', boxSizing:'border-box', transition:'background 0.1s',
                    }}
                  >
                    {/* Miss — light blue dot */}
                    {miss&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <div style={{width:cellSize*0.3,height:cellSize*0.3,borderRadius:'50%',background:'#60a5fa',opacity:0.85}}/>
                    </div>}
                    {/* Hit — red cross */}
                    {hit&&!sunk&&<svg style={{position:'absolute',inset:0}} width={cellSize} height={cellSize}>
                      <line x1={cellSize*0.2} y1={cellSize*0.2} x2={cellSize*0.8} y2={cellSize*0.8} stroke="#ef4444" strokeWidth={2.5}/>
                      <line x1={cellSize*0.8} y1={cellSize*0.2} x2={cellSize*0.2} y2={cellSize*0.8} stroke="#ef4444" strokeWidth={2.5}/>
                    </svg>}
                    {/* Hover reticle */}
                    {isHov&&<svg style={{position:'absolute',inset:0}} width={cellSize} height={cellSize}>
                      <circle cx={cellSize/2} cy={cellSize/2} r={cellSize*0.35} stroke="#818cf8" strokeWidth={1.5} fill="none" opacity={0.7}/>
                      <line x1={cellSize/2} y1={cellSize*0.1} x2={cellSize/2} y2={cellSize*0.35} stroke="#818cf8" strokeWidth={1.5}/>
                      <line x1={cellSize/2} y1={cellSize*0.65} x2={cellSize/2} y2={cellSize*0.9} stroke="#818cf8" strokeWidth={1.5}/>
                      <line x1={cellSize*0.1} y1={cellSize/2} x2={cellSize*0.35} y2={cellSize/2} stroke="#818cf8" strokeWidth={1.5}/>
                      <line x1={cellSize*0.65} y1={cellSize/2} x2={cellSize*0.9} y2={cellSize/2} stroke="#818cf8" strokeWidth={1.5}/>
                    </svg>}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Own ships (show on player grid) */}
          {showShips && updatedShips.map(ship => {
            if (renderedShips.has(ship.name)) return null
            renderedShips.add(ship.name)
            const [r0,c0]=ship.cells[0]
            const hasHit=ship.cells.some(([r,c])=>shotSet.has(`${r},${c}`))
            if (sinkingShip?.name===ship.name) return null
            return (
              <div key={ship.name} style={{
                position:'absolute', top:r0*cellSize, left:c0*cellSize,
                width:ship.horiz?ship.len*cellSize:cellSize,
                height:ship.horiz?cellSize:ship.len*cellSize,
                pointerEvents:'none', zIndex:5,
                opacity:ship.sunk?0:1, transition:'opacity 0.3s',
                filter:firingShip?.name===ship.name?'brightness(1.3)':'none',
              }}>
                <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={ship.sunk} hit={hasHit&&!ship.sunk} firing={firingShip?.name===ship.name}/>
              </div>
            )
          })}

          {/* Sunk enemy ships revealed on enemy grid */}
          {sunkEnemyShips && sunkEnemyShips.filter(s=>s.sunk).map(ship => {
            const [r0,c0]=ship.cells[0]
            return (
              <div key={`sunk-${ship.name}`} style={{
                position:'absolute', top:r0*cellSize, left:c0*cellSize,
                width:ship.horiz?ship.len*cellSize:cellSize,
                height:ship.horiz?cellSize:ship.len*cellSize,
                pointerEvents:'none', zIndex:4, opacity:0.65,
              }}>
                <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk hit={false}/>
              </div>
            )
          })}

          {sinkingShip&&<SinkingShip ship={sinkingShip} cellSize={cellSize}/>}
          {shellArc&&<ShellArc srcX={shellArc.srcX} srcY={shellArc.srcY} dstX={shellArc.dstX} dstY={shellArc.dstY} duration={SHELL_MS} onLand={onShellLanded}/>}
          {impactAnim?.type==='explosion'&&<Explosion x={(impactAnim.cell[1]+0.5)*cellSize} y={(impactAnim.cell[0]+0.5)*cellSize} size={cellSize}/>}
          {impactAnim?.type==='splash'&&<Splash x={(impactAnim.cell[1]+0.5)*cellSize} y={(impactAnim.cell[0]+0.5)*cellSize} size={cellSize}/>}
        </div>
      </div>
    </div>
  )
}

// ── Placement board ───────────────────────────────────────────
function PlacementBoard({onDone, cellSize, opponentUsername}) {
  const [ships, setShips] = useState([])  // placed ships
  const [rotations, setRotations] = useState(() => Object.fromEntries(SHIPS.map(s=>[s.name,true])))
  const [dragState, setDragState] = useState(null) // {name,len,horiz,offsetRow,offsetCol,fromBoard}
  const [previewCell, setPreviewCell] = useState(null) // [r,c] raw cell under cursor/touch
  const gridRef = useRef(null)
  const wrapRef = useRef(null)

  // Build grid from placed ships (always fresh, no stale state)
  const buildGrid = (shipList) => {
    const g = emptyGrid()
    for (const s of shipList) s.cells.forEach(([r,c]) => { g[r][c]=s.name })
    return g
  }

  const placedNames = new Set(ships.map(s=>s.name))
  const allPlaced = ships.length === SHIPS.length

  // Convert pointer position to grid cell (strict — null if outside)
  const getCell = (clientX, clientY) => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const c = Math.floor((clientX - rect.left) / cellSize)
    const r = Math.floor((clientY - rect.top)  / cellSize)
    if (r<0||r>=SIZE||c<0||c>=SIZE) return null
    return [r, c]
  }

  // Compute snap origin from raw cell + drag offset
  const snapOrigin = (rawCell, ds) => {
    if (!rawCell || !ds) return null
    const [r, c] = rawCell
    return ds.horiz ? [r, c - ds.offsetCol] : [r - ds.offsetRow, c]
  }

  const canSnap = (rawCell, ds, currentShips) => {
    const origin = snapOrigin(rawCell, ds)
    if (!origin) return false
    const [r0, c0] = origin
    const grid = buildGrid(currentShips.filter(s => s.name !== ds.name))
    return canPlaceOnGrid(grid, ds.name, r0, c0, ds.len, ds.horiz)
  }

  const commitDrop = (rawCell, ds, currentShips) => {
    const origin = snapOrigin(rawCell, ds)
    if (!origin) return currentShips
    const [r0, c0] = origin
    const remaining = currentShips.filter(s => s.name !== ds.name)
    const grid = buildGrid(remaining)
    if (!canPlaceOnGrid(grid, ds.name, r0, c0, ds.len, ds.horiz)) return currentShips
    const cells = shipCells(r0, c0, ds.len, ds.horiz)
    return [...remaining, {name:ds.name, len:ds.len, cells, horiz:ds.horiz, sunk:false}]
  }

  const rotateShip = (name) => {
    const placed = ships.find(s=>s.name===name)
    const len = SHIPS.find(s=>s.name===name).len
    if (placed) {
      const newH = !placed.horiz
      const [r0,c0] = placed.cells[0]
      const remaining = ships.filter(s=>s.name!==name)
      const grid = buildGrid(remaining)
      if (canPlaceOnGrid(grid, name, r0, c0, len, newH)) {
        const cells = shipCells(r0, c0, len, newH)
        setShips([...remaining, {name, len, cells, horiz:newH, sunk:false}])
        setRotations(p=>({...p,[name]:newH}))
      }
    } else {
      setRotations(p=>({...p,[name]:!p[name]}))
    }
  }

  const randomize = () => {
    const placed = randomPlacement()
    setShips(placed)
    setRotations(Object.fromEntries(placed.map(s=>[s.name,s.horiz])))
  }
  const reset = () => { setShips([]); setRotations(Object.fromEntries(SHIPS.map(s=>[s.name,true]))) }

  // ── Mouse drag ────────────────────────────────────────────
  const startDrag = (e, name, len, horiz, fromBoard, offsetRow=0, offsetCol=0) => {
    e.preventDefault()
    setDragState({name, len, horiz, offsetRow, offsetCol, fromBoard})
  }

  useEffect(() => {
    if (!dragState) return
    const onMove = (e) => {
      const {clientX, clientY} = e.touches ? e.touches[0] : e
      setPreviewCell(getCell(clientX, clientY))
    }
    const onUp = (e) => {
      const {clientX, clientY} = e.changedTouches ? e.changedTouches[0] : e
      const cell = getCell(clientX, clientY)
      if (cell) setShips(cur => commitDrop(cell, dragState, cur))
      setDragState(null)
      setPreviewCell(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, {passive:false})
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragState, ships, cellSize])

  // Preview rendering
  const preview = dragState && previewCell ? (() => {
    const origin = snapOrigin(previewCell, dragState)
    if (!origin) return {cells:[], valid:false}
    const [r0,c0] = origin
    // Cells clamped to visible grid
    const cells = shipCells(r0, c0, dragState.len, dragState.horiz).filter(([r,c])=>r>=0&&r<SIZE&&c>=0&&c<SIZE)
    const grid = buildGrid(ships.filter(s=>s.name!==dragState.name))
    const valid = canPlaceOnGrid(grid, dragState.name, r0, c0, dragState.len, dragState.horiz)
    return {cells, valid}
  })() : {cells:[], valid:false}

  return (
    <div ref={wrapRef} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,width:'100%'}}>
      {opponentUsername&&(
        <div style={{background:'#166534',border:'1px solid #22c55e',borderRadius:'var(--radius)',padding:'8px 16px',color:'#86efac',fontSize:13,fontWeight:600,textAlign:'center',width:'100%',maxWidth:550}}>
          ✅ {opponentUsername} is ready! Place your ships and click Ready.
        </div>
      )}
      <div style={{display:'flex',gap:8}}>
        <button onClick={randomize} style={{padding:'6px 14px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg-2)',color:'var(--text)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>🎲 Random</button>
        {ships.length>0&&<button onClick={reset} style={{padding:'6px 14px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg-2)',color:'var(--text)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>↺ Reset</button>}
        <button onClick={()=>allPlaced&&onDone(ships)} disabled={!allPlaced}
          style={{padding:'6px 20px',background:allPlaced?'#22c55e':'var(--bg-3)',border:`1px solid ${allPlaced?'#22c55e':'var(--border-2)'}`,borderRadius:'var(--radius)',color:allPlaced?'#fff':'var(--text-3)',fontSize:12,fontWeight:600,cursor:allPlaced?'pointer':'not-allowed',fontFamily:'inherit',transition:'all 0.2s'}}>
          {allPlaced?'✓ Ready!':`Place all ships (${ships.length}/${SHIPS.length})`}
        </button>
      </div>

      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center',alignItems:'flex-start'}}>
        {/* Ship bank */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Fleet — drag to board</div>
          {SHIPS.map(ship => {
            const placed = placedNames.has(ship.name)
            const horiz = rotations[ship.name]
            return (
              <div key={ship.name} style={{display:'flex',alignItems:'center',gap:8,opacity:placed?0.4:1}}>
                <div style={{fontSize:10,color:'var(--text-3)',width:68,flexShrink:0}}>{ship.name} ({ship.len})</div>
                <div
                  onMouseDown={e=>!placed&&startDrag(e, ship.name, ship.len, horiz, false)}
                  onTouchStart={e=>{
                    if (placed) return
                    e.preventDefault()
                    const t=e.touches[0]
                    setDragState({name:ship.name,len:ship.len,horiz,offsetRow:0,offsetCol:0,fromBoard:false})
                    setPreviewCell(getCell(t.clientX,t.clientY))
                  }}
                  style={{
                    cursor:placed?'default':'grab',
                    display:'inline-block',
                    width:horiz?ship.len*cellSize:cellSize,
                    height:horiz?cellSize:ship.len*cellSize,
                    flexShrink:0,
                    outline:placed?'none':'2px dashed var(--border-2)',
                    borderRadius:4,
                    filter:placed?'grayscale(1)':'none',
                    WebkitUserSelect:'none', userSelect:'none',
                  }}
                >
                  <ShipModel name={ship.name} len={ship.len} horiz={horiz} cellSize={cellSize} sunk={false} hit={false}/>
                </div>
                <span style={{fontSize:9,color:placed?'#22c55e':'var(--text-3)'}}>{placed?'✓ placed':'drag to board'}</span>
              </div>
            )
          })}
        </div>

        {/* Placement grid */}
        <div>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Your Board</div>
          <div style={{display:'inline-block',border:'1px solid var(--border-2)',borderRadius:4,position:'relative'}}>
            <div style={{display:'flex',paddingLeft:cellSize}}>
              {Array.from({length:SIZE},(_,i)=>(
                <div key={i} style={{width:cellSize,textAlign:'center',fontSize:Math.max(8,cellSize*0.35),color:'var(--text-3)',fontWeight:600,lineHeight:`${cellSize*0.7}px`}}>{String.fromCharCode(65+i)}</div>
              ))}
            </div>
            <div ref={gridRef} style={{position:'relative'}}>
              {Array.from({length:SIZE},(_,r)=>(
                <div key={r} style={{display:'flex'}}>
                  <div style={{width:cellSize,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(8,cellSize*0.35),color:'var(--text-3)',fontWeight:600}}>{r+1}</div>
                  {Array.from({length:SIZE},(_,c)=>{
                    const isPrev = preview.cells.some(([pr,pc])=>pr===r&&pc===c)
                    return (
                      <div key={c} style={{
                        width:cellSize, height:cellSize,
                        border:'1px solid var(--border)',
                        background:isPrev?(preview.valid?'rgba(99,102,241,0.28)':'rgba(239,68,68,0.28)'):'transparent',
                        boxSizing:'border-box',
                      }}/>
                    )
                  })}
                </div>
              ))}
              {/* Placed ship models — click to rotate, drag to reposition */}
              {ships.map(ship => (
                <div key={ship.name}
                  onPointerDown={e=>{
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const rect=gridRef.current.getBoundingClientRect()
                    const localC=Math.floor((e.clientX-rect.left)/cellSize)
                    const localR=Math.floor((e.clientY-rect.top)/cellSize)
                    const offR=Math.max(0,localR-ship.cells[0][0]), offC=Math.max(0,localC-ship.cells[0][1])
                    e.currentTarget._dragStartX = e.clientX
                    e.currentTarget._dragStartY = e.clientY
                    e.currentTarget._dragOffR = offR
                    e.currentTarget._dragOffC = offC
                    e.currentTarget._didDrag = false
                  }}
                  onPointerMove={e=>{
                    const dx=e.clientX-e.currentTarget._dragStartX, dy=e.clientY-e.currentTarget._dragStartY
                    if(!e.currentTarget._didDrag && Math.hypot(dx,dy)>6) {
                      e.currentTarget._didDrag=true
                      setShips(cur=>cur.filter(s=>s.name!==ship.name))
                      setDragState({name:ship.name,len:ship.len,horiz:ship.horiz,offsetRow:e.currentTarget._dragOffR,offsetCol:e.currentTarget._dragOffC,fromBoard:true})
                    }
                    if(e.currentTarget._didDrag) setPreviewCell(getCell(e.clientX,e.clientY))
                  }}
                  onPointerUp={e=>{
                    if(!e.currentTarget._didDrag) rotateShip(ship.name)
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  }}
                  style={{
                    position:'absolute',
                    top:ship.cells[0][0]*cellSize, left:ship.cells[0][1]*cellSize,
                    width:ship.horiz?ship.len*cellSize:cellSize,
                    height:ship.horiz?cellSize:ship.len*cellSize,
                    cursor:'grab', zIndex:5,
                  }}
                >
                  <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cellSize={cellSize} sunk={false} hit={false}/>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    <span style={{background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:9,padding:'2px 5px',borderRadius:3}}>↻ rotate</span>
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
function ShipHealth({ships, shots, label}) {
  const checked=checkSunk(ships,shots)
  return (
    <div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 10px'}}>
      <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
      {checked.map(s=>(
        <div key={s.name} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
          <div style={{width:8,height:8,borderRadius:2,background:s.sunk?'#ef4444':'#22c55e',flexShrink:0,transition:'background 0.3s'}}/>
          <span style={{fontSize:11,color:s.sunk?'var(--text-3)':'var(--text)',textDecoration:s.sunk?'line-through':'none'}}>{s.name}</span>
          <span style={{fontSize:10,color:'var(--text-3)',marginLeft:'auto'}}>{s.len}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export function Battleship() {
  const [screen, setScreen] = useState('menu')
  const [mode,   setMode]   = useState(null)
  const [user,   setUser]   = useState(null)
  const [profile, setProfile] = useState(null)

  // AI
  const [phase,       setPhase]      = useState('placing')
  const [playerShips, setPlayerShips]= useState([])
  const [aiShips,     setAiShips]    = useState([])
  const [playerShots, setPlayerShots]= useState([])
  const [aiShots,     setAiShots]    = useState([])
  const [turn,        setTurn]       = useState('player')
  const [winner,      setWinner]     = useState(null)
  const [enemyImpact, setEnemyImpact]= useState(null)
  const [playerImpact,setPlayerImpact]=useState(null)
  const [enemySink,   setEnemySink]  = useState(null)
  const [playerSink,  setPlayerSink] = useState(null)
  const [enemyShell,  setEnemyShell] = useState(null)
  const [playerShell, setPlayerShell]= useState(null)
  const [pendingShot, setPendingShot]= useState(null)
  const [banner,      setBanner]     = useState(null)
  const [playerFiring,setPlayerFiring]=useState(null)

  // Online
  const [lobby,          setLobby]         = useState(null)
  const [lobbies,        setLobbies]        = useState([])
  const [onlinePhase,    setOnlinePhase]    = useState('lobby')
  const [opponentReady,  setOpponentReady]  = useState(false)
  const [opponentProfile,setOpponentProfile]= useState(null)
  const [myShots,        setMyShots]        = useState([])
  const [oppShots,       setOppShots]       = useState([])
  const [myShips,        setMyShips]        = useState([])
  const [onlineTurn,     setOnlineTurn]     = useState(null)
  const [onlineWinner,   setOnlineWinner]   = useState(null)
  const [joinCode,       setJoinCode]       = useState('')
  const [joinError,      setJoinError]      = useState('')
  const [oEnemyImpact,   setOEnemyImpact]   = useState(null)
  const [oMyImpact,      setOMyImpact]      = useState(null)
  const [oEnemyShell,    setOEnemyShell]    = useState(null)
  const [oMyShell,       setOMyShell]       = useState(null)
  const [oBanner,        setOBanner]        = useState(null)
  const [oEnemySink,     setOEnemySink]     = useState(null)
  const [oMySink,        setOMySink]        = useState(null)
  const [selectedCell,   setSelectedCell]   = useState(null)
  const [pendingOShot,   setPendingOShot]   = useState(null)
  const subRef = useRef(null)

  // Responsive — cell size keeps both grids on screen
  const [win, setWin] = useState({w:window.innerWidth, h:window.innerHeight})
  useEffect(()=>{
    const h=()=>setWin({w:window.innerWidth,h:window.innerHeight})
    window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h)
  },[])
  const isMobile = win.w < 760
  // On mobile: one grid fills width. On desktop: two grids + 160px panel
  const cellSize = isMobile
    ? Math.floor(Math.min((win.w-48)/(SIZE+1), (win.h-220)/(SIZE+1)))
    : Math.floor(Math.min((win.w-180)/(2*(SIZE+1)), (win.h-160)/(SIZE+1)))

  const ns = {userSelect:'none',WebkitUserSelect:'none'}

  // Zero out the .content padding so the game fills edge-to-edge
  useEffect(() => {
    const el = document.querySelector('.content')
    if (!el) return
    const prev = el.style.padding
    el.style.padding = '0'
    el.style.overflowY = 'hidden'
    return () => {
      el.style.padding = prev
      el.style.overflowY = ''
    }
  }, [])

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user??null)
      if(session?.user) supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))
    })
  },[])

  const showBanner=(setter,text,type,dur=2200)=>{ setter({text,type}); setTimeout(()=>setter(null),dur) }
  const getRandomFiringShip=(ships)=>{const a=ships.filter(s=>!s.sunk&&s.len>=2);return a[Math.floor(Math.random()*a.length)]||null}

  // ── AI ────────────────────────────────────────────────────
  const startAI=()=>{
    setAiShips(randomPlacement());setPlayerShots([]);setAiShots([])
    setTurn('player');setWinner(null);setBanner(null)
    setEnemyImpact(null);setPlayerImpact(null);setEnemySink(null);setPlayerSink(null)
    setEnemyShell(null);setPlayerShell(null);setPendingShot(null);setPlayerFiring(null)
    setPhase('placing');setMode('ai');setScreen('game')
  }

  const handlePlacementDone=(ships)=>{ setPlayerShips(ships); setPhase('playing'); showBanner(setBanner,'Your turn — fire!','info') }

  const handlePlayerShot=useCallback((r,c)=>{
    if(turn!=='player'||winner) return
    if(playerShots.some(([sr,sc])=>sr===r&&sc===c)) return
    const fs=getRandomFiringShip(playerShips)
    if(fs) { setPlayerFiring(fs); setTimeout(()=>setPlayerFiring(null),350) }
    showBanner(setBanner,'🎯 You are firing…','firing',SHELL_MS+400)
    setEnemyShell({srcX:cellSize/2, srcY:-cellSize, dstX:(c+0.5)*cellSize, dstY:(r+0.5)*cellSize})
    setPendingShot([r,c])
    setTurn(null)
  },[turn,winner,playerShots,playerShips,cellSize])

  const onPlayerShellLanded=useCallback(()=>{
    setEnemyShell(null)
    if(!pendingShot) return
    const[r,c]=pendingShot; setPendingShot(null)
    const newShots=[...playerShots,[r,c]]
    const updatedAI=checkSunk(aiShips,newShots)
    const hit=isHit(aiShips,r,c)
    const newlySunk=updatedAI.find(s=>s.sunk&&!aiShips.find(a=>a.name===s.name)?.sunk)
    setEnemyImpact({cell:[r,c],type:hit?'explosion':'splash'})
    setTimeout(()=>setEnemyImpact(null),900)
    setAiShips(updatedAI); setPlayerShots(newShots)
    if(newlySunk){ setEnemySink(newlySunk); setTimeout(()=>setEnemySink(null),2200); showBanner(setBanner,`🔥 You sunk the enemy ${newlySunk.name}!`,'sunk',2500) }
    else showBanner(setBanner,hit?'💥 HIT!':'💦 MISS',hit?'hit':'miss')
    if(allSunk(updatedAI)){ setWinner('player'); setPhase('over'); return }
    setTurn('ai')
    setTimeout(()=>{
      setAiShots(prev=>{
        const cur=checkSunk(playerShips,prev)
        const shot=aiShot(prev,cur.length?cur:playerShips)
        showBanner(setBanner,'⚠️ AI is firing…','enemy_firing',SHELL_MS+400)
        setPlayerShell({srcX:(shot[1]+0.5)*cellSize, srcY:-cellSize, dstX:(shot[1]+0.5)*cellSize, dstY:(shot[0]+0.5)*cellSize})
        setTimeout(()=>{
          setPlayerShell(null)
          const newAiShots=[...prev,shot]
          const updatedP=checkSunk(playerShips,newAiShots)
          const aiHit=isHit(playerShips,shot[0],shot[1])
          const aiSunk=updatedP.find(s=>s.sunk&&!cur.find(p=>p.name===s.name)?.sunk)
          setPlayerImpact({cell:shot,type:aiHit?'explosion':'splash'})
          setTimeout(()=>setPlayerImpact(null),900)
          setPlayerShips(updatedP)
          if(aiSunk){ setPlayerSink(aiSunk); setTimeout(()=>setPlayerSink(null),2200); showBanner(setBanner,`💥 AI sunk your ${aiSunk.name}!`,'sunk',2500) }
          else showBanner(setBanner,aiHit?'🔥 AI hit your ship!':'💦 AI missed!',aiHit?'hit':'miss')
          if(allSunk(updatedP)){ setWinner('ai'); setPhase('over') }
          else { setTurn('player'); setTimeout(()=>showBanner(setBanner,'Your turn — fire!','info',10000),400) }
        },SHELL_MS)
        return newAiShots
      })
    },1200)
  },[pendingShot,playerShots,aiShips,playerShips,cellSize])

  // ── Online ────────────────────────────────────────────────
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
        showBanner(setOBanner,`${oppName} has fired!`,'enemy_firing',SHELL_MS+600)
        setOMyShell({srcX:(latest[1]+0.5)*cellSize,srcY:-cellSize,dstX:(latest[1]+0.5)*cellSize,dstY:(latest[0]+0.5)*cellSize})
        setPendingOShot({type:'incoming',cell:latest})
      }
      return newOppShots
    })
    supabase.from('profiles').select('*').eq('id',row.user_id).single().then(({data})=>{if(data)setOpponentProfile(data)})
  },[user,opponentProfile,cellSize])

  const onOMyShellLanded=useCallback(()=>{
    setOMyShell(null)
    if(!pendingOShot||pendingOShot.type!=='incoming') return
    const cell=pendingOShot.cell; setPendingOShot(null)
    setMyShips(cur=>{
      const hit=isHit(cur,cell[0],cell[1])
      setOMyImpact({cell,type:hit?'explosion':'splash'})
      setTimeout(()=>setOMyImpact(null),900)
      const updated=checkSunk(cur,oppShots)
      const newlySunk=updated.find(s=>s.sunk&&!cur.find(p=>p.name===s.name)?.sunk)
      if(newlySunk){ setOMySink(newlySunk); setTimeout(()=>setOMySink(null),2200); showBanner(setOBanner,`💥 Your ${newlySunk.name} was sunk!`,'sunk',2500) }
      else showBanner(setOBanner,hit?'🔥 Enemy hit your ship!':'💦 Enemy missed!',hit?'hit':'miss')
      return cur
    })
    setOnlineTurn(u=>user?.id)
    setTimeout(()=>showBanner(setOBanner,'Your turn — fire!','info',10000),400)
  },[pendingOShot,oppShots,user])

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
    showBanner(setOBanner,'🎯 You are firing…','firing',SHELL_MS+400)
    setOEnemyShell({srcX:cellSize/2,srcY:-cellSize,dstX:(c+0.5)*cellSize,dstY:(r+0.5)*cellSize})
    setPendingOShot({type:'outgoing',cell:[r,c],shots:newShots})
    await supabase.from('battleship_players').update({shots:newShots,updated_at:new Date().toISOString()}).eq('lobby_id',lobby.id).eq('user_id',user.id)
  }
  const onOEnemyShellLanded=useCallback(()=>{
    setOEnemyShell(null)
    if(!pendingOShot||pendingOShot.type!=='outgoing') return
    const{cell,shots}=pendingOShot; setPendingOShot(null)
    supabase.from('battleship_players').select('ships').eq('lobby_id',lobby?.id||'').neq('user_id',user?.id||'').single().then(({data:oppRow})=>{
      const oppShipsData=oppRow?.ships||[]
      const hit=isHit(oppShipsData,cell[0],cell[1])
      setOEnemyImpact({cell,type:hit?'explosion':'splash'})
      setTimeout(()=>setOEnemyImpact(null),900)
      const checked=checkSunk(oppShipsData,shots)
      const prev=checkSunk(oppShipsData,shots.slice(0,-1))
      const newlySunk=checked.find(s=>s.sunk&&!prev.find(p=>p.name===s.name)?.sunk)
      if(newlySunk){ setOEnemySink(newlySunk); setTimeout(()=>setOEnemySink(null),2200); showBanner(setOBanner,`🔥 You sunk the enemy ${newlySunk.name}!`,'sunk',2500) }
      else showBanner(setOBanner,hit?'💥 HIT!':'💦 MISS',hit?'hit':'miss')
      if(allSunk(checked)){ setOnlineWinner(user.id); supabase.from('battleship_lobbies').update({status:'finished'}).eq('id',lobby.id); setOnlinePhase('over') }
    })
  },[pendingOShot,lobby,user])

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
    setSelectedCell(null); setBanner(null); setOBanner(null)
    subRef.current?.unsubscribe()
  }

  const isMyTurnOnline = onlineTurn === user?.id

  // ── Menu ─────────────────────────────────────────────────
  if(screen==='menu') return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,background:'var(--bg)',padding:24,...ns}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:8}}>🚢</div>
        <div style={{fontWeight:800,fontSize:28,letterSpacing:'0.1em'}}>BATTLESHIP</div>
        <div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>Sink the enemy fleet</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:300}}>
        <button onClick={startAI} style={{padding:'14px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-lg)',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>🤖 vs Computer</button>
        <button onClick={()=>{setMode('online');setScreen('game');setOnlinePhase('lobby')}} style={{padding:'14px',background:'var(--bg-2)',border:'2px solid var(--border-2)',borderRadius:'var(--radius-lg)',color:'var(--text)',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>🌐 Play Online</button>
      </div>
    </div>
  )

  if(mode==='online'&&onlinePhase==='lobby') return (
    <div style={{position:'absolute',inset:0,background:'var(--bg)',overflowY:'auto',padding:16,...ns}}>
      <div style={{maxWidth:500,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <button onClick={resetAll} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>← Back</button>
          <span style={{fontWeight:800,fontSize:18}}>Online Lobbies</span>
          <button onClick={loadLobbies} style={{marginLeft:'auto',background:'none',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',padding:'4px 10px',color:'var(--text-2)',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>↻</button>
        </div>
        <button onClick={createLobby} style={{width:'100%',padding:'12px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-lg)',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:16}}>+ Create Lobby</button>
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Lobby code…"
            style={{flex:1,padding:'9px 12px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg)',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none'}}/>
          <button onClick={joinByCode} style={{padding:'9px 16px',background:'var(--bg-2)',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',color:'var(--text)',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Join</button>
        </div>
        {joinError&&<div style={{color:'var(--danger)',fontSize:12,marginBottom:12}}>{joinError}</div>}
        <div style={{fontWeight:700,fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Open Lobbies</div>
        {lobbies.length===0
          ?<div style={{textAlign:'center',color:'var(--text-3)',fontSize:13,padding:24}}>No open lobbies — create one!</div>
          :lobbies.map(lb=>(
            <div key={lb.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{lb.host?.username||'Unknown'}'s game</div>
                <div style={{fontSize:11,color:'var(--text-3)'}}>Code: {lb.code}</div>
              </div>
              <button onClick={()=>joinLobby(lb.id)} style={{padding:'7px 16px',background:'var(--accent)',border:'none',borderRadius:'var(--radius)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Join</button>
            </div>
          ))
        }
      </div>
    </div>
  )

  if(mode==='online'&&onlinePhase==='waiting_opponent') return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,background:'var(--bg)',...ns}}>
      <div style={{fontSize:36}}>⏳</div>
      <div style={{fontWeight:700,fontSize:18}}>Waiting for opponent…</div>
      {lobby&&<div style={{fontSize:13,color:'var(--text-3)'}}>Code: <strong style={{color:'var(--accent)',letterSpacing:'0.1em'}}>{lobby.code}</strong></div>}
    </div>
  )

  if((mode==='ai'&&phase==='placing')||(mode==='online'&&onlinePhase==='placing')) return (
    <div style={{position:'absolute',inset:0,background:'var(--bg)',overflowY:'auto',WebkitOverflowScrolling:'touch',display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 8px',gap:10,...ns}}>
      <div style={{display:'flex',alignItems:'center',gap:12,width:'100%',maxWidth:750}}>
        <button onClick={resetAll} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>← Menu</button>
        <span style={{fontWeight:800,fontSize:16}}>Place Your Ships</span>
        {mode==='online'&&lobby&&<span style={{fontSize:11,color:'var(--text-3)',marginLeft:'auto'}}>Code: <strong style={{color:'var(--accent)'}}>{lobby.code}</strong></span>}
      </div>
      <PlacementBoard
        cellSize={Math.min(cellSize,34)}
        onDone={mode==='ai'?handlePlacementDone:submitShipsOnline}
        opponentUsername={opponentReady?(opponentProfile?.username||'Opponent'):null}
      />
    </div>
  )

  if((mode==='ai'&&phase==='over')||(mode==='online'&&onlinePhase==='over')){
    const won=mode==='ai'?winner==='player':onlineWinner===user?.id
    return (
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,background:'var(--bg)',...ns}}>
        <div style={{fontSize:48}}>{won?'🏆':'💀'}</div>
        <div style={{fontWeight:800,fontSize:28,color:won?'#22c55e':'var(--danger)'}}>{won?'Victory!':'Defeated!'}</div>
        <div style={{fontSize:14,color:'var(--text-3)'}}>{won?'You sunk the enemy fleet!':'Your fleet was destroyed!'}</div>
        <div style={{display:'flex',gap:12}}>
          <button onClick={resetAll} style={{padding:'10px 24px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text)',fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Menu</button>
          {mode==='ai'&&<button onClick={startAI} style={{padding:'10px 24px',background:'var(--accent)',border:'none',borderRadius:'var(--radius)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Play again</button>}
        </div>
      </div>
    )
  }

  if(mode==='ai'&&phase==='playing'){
    const updatedAI=checkSunk(aiShips,playerShots)
    const updatedPlayer=checkSunk(playerShips,aiShots)
    const sunkAI=updatedAI.filter(s=>s.sunk)

    const enemyGridEl=(
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Enemy Waters</div>
        <BattleGrid ships={updatedAI} shots={playerShots} onShot={turn==='player'?handlePlayerShot:undefined}
          showShips={false} cellSize={cellSize} disabled={turn!=='player'||!!enemyShell}
          firingShip={null} impactAnim={enemyImpact} sinkingShip={enemySink}
          shellArc={enemyShell} onShellLanded={onPlayerShellLanded} sunkEnemyShips={sunkAI}/>
      </div>
    )
    const playerGridEl=(
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Your Fleet</div>
        <BattleGrid ships={updatedPlayer} shots={aiShots} showShips={true}
          cellSize={cellSize} disabled={true} firingShip={playerFiring}
          impactAnim={playerImpact} sinkingShip={playerSink}
          shellArc={playerShell} onShellLanded={()=>setPlayerShell(null)}/>
      </div>
    )

    if(isMobile) return (
      <div style={{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',WebkitOverflowScrolling:'touch',...ns}}>
        <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',flexShrink:0}}>
          <button onClick={resetAll} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>← Menu</button>
          <span style={{fontWeight:700,fontSize:13,flex:1,textAlign:'center'}}>Battleship</span>
        </div>
        <div style={{padding:'0 6px',width:'100%',flexShrink:0}}><EventBanner event={banner}/></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'8px 0 16px'}}>
          {enemyGridEl}
          {playerGridEl}
        </div>
      </div>
    )

    return (
      <div style={{position:'absolute',inset:0,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:12,padding:16,...ns}}>
        {enemyGridEl}
        <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:140}}>
          <button onClick={resetAll} style={{padding:'6px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>← Menu</button>
          <EventBanner event={banner}/>
          <ShipHealth ships={updatedAI} shots={playerShots} label="ENEMY FLEET"/>
          <ShipHealth ships={updatedPlayer} shots={aiShots} label="YOUR FLEET"/>
        </div>
        {playerGridEl}
      </div>
    )
  }

  if(mode==='online'&&onlinePhase==='playing'){
    const myShipsChecked=checkSunk(myShips,oppShots)
    const fireBtn=(
      <button onClick={handleFireButton} disabled={!selectedCell||!isMyTurnOnline}
        style={{padding:'10px 24px',background:selectedCell&&isMyTurnOnline?'#dc2626':'var(--bg-3)',border:`2px solid ${selectedCell&&isMyTurnOnline?'#dc2626':'var(--border-2)'}`,borderRadius:'var(--radius-lg)',color:selectedCell&&isMyTurnOnline?'#fff':'var(--text-3)',fontSize:14,fontWeight:700,cursor:selectedCell&&isMyTurnOnline?'pointer':'not-allowed',fontFamily:'inherit',transition:'all 0.2s',boxShadow:selectedCell&&isMyTurnOnline?'0 0 14px rgba(220,38,38,0.4)':'none'}}>
        🔥 FIRE{selectedCell?` → ${String.fromCharCode(65+selectedCell[1])}${selectedCell[0]+1}`:''}
      </button>
    )
    const enemyGridEl=(
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Enemy Waters</div>
        <BattleGrid ships={[]} shots={myShots} onShot={isMyTurnOnline?handleCellSelect:undefined}
          showShips={false} cellSize={cellSize} disabled={!isMyTurnOnline||!!oEnemyShell}
          impactAnim={oEnemyImpact} sinkingShip={oEnemySink}
          shellArc={oEnemyShell} onShellLanded={onOEnemyShellLanded}/>
        {selectedCell&&isMyTurnOnline&&<div style={{fontSize:11,color:'var(--accent)'}}>Selected: {String.fromCharCode(65+selectedCell[1])}{selectedCell[0]+1}</div>}
      </div>
    )
    const myGridEl=(
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Your Fleet</div>
        <BattleGrid ships={myShipsChecked} shots={oppShots} showShips={true}
          cellSize={cellSize} disabled={true}
          impactAnim={oMyImpact} sinkingShip={oMySink}
          shellArc={oMyShell} onShellLanded={onOMyShellLanded}/>
      </div>
    )

    if(isMobile) return (
      <div style={{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',WebkitOverflowScrolling:'touch',...ns}}>
        <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',flexShrink:0}}>
          <button onClick={resetAll} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>← Menu</button>
          <span style={{fontWeight:700,fontSize:13,flex:1,textAlign:'center'}}>Battleship</span>
        </div>
        <div style={{padding:'0 6px',width:'100%',flexShrink:0}}><EventBanner event={oBanner}/></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'8px 0 16px'}}>
          {enemyGridEl}
          {isMyTurnOnline&&<div style={{flexShrink:0}}>{fireBtn}</div>}
          {myGridEl}
        </div>
      </div>
    )

    return (
      <div style={{position:'absolute',inset:0,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:12,padding:16,...ns}}>
        {enemyGridEl}
        <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:150,alignItems:'center'}}>
          <button onClick={resetAll} style={{width:'100%',padding:'6px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>← Menu</button>
          <EventBanner event={oBanner}/>
          {fireBtn}
          <ShipHealth ships={myShipsChecked} shots={oppShots} label="YOUR FLEET"/>
          {lobby&&<div style={{fontSize:10,color:'var(--text-3)',textAlign:'center'}}>Code: <strong>{lobby.code}</strong></div>}
        </div>
        {myGridEl}
      </div>
    )
  }

  return null
}
