import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

const SIZE = 10
const SHIPS = [
  { name:'Carrier',    len:5, color:'#1e40af' },
  { name:'Battleship', len:4, color:'#1d4ed8' },
  { name:'Cruiser',    len:3, color:'#2563eb' },
  { name:'Submarine',  len:3, color:'#3b82f6' },
  { name:'Destroyer',  len:2, color:'#60a5fa' },
]
const SHELL_MS = 1400

// ── Pure helpers ──────────────────────────────────────────────
const emptyGrid = () => Array.from({length:SIZE}, ()=>Array(SIZE).fill(null))

function shipCells(row, col, len, horiz) {
  return Array.from({length:len}, (_,i) => horiz ? [row,col+i] : [row+i,col])
}

function canPlace(grid, name, row, col, len, horiz) {
  for (const [r,c] of shipCells(row,col,len,horiz)) {
    if (r<0||r>=SIZE||c<0||c>=SIZE) return false
    if (grid[r][c] && grid[r][c]!==name) return false
  }
  return true
}

function buildGrid(ships) {
  const g = emptyGrid()
  for (const s of ships) s.cells.forEach(([r,c])=>{ g[r][c]=s.name })
  return g
}

function randomPlacement() {
  const grid = emptyGrid(), placed = []
  for (const ship of SHIPS) {
    let ok=false
    while (!ok) {
      const horiz=Math.random()>0.5
      const row=Math.floor(Math.random()*SIZE)
      const col=Math.floor(Math.random()*SIZE)
      if (canPlace(grid, ship.name, row, col, ship.len, horiz)) {
        const cells=shipCells(row,col,ship.len,horiz)
        cells.forEach(([r,c])=>{ grid[r][c]=ship.name })
        placed.push({name:ship.name, len:ship.len, cells, horiz, sunk:false})
        ok=true
      }
    }
  }
  return placed
}

function checkSunk(ships, shots) {
  return ships.map(s=>({...s, sunk:s.cells.every(([r,c])=>shots.some(([sr,sc])=>sr===r&&sc===c))}))
}
function isHit(ships,r,c) { return ships.some(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c)) }
function allSunk(ships) { return ships.length>0 && ships.every(s=>s.sunk) }
function shipColor(name) { return SHIPS.find(s=>s.name===name)?.color||'#3b82f6' }
function makeCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

function aiShot(shots, ships) {
  const hits=shots.filter(([r,c])=>isHit(ships,r,c))
  const sunkCells=ships.filter(s=>s.sunk).flatMap(s=>s.cells)
  const unsunkHits=hits.filter(([r,c])=>!sunkCells.some(([sr,sc])=>sr===r&&sc===c))
  const tried=new Set(shots.map(([r,c])=>`${r},${c}`))
  const cands=[]
  for (const [hr,hc] of unsunkHits)
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr=hr+dr,nc=hc+dc
      if (nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&!tried.has(`${nr},${nc}`)) cands.push([nr,nc])
    }
  if (cands.length>0) return cands[Math.floor(Math.random()*cands.length)]
  const all=[]
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (!tried.has(`${r},${c}`)) all.push([r,c])
  return all[Math.floor(Math.random()*all.length)]
}

// ── Ship SVG ──────────────────────────────────────────────────
function ShipModel({name, len, horiz, cs, sunk, hit, firing}) {
  const w=horiz?len*cs:cs, h=horiz?cs:len*cs
  const p=2
  const col  =sunk?'#7f1d1d':hit?'#b45309':shipColor(name)
  const light=sunk?'#991b1b':hit?'#d97706':'#93c5fd'
  const dark =sunk?'#450a0a':hit?'#92400e':'#1e3a8a'
  const L=len*cs-p*2, T=cs-p*2
  return (
    <svg width={w} height={h} style={{display:'block',overflow:'visible',pointerEvents:'none'}}>
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

// ── Animations ────────────────────────────────────────────────
function ShellArc({srcX,srcY,dstX,dstY,onLand}) {
  const [p,setP]=useState(0)
  const t0=useRef(null),raf=useRef(null)
  useEffect(()=>{
    const go=ts=>{
      if(!t0.current) t0.current=ts
      const v=Math.min((ts-t0.current)/SHELL_MS,1)
      setP(v); if(v<1) raf.current=requestAnimationFrame(go); else onLand?.()
    }
    raf.current=requestAnimationFrame(go)
    return()=>cancelAnimationFrame(raf.current)
  },[])
  const x=srcX+(dstX-srcX)*p
  const arcH=Math.max(Math.abs(dstY-srcY),Math.abs(dstX-srcX))*0.6
  const y=srcY+(dstY-srcY)*p-arcH*4*p*(1-p)
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:30,overflow:'visible'}}>
      <svg style={{overflow:'visible',position:'absolute',left:0,top:0}} width="100%" height="100%">
        {[0.15,0.1,0.05].map((b,i)=>{const tp=Math.max(0,p-b),tx=srcX+(dstX-srcX)*tp,ty=srcY+(dstY-srcY)*tp-arcH*4*tp*(1-tp);return<circle key={i} cx={tx} cy={ty} r={3-i} fill="#f97316" opacity={0.4-i*0.1}/>})}
        <circle cx={x} cy={y} r={4} fill="#fbbf24"/><circle cx={x} cy={y} r={2} fill="#fff" opacity={0.8}/>
      </svg>
    </div>
  )
}

function Splash({x,y,cs}) {
  const [f,setF]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setF(v=>v+1),60);return()=>clearInterval(t)},[])
  if(f>10) return null
  const h=cs*1.1*Math.sin((f/10)*Math.PI),op=1-f/11,r=cs*0.35
  return (
    <div style={{position:'absolute',left:x-r,top:y-h-r,width:r*2,height:h+r*2,pointerEvents:'none',zIndex:25}}>
      <svg width={r*2} height={h+r*2} style={{overflow:'visible'}}>
        <ellipse cx={r} cy={h+r} rx={r*0.85} ry={r*0.3} fill="#93c5fd" opacity={op*0.5}/>
        <line x1={r} y1={h+r} x2={r} y2={r*0.3} stroke="#bfdbfe" strokeWidth={cs*0.18} strokeLinecap="round" opacity={op}/>
        {[-0.7,-0.35,0.35,0.7].map((dx,i)=><line key={i} x1={r} y1={r*0.5+h*0.3} x2={r+dx*cs*0.55} y2={0} stroke="#e0f2fe" strokeWidth={cs*0.1} strokeLinecap="round" opacity={op*0.65}/>)}
      </svg>
    </div>
  )
}

function Explosion({x,y,cs}) {
  const [f,setF]=useState(0)
  const seeds=useRef([...Array(8)].map(()=>Math.random()))
  useEffect(()=>{const t=setInterval(()=>setF(v=>v+1),70);return()=>clearInterval(t)},[])
  if(f>10) return null
  const maxR=cs*0.7,r=maxR*(f/10),op=1-f/11
  const cols=['#fbbf24','#f97316','#ef4444','#dc2626','#b91c1c']
  const col=cols[Math.min(f,cols.length-1)]
  return (
    <div style={{position:'absolute',left:x-maxR,top:y-maxR,width:maxR*2,height:maxR*2,pointerEvents:'none',zIndex:25}}>
      <svg width={maxR*2} height={maxR*2}>
        <circle cx={maxR} cy={maxR} r={r*1.1} stroke={col} strokeWidth={2} fill="none" opacity={op*0.4}/>
        <circle cx={maxR} cy={maxR} r={r*0.6} fill={col} opacity={op*0.9}/>
        <circle cx={maxR} cy={maxR} r={r*0.3} fill="#fff" opacity={op*0.7}/>
        {seeds.current.map((seed,i)=>{const a=(i/8)*Math.PI*2+seed*0.5,sr=r*(0.6+seed*0.5);return<circle key={i} cx={maxR+Math.cos(a)*sr} cy={maxR+Math.sin(a)*sr} r={maxR*0.07} fill={cols[i%cols.length]} opacity={op}/>})}
        {f>4&&<circle cx={maxR} cy={maxR-r*0.3} r={r*0.5} fill="#6b7280" opacity={(f-4)/11*0.4}/>}
      </svg>
    </div>
  )
}

function SinkAnim({ship,cs,offsetX=0}) {
  const [f,setF]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setF(v=>v+1),100);return()=>clearInterval(t)},[])
  if(f>20) return null
  const prog=f/20,op=Math.max(0,1-prog*1.2)
  const [r0,c0]=ship.cells[0]
  return (
    <div style={{position:'absolute',top:r0*cs,left:c0*cs,width:ship.horiz?ship.len*cs:cs,height:ship.horiz?cs:ship.len*cs,pointerEvents:'none',zIndex:10,opacity:op,transform:`translateY(${prog*cs*0.7}px) rotate(${prog*(ship.horiz?12:-8)}deg)`,transformOrigin:'center'}}>
      <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cs={cs} sunk hit={false}/>
    </div>
  )
}

// ── Event banner ──────────────────────────────────────────────
function Banner({event}) {
  const S={hit:{bg:'#7f1d1d',bd:'#ef4444',tx:'#fca5a5',ic:'💥'},miss:{bg:'#1e3a5f',bd:'#3b82f6',tx:'#93c5fd',ic:'💦'},sunk:{bg:'#713f12',bd:'#f59e0b',tx:'#fde68a',ic:'🔥'},info:{bg:'var(--bg-2)',bd:'var(--border-2)',tx:'var(--text)',ic:'ℹ️'},firing:{bg:'#1a1a2e',bd:'#818cf8',tx:'#c7d2fe',ic:'🎯'},enemy_firing:{bg:'#1a1a1a',bd:'#ef4444',tx:'#fca5a5',ic:'⚠️'}}
  const s=S[event?.type]||S.info
  return (
    <div style={{background:s.bg,border:`1px solid ${s.bd}`,borderRadius:'var(--radius)',padding:'8px 16px',fontSize:13,fontWeight:700,color:s.tx,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:8,minHeight:40,boxShadow:`0 0 10px ${s.bd}44`}}>
      {event?<><span>{s.ic}</span><span>{event.text}</span></>:<span style={{opacity:0}}>·</span>}
    </div>
  )
}

// ── Battle grid ───────────────────────────────────────────────
function BattleGrid({ships,shots,onShot,showShips,cs,disabled,firingShip,impact,sinkShip,shell,onLand,sunkEnemy}) {
  const [hover,setHover]=useState(null)
  const shotSet=new Set((shots||[]).map(([r,c])=>`${r},${c}`))
  const live=checkSunk(ships,shots||[])
  const rendered=new Set()
  return (
    <div style={{display:'inline-block',border:'1px solid var(--border-2)',borderRadius:4,position:'relative'}}>
      <div style={{display:'flex',paddingLeft:cs}}>
        {Array.from({length:SIZE},(_,i)=><div key={i} style={{width:cs,textAlign:'center',fontSize:Math.max(8,cs*0.35),color:'var(--text-3)',fontWeight:600,lineHeight:`${cs*0.7}px`}}>{String.fromCharCode(65+i)}</div>)}
      </div>
      <div style={{display:'flex'}}>
        {/* Row number labels */}
        <div style={{display:'flex',flexDirection:'column'}}>
          {Array.from({length:SIZE},(_,r)=>(
            <div key={r} style={{width:cs,height:cs,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(8,cs*0.35),color:'var(--text-3)',fontWeight:600}}>{r+1}</div>
          ))}
        </div>
        {/* Cells-only area */}
        <div style={{position:'relative',cursor:disabled?'default':'crosshair'}} onMouseLeave={()=>setHover(null)}>
        {Array.from({length:SIZE},(_,r)=>(
          <div key={r} style={{display:'flex'}}>
            {Array.from({length:SIZE},(_,c)=>{
              const k=`${r},${c}`,shot=shotSet.has(k)
              const ship=live.find(s=>s.cells.some(([sr,sc])=>sr===r&&sc===c))
              const hit=shot&&!!ship,miss=shot&&!ship,sunk=hit&&ship?.sunk
              const hov=hover&&hover[0]===r&&hover[1]===c&&!disabled&&!shot
              return (
                <div key={c} onMouseEnter={()=>!disabled&&setHover([r,c])} onClick={()=>!disabled&&!shot&&onShot?.(r,c)}
                  style={{width:cs,height:cs,border:'1px solid var(--border)',background:miss?'rgba(59,130,246,0.15)':sunk?'rgba(127,29,29,0.25)':hit?'rgba(239,68,68,0.2)':hov?'rgba(99,102,241,0.14)':'transparent',position:'relative',boxSizing:'border-box'}}>
                  {miss&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:cs*0.3,height:cs*0.3,borderRadius:'50%',background:'#60a5fa',opacity:0.85}}/></div>}
                  {hit&&!sunk&&<svg style={{position:'absolute',inset:0}} width={cs} height={cs}><line x1={cs*0.2} y1={cs*0.2} x2={cs*0.8} y2={cs*0.8} stroke="#ef4444" strokeWidth={2.5}/><line x1={cs*0.8} y1={cs*0.2} x2={cs*0.2} y2={cs*0.8} stroke="#ef4444" strokeWidth={2.5}/></svg>}
                  {hov&&<svg style={{position:'absolute',inset:0}} width={cs} height={cs}><circle cx={cs/2} cy={cs/2} r={cs*0.35} stroke="#818cf8" strokeWidth={1.5} fill="none" opacity={0.7}/><line x1={cs/2} y1={cs*0.1} x2={cs/2} y2={cs*0.35} stroke="#818cf8" strokeWidth={1.5}/><line x1={cs/2} y1={cs*0.65} x2={cs/2} y2={cs*0.9} stroke="#818cf8" strokeWidth={1.5}/><line x1={cs*0.1} y1={cs/2} x2={cs*0.35} y2={cs/2} stroke="#818cf8" strokeWidth={1.5}/><line x1={cs*0.65} y1={cs/2} x2={cs*0.9} y2={cs/2} stroke="#818cf8" strokeWidth={1.5}/></svg>}
                </div>
              )
            })}
          </div>
        ))}
        {/* Own ships */}
        {showShips&&live.map(ship=>{
          if(rendered.has(ship.name)) return null; rendered.add(ship.name)
          if(sinkShip?.name===ship.name) return null
          const [r0,c0]=ship.cells[0],hasHit=ship.cells.some(([r,c])=>shotSet.has(`${r},${c}`))
          return <div key={ship.name} style={{position:'absolute',top:r0*cs,left:c0*cs,width:ship.horiz?ship.len*cs:cs,height:ship.horiz?cs:ship.len*cs,pointerEvents:'none',zIndex:5,opacity:ship.sunk?0:1,transition:'opacity 0.3s',filter:firingShip?.name===ship.name?'brightness(1.3)':'none'}}><ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cs={cs} sunk={ship.sunk} hit={hasHit&&!ship.sunk} firing={firingShip?.name===ship.name}/></div>
        })}
        {/* Sunk enemy ships revealed */}
        {sunkEnemy&&sunkEnemy.filter(s=>s.sunk).map(ship=>{
          const [r0,c0]=ship.cells[0]
          return <div key={`se-${ship.name}`} style={{position:'absolute',top:r0*cs,left:c0*cs,width:ship.horiz?ship.len*cs:cs,height:ship.horiz?cs:ship.len*cs,pointerEvents:'none',zIndex:4,opacity:0.65}}><ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cs={cs} sunk hit={false}/></div>
        })}
        {sinkShip&&<SinkAnim ship={sinkShip} cs={cs}/>}
        {shell&&<ShellArc srcX={shell.sx} srcY={shell.sy} dstX={shell.dx} dstY={shell.dy} onLand={onLand}/>}
        {impact?.type==='explosion'&&<Explosion x={(impact.cell[1]+0.5)*cs} y={(impact.cell[0]+0.5)*cs} cs={cs}/>}
        {impact?.type==='splash'&&<Splash x={(impact.cell[1]+0.5)*cs} y={(impact.cell[0]+0.5)*cs} cs={cs}/>}
        </div>
      </div>
    </div>
  )
}

// ── Placement board ───────────────────────────────────────────
function PlacementBoard({onDone, cs, opponentUsername}) {
  const [placed, setPlaced] = useState([])       // ships on grid
  const [horiz,  setHoriz]  = useState(          // orientation per ship
    () => Object.fromEntries(SHIPS.map(s=>[s.name,true])))

  // Drag state — stored in a ref to avoid stale closures in event listeners
  const drag = useRef(null) // {name,len,h,offR,offC} while dragging
  const [ghost, setGhost] = useState(null) // {x,y,name,len,h} — floating preview
  const [preview, setPreview] = useState(null) // {cells,valid}
  const gridRef = useRef(null)

  const placedSet = new Set(placed.map(s=>s.name))
  const allPlaced = placed.length === SHIPS.length
  const getGridCell = (cx, cy) => {
    const el=gridRef.current; if(!el) return null
    const rect=el.getBoundingClientRect()
    const c=Math.floor((cx-rect.left)/cs), r=Math.floor((cy-rect.top)/cs)
    if(r<0||r>=SIZE||c<0||c>=SIZE) return null
    return [r,c]
  }

  const computePreview = (clientX, clientY, ds) => {
    const raw=getGridCell(clientX,clientY)
    if (!raw) { setPreview(null); return }
    const [r,c]=raw
    const r0=ds.h?r:r-ds.offR, c0=ds.h?c-ds.offC:c
    // Clamp so ship fits on grid
    const r0f=ds.h ? Math.max(0,Math.min(r0,SIZE-1))   : Math.max(0,Math.min(r0,SIZE-ds.len))
    const c0f=ds.h ? Math.max(0,Math.min(c0,SIZE-ds.len)) : Math.max(0,Math.min(c0,SIZE-1))
    const cells=shipCells(r0f,c0f,ds.len,ds.h)
    const grid=buildGrid(placed.filter(s=>s.name!==ds.name))
    const valid=canPlace(grid,ds.name,r0f,c0f,ds.len,ds.h)
    setPreview({cells, valid, r0:r0f, c0:c0f})
  }

  const commitDrop = (clientX, clientY, ds) => {
    const raw=getGridCell(clientX,clientY)
    if (!raw) return
    const [r,c]=raw
    const r0=ds.h?r:r-ds.offR, c0=ds.h?c-ds.offC:c
    const r0f=ds.h ? Math.max(0,Math.min(r0,SIZE-1))      : Math.max(0,Math.min(r0,SIZE-ds.len))
    const c0f=ds.h ? Math.max(0,Math.min(c0,SIZE-ds.len)) : Math.max(0,Math.min(c0,SIZE-1))
    const grid=buildGrid(placed.filter(s=>s.name!==ds.name))
    if (!canPlace(grid,ds.name,r0f,c0f,ds.len,ds.h)) return
    const cells=shipCells(r0f,c0f,ds.len,ds.h)
    setPlaced(prev=>[...prev.filter(s=>s.name!==ds.name),{name:ds.name,len:ds.len,cells,horiz:ds.h,sunk:false}])
    // horiz state stays true (horizontal) for bank display regardless of grid orientation
  }

  const rotateOnBoard = (name) => {
    const ship=placed.find(s=>s.name===name)
    if (!ship) return
    const newH=!ship.horiz
    const [r0,c0]=ship.cells[0]
    // Clamp origin so rotation fits on grid
    const nr=Math.min(r0, newH?SIZE-1:SIZE-ship.len)
    const nc=Math.min(c0, newH?SIZE-ship.len:SIZE-1)
    const grid=buildGrid(placed.filter(s=>s.name!==name))
    if (!canPlace(grid,name,nr,nc,ship.len,newH)) return
    const cells=shipCells(nr,nc,ship.len,newH)
    setPlaced(prev=>[...prev.filter(s=>s.name!==name),{...ship,cells,horiz:newH}])
    // Do NOT update horiz — bank always stays horizontal
  }

  // Global pointer listeners for drag
  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return
      const {clientX,clientY}=e.touches?e.touches[0]:e
      setGhost({x:clientX, y:clientY, name:drag.current.name, len:drag.current.len, h:drag.current.h})
      computePreview(clientX, clientY, drag.current)
    }
    const onUp = (e) => {
      if (!drag.current) return
      const {clientX,clientY}=e.changedTouches?e.changedTouches[0]:e
      commitDrop(clientX, clientY, drag.current)
      drag.current=null
      setGhost(null)
      setPreview(null)
    }
    const onTouchMovePrevent = (e) => { if (drag.current) e.preventDefault() }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, {passive:false})
    window.addEventListener('touchmove', onTouchMovePrevent, {passive:false})
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchmove', onTouchMovePrevent)
      window.removeEventListener('touchend', onUp)
    }
  }, [placed, cs]) // re-bind when placed changes so computePreview/commitDrop see fresh state

  const startDrag = (e, name, len, h, offR=0, offC=0) => {
    e.preventDefault()
    drag.current = {name,len,h,offR,offC}
    const {clientX,clientY}=e.touches?e.touches[0]:e
    setGhost({x:clientX,y:clientY,name,len,h})
  }

  const randomize = () => {
    const p=randomPlacement()
    setPlaced(p)
    // horiz stays all-true so bank shows horizontal
  }
  const reset = () => { setPlaced([]); setHoriz(Object.fromEntries(SHIPS.map(s=>[s.name,true]))) }

  // Ghost ship following cursor — snap to grid cell so it aligns with preview
  const GhostShip = ghost ? (() => {
    const el=gridRef.current
    const w=ghost.h?ghost.len*cs:cs, h=ghost.h?cs:ghost.len*cs
    // If we have a preview cell, snap ghost to that grid position
    if (el && preview) {
      const rect=el.getBoundingClientRect()
      const snapX=rect.left + preview.c0*cs
      const snapY=rect.top  + preview.r0*cs
      return (
        <div style={{position:'fixed',left:snapX,top:snapY,width:w,height:h,pointerEvents:'none',zIndex:9999,opacity:0.75}}>
          <ShipModel name={ghost.name} len={ghost.len} horiz={ghost.h} cs={cs} sunk={false} hit={false}/>
        </div>
      )
    }
    // Fallback: center on cursor
    return (
      <div style={{position:'fixed',left:ghost.x-w/2,top:ghost.y-h/2,width:w,height:h,pointerEvents:'none',zIndex:9999,opacity:0.75}}>
        <ShipModel name={ghost.name} len={ghost.len} horiz={ghost.h} cs={cs} sunk={false} hit={false}/>
      </div>
    )
  })() : null

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,width:'100%'}}>
      {GhostShip}
      {opponentUsername&&(
        <div style={{background:'#166534',border:'1px solid #22c55e',borderRadius:'var(--radius)',padding:'8px 16px',color:'#86efac',fontSize:13,fontWeight:600,textAlign:'center',width:'100%',maxWidth:550}}>
          ✅ {opponentUsername} is ready! Place your ships and click Ready.
        </div>
      )}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={randomize} style={{padding:'6px 14px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg-2)',color:'var(--text)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>🎲 Random</button>
        {placed.length>0&&<button onClick={reset} style={{padding:'6px 14px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg-2)',color:'var(--text)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>↺ Reset</button>}
        <button onClick={()=>allPlaced&&onDone(placed)} disabled={!allPlaced}
          style={{padding:'6px 20px',background:allPlaced?'#22c55e':'var(--bg-3)',border:`1px solid ${allPlaced?'#22c55e':'var(--border-2)'}`,borderRadius:'var(--radius)',color:allPlaced?'#fff':'var(--text-3)',fontSize:12,fontWeight:600,cursor:allPlaced?'pointer':'not-allowed',fontFamily:'inherit',transition:'all 0.2s'}}>
          {allPlaced?'✓ Ready!':`Place ships (${placed.length}/${SHIPS.length})`}
        </button>
      </div>

      <div style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center',alignItems:'flex-start'}}>
        {/* Ship bank */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Fleet</div>
          {SHIPS.map(ship=>{
            const isPlaced=placedSet.has(ship.name), h=horiz[ship.name]
            return (
              <div key={ship.name} style={{display:'flex',alignItems:'center',gap:8,opacity:isPlaced?0.35:1}}>
                <div style={{fontSize:10,color:'var(--text-3)',width:70,flexShrink:0}}>{ship.name} ({ship.len})</div>
                <div
                  onMouseDown={e=>{ if(isPlaced) return; startDrag(e,ship.name,ship.len,h) }}
                  onTouchStart={e=>{ if(isPlaced) return; startDrag(e,ship.name,ship.len,h) }}
                  style={{cursor:isPlaced?'default':'grab',display:'inline-block',width:h?ship.len*cs:cs,height:h?cs:ship.len*cs,flexShrink:0,outline:isPlaced?'none':'2px dashed var(--border-2)',borderRadius:3,filter:isPlaced?'grayscale(1)':'none',WebkitUserSelect:'none',userSelect:'none'}}
                >
                  <ShipModel name={ship.name} len={ship.len} horiz={h} cs={cs} sunk={false} hit={false}/>
                </div>
                <span style={{fontSize:9,color:isPlaced?'#22c55e':'var(--text-3)'}}>{isPlaced?'✓ placed':'drag →'}</span>
              </div>
            )
          })}
          <div style={{fontSize:9,color:'var(--text-3)',marginTop:4}}>Click ship on board to rotate</div>

        </div>

        {/* Placement grid */}
        <div>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Your Board</div>
          <div style={{display:'inline-block',border:'1px solid var(--border-2)',borderRadius:4,position:'relative'}}>
            <div style={{display:'flex',paddingLeft:cs}}>
              {Array.from({length:SIZE},(_,i)=><div key={i} style={{width:cs,textAlign:'center',fontSize:Math.max(8,cs*0.35),color:'var(--text-3)',fontWeight:600,lineHeight:`${cs*0.7}px`}}>{String.fromCharCode(65+i)}</div>)}
            </div>
            <div style={{display:'flex'}}>
              {/* Row number labels column */}
              <div style={{display:'flex',flexDirection:'column'}}>
                {Array.from({length:SIZE},(_,r)=>(
                  <div key={r} style={{width:cs,height:cs,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(8,cs*0.35),color:'var(--text-3)',fontWeight:600}}>{r+1}</div>
                ))}
              </div>
              {/* Cell grid — gridRef wraps ONLY the 10x10 cells */}
              <div ref={gridRef} style={{position:'relative'}}>
                {Array.from({length:SIZE},(_,r)=>(
                  <div key={r} style={{display:'flex'}}>
                    {Array.from({length:SIZE},(_,c)=>{
                      const isPrev=preview?.cells.some(([pr,pc])=>pr===r&&pc===c)
                      return <div key={c} style={{width:cs,height:cs,border:'1px solid var(--border)',background:isPrev?(preview.valid?'rgba(99,102,241,0.28)':'rgba(239,68,68,0.28)'):'transparent',boxSizing:'border-box'}}/>
                    })}
                  </div>
                ))}
                {/* Placed ships — tap to rotate, drag to move */}
              {placed.map(ship=>{
                const [r0,c0]=ship.cells[0]
                return (
                  <div key={ship.name}
                    onMouseDown={e=>{
                      // Only start drag after threshold to allow click-to-rotate
                      const sx=e.clientX,sy=e.clientY
                      const rect=gridRef.current.getBoundingClientRect()
                      const rawR=Math.floor((sy-rect.top)/cs)
                      const rawC=Math.floor((sx-rect.left)/cs)
                      const offR=ship.horiz ? 0 : Math.min(Math.max(0,rawR-r0),ship.len-1)
                      const offC=ship.horiz ? Math.min(Math.max(0,rawC-c0),ship.len-1) : 0
                      let moved=false
                      const onM=(mv)=>{
                        if(!moved&&Math.hypot(mv.clientX-sx,mv.clientY-sy)>8){
                          moved=true
                          setPlaced(prev=>prev.filter(s=>s.name!==ship.name))
                          drag.current={name:ship.name,len:ship.len,h:ship.horiz,offR,offC}
                          setGhost({x:mv.clientX,y:mv.clientY,name:ship.name,len:ship.len,h:ship.horiz})
                        }
                        if(moved){ setGhost({x:mv.clientX,y:mv.clientY,name:ship.name,len:ship.len,h:ship.horiz}); computePreview(mv.clientX,mv.clientY,drag.current) }
                      }
                      const onU=(uv)=>{
                        window.removeEventListener('mousemove',onM)
                        window.removeEventListener('mouseup',onU)
                        if(moved){ commitDrop(uv.clientX,uv.clientY,drag.current); drag.current=null; setGhost(null); setPreview(null) }
                        else rotateOnBoard(ship.name)
                      }
                      window.addEventListener('mousemove',onM)
                      window.addEventListener('mouseup',onU)
                    }}
                    onTouchStart={e=>{
                      e.preventDefault()
                      const t=e.touches[0],sx=t.clientX,sy=t.clientY
                      const rect=gridRef.current.getBoundingClientRect()
                      const rawR=Math.floor((sy-rect.top)/cs)
                      const rawC=Math.floor((sx-rect.left)/cs)
                      const offR=ship.horiz ? 0 : Math.min(Math.max(0,rawR-r0),ship.len-1)
                      const offC=ship.horiz ? Math.min(Math.max(0,rawC-c0),ship.len-1) : 0
                      let moved=false
                      const onM=(mv)=>{
                        mv.preventDefault()
                        const tt=mv.touches[0]
                        if(!moved&&Math.hypot(tt.clientX-sx,tt.clientY-sy)>8){
                          moved=true
                          setPlaced(prev=>prev.filter(s=>s.name!==ship.name))
                          drag.current={name:ship.name,len:ship.len,h:ship.horiz,offR,offC}
                        }
                        if(moved){ setGhost({x:tt.clientX,y:tt.clientY,name:ship.name,len:ship.len,h:ship.horiz}); computePreview(tt.clientX,tt.clientY,drag.current) }
                      }
                      const onU=(uv)=>{
                        window.removeEventListener('touchmove',onM)
                        window.removeEventListener('touchend',onU)
                        if(moved){ const tt=uv.changedTouches[0]; commitDrop(tt.clientX,tt.clientY,drag.current); drag.current=null; setGhost(null); setPreview(null) }
                        else rotateOnBoard(ship.name)
                      }
                      window.addEventListener('touchmove',onM,{passive:false})
                      window.addEventListener('touchend',onU)
                    }}
                    style={{position:'absolute',top:r0*cs,left:c0*cs,width:ship.horiz?ship.len*cs:cs,height:ship.horiz?cs:ship.len*cs,cursor:'grab',zIndex:5}}
                  >
                    <ShipModel name={ship.name} len={ship.len} horiz={ship.horiz} cs={cs} sunk={false} hit={false}/>
                  </div>
                )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ship health ───────────────────────────────────────────────
function ShipHealth({ships,shots,label}) {
  const c=checkSunk(ships,shots)
  return (
    <div style={{background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 10px'}}>
      <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
      {c.map(s=>(
        <div key={s.name} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
          <div style={{width:8,height:8,borderRadius:2,background:s.sunk?'#ef4444':'#22c55e',flexShrink:0}}/>
          <span style={{fontSize:11,color:s.sunk?'var(--text-3)':'var(--text)',textDecoration:s.sunk?'line-through':'none'}}>{s.name}</span>
          <span style={{fontSize:10,color:'var(--text-3)',marginLeft:'auto'}}>{s.len}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export function Battleship() {
  const [screen,setScreen]=useState('menu')
  const [mode,setMode]=useState(null)
  const [user,setUser]=useState(null)
  const [profile,setProfile]=useState(null)

  // AI game state
  const [phase,setPhase]=useState('placing')
  const [playerShips,setPlayerShips]=useState([])
  const [aiShips,setAiShips]=useState([])
  const [playerShots,setPlayerShots]=useState([])
  const [aiShots,setAiShots]=useState([])
  const [turn,setTurn]=useState('player')
  const [winner,setWinner]=useState(null)
  const [banner,setBanner]=useState(null)
  const [playerFiring,setPlayerFiring]=useState(null)
  const [enemyImpact,setEnemyImpact]=useState(null)
  const [playerImpact,setPlayerImpact]=useState(null)
  const [enemySink,setEnemySink]=useState(null)
  const [playerSink,setPlayerSink]=useState(null)
  const [enemyShell,setEnemyShell]=useState(null)
  const [playerShell,setPlayerShell]=useState(null)

  // Use refs for values needed in shell-landed callbacks to avoid stale closures
  const pendingShotRef = useRef(null)
  const playerShotsRef = useRef([])
  const aiShipsRef = useRef([])
  const playerShipsRef = useRef([])
  const aiShotsRef = useRef([])
  const csRef = useRef(30)
  useEffect(()=>{ playerShotsRef.current=playerShots },[playerShots])
  useEffect(()=>{ aiShipsRef.current=aiShips },[aiShips])
  useEffect(()=>{ playerShipsRef.current=playerShips },[playerShips])
  useEffect(()=>{ aiShotsRef.current=aiShots },[aiShots])

  // Online state
  const [lobby,setLobby]=useState(null)
  const [lobbies,setLobbies]=useState([])
  const [onlinePhase,setOnlinePhase]=useState('lobby')
  const [opponentReady,setOpponentReady]=useState(false)
  const [opponentProfile,setOpponentProfile]=useState(null)
  const [myShots,setMyShots]=useState([])
  const [oppShots,setOppShots]=useState([])
  const [myShips,setMyShips]=useState([])
  const [onlineTurn,setOnlineTurn]=useState(null)
  const [onlineWinner,setOnlineWinner]=useState(null)
  const [joinCode,setJoinCode]=useState('')
  const [joinError,setJoinError]=useState('')
  const [oBanner,setOBanner]=useState(null)
  const [oEnemyImpact,setOEnemyImpact]=useState(null)
  const [oMyImpact,setOMyImpact]=useState(null)
  const [oEnemySink,setOEnemySink]=useState(null)
  const [oMySink,setOMySink]=useState(null)
  const [oEnemyShell,setOEnemyShell]=useState(null)
  const [oMyShell,setOMyShell]=useState(null)
  const [selectedCell,setSelectedCell]=useState(null)
  const pendingORef = useRef(null)
  const myShipsRef = useRef([])
  const oppShotsRef = useRef([])
  const myShotsRef = useRef([])
  const lobbyRef = useRef(null)
  const subRef = useRef(null)
  useEffect(()=>{ myShipsRef.current=myShips },[myShips])
  useEffect(()=>{ oppShotsRef.current=oppShots },[oppShots])
  useEffect(()=>{ myShotsRef.current=myShots },[myShots])
  useEffect(()=>{ lobbyRef.current=lobby },[lobby])

  // Window size
  const [win,setWin]=useState({w:window.innerWidth,h:window.innerHeight})
  useEffect(()=>{ const h=()=>setWin({w:window.innerWidth,h:window.innerHeight}); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h) },[])
  const isMobile=win.w<760
  const cs=isMobile
    ? Math.floor(Math.min((win.w-48)/(SIZE+1),(win.h-220)/(SIZE+1)))
    : Math.floor(Math.min((win.w-180)/(2*(SIZE+1)),(win.h-160)/(SIZE+1)))
  useEffect(()=>{ csRef.current=cs },[cs])

  const ns={userSelect:'none',WebkitUserSelect:'none'}

  // Remove .content padding to let game fill edge-to-edge
  useEffect(()=>{
    const el=document.querySelector('.content')
    if(!el) return
    const oldP=el.style.padding, oldO=el.style.overflowY
    el.style.padding='0'; el.style.overflowY='hidden'
    return()=>{ el.style.padding=oldP; el.style.overflowY=oldO }
  },[])

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user??null)
      if(session?.user) supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))
    })
  },[])

  const showBanner=(setter,text,type,dur=2200)=>{ setter({text,type}); setTimeout(()=>setter(v=>v?.text===text?null:v),dur) }
  const randFirer=(ships)=>{ const a=ships.filter(s=>!s.sunk&&s.len>=2); return a[Math.floor(Math.random()*a.length)]||null }
  const clearAnim=(setter)=>setTimeout(()=>setter(null),900)

  // ── AI ────────────────────────────────────────────────────
  const startAI=()=>{
    const ai=randomPlacement()
    setAiShips(ai); aiShipsRef.current=ai
    setPlayerShots([]); playerShotsRef.current=[]
    setAiShots([]); aiShotsRef.current=[]
    setTurn('player'); setWinner(null); setBanner(null)
    setPlayerFiring(null); setEnemyImpact(null); setPlayerImpact(null)
    setEnemySink(null); setPlayerSink(null); setEnemyShell(null); setPlayerShell(null)
    pendingShotRef.current=null
    setPhase('placing'); setMode('ai'); setScreen('game')
  }

  const handlePlacementDone=(ships)=>{
    setPlayerShips(ships); playerShipsRef.current=ships
    setPhase('playing'); showBanner(setBanner,'Your turn — fire!','info')
  }

  const handlePlayerShot=(r,c)=>{
    if(turn!=='player'||winner) return
    if(playerShotsRef.current.some(([sr,sc])=>sr===r&&sc===c)) return
    const fs=randFirer(playerShipsRef.current)
    if(fs){ setPlayerFiring(fs); setTimeout(()=>setPlayerFiring(null),350) }
    showBanner(setBanner,'🎯 You are firing…','firing',SHELL_MS+400)
    pendingShotRef.current=[r,c]
    setTurn(null)
    setEnemyShell({sx:csRef.current/2,sy:-csRef.current,dx:(c+0.5)*csRef.current,dy:(r+0.5)*csRef.current})
  }

  const onPlayerShellLanded=()=>{
    setEnemyShell(null)
    const shot=pendingShotRef.current; if(!shot) return
    pendingShotRef.current=null
    const [r,c]=shot
    const newShots=[...playerShotsRef.current,[r,c]]
    const curAI=aiShipsRef.current
    const updatedAI=checkSunk(curAI,newShots)
    const hit=isHit(curAI,r,c)
    const newlySunk=updatedAI.find(s=>s.sunk&&!curAI.find(a=>a.name===s.name)?.sunk)
    setEnemyImpact({cell:[r,c],type:hit?'explosion':'splash'}); clearAnim(setEnemyImpact)
    setAiShips(updatedAI); aiShipsRef.current=updatedAI
    setPlayerShots(newShots); playerShotsRef.current=newShots
    if(newlySunk){ setEnemySink(newlySunk); setTimeout(()=>setEnemySink(null),2200); showBanner(setBanner,`🔥 You sunk the enemy ${newlySunk.name}!`,'sunk',2500) }
    else showBanner(setBanner,hit?'💥 HIT!':'💦 MISS',hit?'hit':'miss')
    if(allSunk(updatedAI)){ setWinner('player'); setPhase('over'); return }
    setTurn('ai')
    setTimeout(()=>{
      const curShots=aiShotsRef.current
      const curPlayer=checkSunk(playerShipsRef.current,curShots)
      const shot2=aiShot(curShots,curPlayer.length?curPlayer:playerShipsRef.current)
      showBanner(setBanner,'⚠️ AI is firing…','enemy_firing',SHELL_MS+400)
      setPlayerShell({sx:(shot2[1]+0.5)*csRef.current,sy:-csRef.current,dx:(shot2[1]+0.5)*csRef.current,dy:(shot2[0]+0.5)*csRef.current})
      pendingShotRef.current=shot2
      // resolve after shell lands
      setTimeout(()=>{
        setPlayerShell(null)
        const shot3=pendingShotRef.current; pendingShotRef.current=null
        if(!shot3) return
        const newAiShots=[...aiShotsRef.current,shot3]
        const updatedP=checkSunk(playerShipsRef.current,newAiShots)
        const aiHit=isHit(playerShipsRef.current,shot3[0],shot3[1])
        const aiSunk=updatedP.find(s=>s.sunk&&!curPlayer.find(p=>p.name===s.name)?.sunk)
        setPlayerImpact({cell:shot3,type:aiHit?'explosion':'splash'}); clearAnim(setPlayerImpact)
        setPlayerShips(updatedP); playerShipsRef.current=updatedP
        setAiShots(newAiShots); aiShotsRef.current=newAiShots
        if(aiSunk){ setPlayerSink(aiSunk); setTimeout(()=>setPlayerSink(null),2200); showBanner(setBanner,`💥 AI sunk your ${aiSunk.name}!`,'sunk',2500) }
        else showBanner(setBanner,aiHit?'🔥 AI hit your ship!':'💦 AI missed!',aiHit?'hit':'miss')
        if(allSunk(updatedP)){ setWinner('ai'); setPhase('over') }
        else { setTurn('player'); setTimeout(()=>showBanner(setBanner,'Your turn — fire!','info',10000),400) }
      },SHELL_MS)
    },1200)
  }

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
      .on('postgres_changes',{event:'*',schema:'public',table:'battleship_players',filter:`lobby_id=eq.${lobbyId}`},p=>handleOnlineUpdate(p.new))
      .subscribe()
  }
  const handleOnlineUpdate=useCallback((row)=>{
    if(!user||row.user_id===user.id) return
    setOpponentReady(row.ready)
    const newOppShots=row.shots||[]
    if(newOppShots.length>oppShotsRef.current.length){
      const latest=newOppShots[newOppShots.length-1]
      const oppName=row.username||'Opponent'
      showBanner(setOBanner,'Enemy has fired!','enemy_firing',SHELL_MS+600)
      pendingORef.current={type:'incoming',cell:latest}
      setOMyShell({sx:(latest[1]+0.5)*csRef.current,sy:-csRef.current,dx:(latest[1]+0.5)*csRef.current,dy:(latest[0]+0.5)*csRef.current})
      setOppShots(newOppShots); oppShotsRef.current=newOppShots
    } else {
      setOppShots(newOppShots); oppShotsRef.current=newOppShots
    }
    supabase.from('profiles').select('*').eq('id',row.user_id).single().then(({data})=>{if(data)setOpponentProfile(data)})
  },[user])

  const onOMyShellLanded=()=>{
    setOMyShell(null)
    const p=pendingORef.current; if(!p||p.type!=='incoming') return
    pendingORef.current=null
    const cell=p.cell
    const cur=myShipsRef.current
    const hit=isHit(cur,cell[0],cell[1])
    setOMyImpact({cell,type:hit?'explosion':'splash'}); clearAnim(setOMyImpact)
    const updated=checkSunk(cur,oppShotsRef.current)
    const newlySunk=updated.find(s=>s.sunk&&!cur.find(q=>q.name===s.name)?.sunk)
    setMyShips(updated); myShipsRef.current=updated
    if(newlySunk){ setOMySink(newlySunk); setTimeout(()=>setOMySink(null),2200); showBanner(setOBanner,`💥 Your ${newlySunk.name} was sunk!`,'sunk',2500) }
    else showBanner(setOBanner,hit?'🔥 Enemy hit your ship!':'💦 Enemy missed!',hit?'hit':'miss')
    if(allSunk(updated)){ setOnlineWinner('opponent'); setOnlinePhase('over'); return }
    setOnlineTurn(user?.id)
    setTimeout(()=>showBanner(setOBanner,'Your turn — fire!','info',10000),400)
  }

  const submitShipsOnline=async(ships)=>{
    if(!lobbyRef.current||!user) return
    setMyShips(ships); myShipsRef.current=ships
    await supabase.from('battleship_players').update({ships,ready:true,updated_at:new Date().toISOString()}).eq('lobby_id',lobbyRef.current.id).eq('user_id',user.id)
    const{data:rows}=await supabase.from('battleship_players').select('*').eq('lobby_id',lobbyRef.current.id)
    if(rows&&rows.every(r=>r.ready)){
      await supabase.from('battleship_lobbies').update({status:'playing'}).eq('id',lobbyRef.current.id)
      setOnlineTurn(lobbyRef.current.host_id); setOnlinePhase('playing')
    } else setOnlinePhase('waiting_opponent')
  }

  useEffect(()=>{
    if(onlinePhase==='waiting_opponent'&&opponentReady&&lobbyRef.current){
      supabase.from('battleship_players').select('*').eq('lobby_id',lobbyRef.current.id).then(({data})=>{
        if(data&&data.every(r=>r.ready)){
          supabase.from('battleship_lobbies').update({status:'playing'}).eq('id',lobbyRef.current.id)
          setOnlineTurn(lobbyRef.current.host_id); setOnlinePhase('playing')
        }
      })
    }
  },[opponentReady,onlinePhase])

  const handleCellSelect=(r,c)=>{
    if(onlineTurn!==user?.id||onlineWinner) return
    if(myShotsRef.current.some(([sr,sc])=>sr===r&&sc===c)) return
    setSelectedCell([r,c])
  }

  const handleFire=async()=>{
    if(!selectedCell||onlineTurn!==user?.id||onlineWinner||!lobbyRef.current) return
    const[r,c]=selectedCell; setSelectedCell(null)
    const newShots=[...myShotsRef.current,[r,c]]
    setMyShots(newShots); myShotsRef.current=newShots
    setOnlineTurn(null)
    showBanner(setOBanner,'🎯 You are firing…','firing',SHELL_MS+400)
    pendingORef.current={type:'outgoing',cell:[r,c],shots:newShots}
    setOEnemyShell({sx:csRef.current/2,sy:-csRef.current,dx:(c+0.5)*csRef.current,dy:(r+0.5)*csRef.current})
    await supabase.from('battleship_players').update({shots:newShots,updated_at:new Date().toISOString()}).eq('lobby_id',lobbyRef.current.id).eq('user_id',user.id)
  }

  const onOEnemyShellLanded=async()=>{
    setOEnemyShell(null)
    const p=pendingORef.current; if(!p||p.type!=='outgoing') return
    pendingORef.current=null
    const{cell,shots}=p
    const{data:oppRow}=await supabase.from('battleship_players').select('ships').eq('lobby_id',lobbyRef.current?.id||'').neq('user_id',user?.id||'').single()
    const oppShipsData=oppRow?.ships||[]
    const hit=isHit(oppShipsData,cell[0],cell[1])
    setOEnemyImpact({cell,type:hit?'explosion':'splash'}); clearAnim(setOEnemyImpact)
    const checked=checkSunk(oppShipsData,shots)
    const prev=checkSunk(oppShipsData,shots.slice(0,-1))
    const newlySunk=checked.find(s=>s.sunk&&!prev.find(q=>q.name===s.name)?.sunk)
    if(newlySunk){ setOEnemySink(newlySunk); setTimeout(()=>setOEnemySink(null),2200); showBanner(setOBanner,`🔥 You sunk their ${newlySunk.name}!`,'sunk',2500) }
    else showBanner(setOBanner,hit?'💥 HIT!':'💦 MISS',hit?'hit':'miss')
    if(allSunk(checked)){ setOnlineWinner(user.id); await supabase.from('battleship_lobbies').update({status:'finished'}).eq('id',lobbyRef.current.id); setOnlinePhase('over') }
  }

  useEffect(()=>{ if(mode==='online'&&onlinePhase==='lobby') loadLobbies() },[mode,onlinePhase])
  useEffect(()=>()=>subRef.current?.unsubscribe(),[])

  const resetAll=()=>{
    setScreen('menu'); setMode(null); setPhase('placing')
    setOnlinePhase('lobby'); setLobby(null); lobbyRef.current=null
    setOpponentReady(false); setMyShots([]); myShotsRef.current=[]
    setOppShots([]); oppShotsRef.current=[]; setMyShips([]); myShipsRef.current=[]
    setOnlineTurn(null); setOnlineWinner(null); setJoinCode(''); setJoinError('')
    setSelectedCell(null); setBanner(null); setOBanner(null)
    pendingShotRef.current=null; pendingORef.current=null
    subRef.current?.unsubscribe()
  }

  const isMyTurn=onlineTurn===user?.id

  // ── Screens ───────────────────────────────────────────────
  if(screen==='menu') return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,background:'var(--bg)',padding:24,...ns}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:48,marginBottom:8}}>🚢</div><div style={{fontWeight:800,fontSize:28,letterSpacing:'0.1em'}}>BATTLESHIP</div><div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>Sink the enemy fleet</div></div>
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
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Lobby code…" style={{flex:1,padding:'9px 12px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'var(--bg)',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none'}}/>
          <button onClick={joinByCode} style={{padding:'9px 16px',background:'var(--bg-2)',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',color:'var(--text)',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Join</button>
        </div>
        {joinError&&<div style={{color:'var(--danger)',fontSize:12,marginBottom:12}}>{joinError}</div>}
        <div style={{fontWeight:700,fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Open Lobbies</div>
        {lobbies.length===0?<div style={{textAlign:'center',color:'var(--text-3)',fontSize:13,padding:24}}>No open lobbies — create one!</div>
          :lobbies.map(lb=>(
            <div key={lb.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',marginBottom:8}}>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{lb.host?.username||'Unknown'}'s game</div><div style={{fontSize:11,color:'var(--text-3)'}}>Code: {lb.code}</div></div>
              <button onClick={()=>joinLobby(lb.id)} style={{padding:'7px 16px',background:'var(--accent)',border:'none',borderRadius:'var(--radius)',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Join</button>
            </div>
          ))
        }
      </div>
    </div>
  )

  if(mode==='online'&&onlinePhase==='waiting_opponent') return (
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,background:'var(--bg)',...ns}}>
      <div style={{fontSize:36}}>⏳</div><div style={{fontWeight:700,fontSize:18}}>Waiting for opponent…</div>
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
      <PlacementBoard cs={Math.min(cs,34)} onDone={mode==='ai'?handlePlacementDone:submitShipsOnline} opponentUsername={opponentReady?(opponentProfile?.username||'Opponent'):null}/>
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
    const updAI=checkSunk(aiShips,playerShots), updP=checkSunk(playerShips,aiShots)
    const sunkAI=updAI.filter(s=>s.sunk)
    const eGrid=<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Enemy Waters</div><BattleGrid ships={updAI} shots={playerShots} onShot={turn==='player'?handlePlayerShot:undefined} showShips={false} cs={cs} disabled={turn!=='player'||!!enemyShell} firingShip={null} impact={enemyImpact} sinkShip={enemySink} shell={enemyShell} onLand={onPlayerShellLanded} sunkEnemy={sunkAI}/></div>
    const pGrid=<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Your Fleet</div><BattleGrid ships={updP} shots={aiShots} showShips={true} cs={cs} disabled={true} firingShip={playerFiring} impact={playerImpact} sinkShip={playerSink} shell={playerShell} onLand={()=>setPlayerShell(null)}/></div>
    if(isMobile) return (
      <div style={{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',WebkitOverflowScrolling:'touch',...ns}}>
        <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',flexShrink:0}}><button onClick={resetAll} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>← Menu</button><span style={{fontWeight:700,fontSize:13,flex:1,textAlign:'center'}}>Battleship</span></div>
        <div style={{padding:'0 6px',width:'100%',flexShrink:0}}><Banner event={banner}/></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'8px 0 20px'}}>{eGrid}{pGrid}</div>
      </div>
    )
    return (
      <div style={{position:'absolute',inset:0,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:12,padding:16,...ns}}>
        {eGrid}
        <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:140}}>
          <button onClick={resetAll} style={{padding:'6px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>← Menu</button>
          <Banner event={banner}/>
          <ShipHealth ships={updAI} shots={playerShots} label="ENEMY FLEET"/>
          <ShipHealth ships={updP} shots={aiShots} label="YOUR FLEET"/>
        </div>
        {pGrid}
      </div>
    )
  }

  if(mode==='online'&&onlinePhase==='playing'){
    const myC=checkSunk(myShips,oppShots)
    const fireBtn=<button onClick={handleFire} disabled={!selectedCell||!isMyTurn} style={{padding:'10px 24px',background:selectedCell&&isMyTurn?'#dc2626':'var(--bg-3)',border:`2px solid ${selectedCell&&isMyTurn?'#dc2626':'var(--border-2)'}`,borderRadius:'var(--radius-lg)',color:selectedCell&&isMyTurn?'#fff':'var(--text-3)',fontSize:14,fontWeight:700,cursor:selectedCell&&isMyTurn?'pointer':'not-allowed',fontFamily:'inherit',transition:'all 0.2s',boxShadow:selectedCell&&isMyTurn?'0 0 14px rgba(220,38,38,0.4)':'none'}}>🔥 FIRE{selectedCell?` → ${String.fromCharCode(65+selectedCell[1])}${selectedCell[0]+1}`:''}</button>
    const eGrid=<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Enemy Waters</div><BattleGrid ships={[]} shots={myShots} onShot={isMyTurn?handleCellSelect:undefined} showShips={false} cs={cs} disabled={!isMyTurn||!!oEnemyShell} impact={oEnemyImpact} sinkShip={oEnemySink} shell={oEnemyShell} onLand={onOEnemyShellLanded}/>{selectedCell&&isMyTurn&&<div style={{fontSize:11,color:'var(--accent)'}}>Selected: {String.fromCharCode(65+selectedCell[1])}{selectedCell[0]+1}</div>}</div>
    const mGrid=<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}><div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Your Fleet</div><BattleGrid ships={myC} shots={oppShots} showShips={true} cs={cs} disabled={true} impact={oMyImpact} sinkShip={oMySink} shell={oMyShell} onLand={onOMyShellLanded}/></div>
    if(isMobile) return (
      <div style={{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',overflowY:'auto',WebkitOverflowScrolling:'touch',...ns}}>
        <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',flexShrink:0}}><button onClick={resetAll} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>← Menu</button><span style={{fontWeight:700,fontSize:13,flex:1,textAlign:'center'}}>Battleship</span></div>
        <div style={{padding:'0 6px',width:'100%',flexShrink:0}}><Banner event={oBanner}/></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'8px 0 20px'}}>{eGrid}{isMyTurn&&fireBtn}{mGrid}</div>
      </div>
    )
    return (
      <div style={{position:'absolute',inset:0,background:'var(--bg-3)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',gap:12,padding:16,...ns}}>
        {eGrid}
        <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:150,alignItems:'center'}}>
          <button onClick={resetAll} style={{width:'100%',padding:'6px',border:'1px solid var(--border-2)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>← Menu</button>
          <Banner event={oBanner}/>
          {fireBtn}
          <ShipHealth ships={myC} shots={oppShots} label="YOUR FLEET"/>
          {lobby&&<div style={{fontSize:10,color:'var(--text-3)',textAlign:'center'}}>Code: <strong>{lobby.code}</strong></div>}
        </div>
        {mGrid}
      </div>
    )
  }

  return null
}
