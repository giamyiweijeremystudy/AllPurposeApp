import { useState, useEffect, useRef, useCallback } from 'react'

const COLS = 20
const ROWS = 20

const DIR = { UP: [0,-1], DOWN: [0,1], LEFT: [-1,0], RIGHT: [1,0] }

const randomFood = (snake) => {
  let pos
  do {
    pos = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)]
  } while (snake.some(([x,y]) => x === pos[0] && y === pos[1]))
  return pos
}

const initialState = () => {
  const snake = [[10,10],[9,10],[8,10]]
  return { snake, dir: [1,0], nextDir: [1,0], food: randomFood(snake), score: 0, alive: true }
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const h = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return size
}

export function Snake() {
  const [screen, setScreen] = useState('menu')
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('snake_best') || 0))
  const [paused, setPaused] = useState(false)
  const { w, h } = useWindowSize()

  // Responsive cell size: fit board + panel in available space
  const isMobile = w < 600
  const PANEL_H = isMobile ? 80 : 0   // panel below board on mobile
  const PANEL_W = isMobile ? 0 : 92   // panel to the right on desktop
  const PADDING  = isMobile ? 16 : 32

  const maxBoardW = w - PADDING * 2 - PANEL_W
  const maxBoardH = h - PADDING * 2 - PANEL_H - (isMobile ? 120 : 0) // leave room for d-pad
  const CELL = Math.floor(Math.min(maxBoardW / COLS, maxBoardH / ROWS))
  const boardW = CELL * COLS
  const boardH = CELL * ROWS

  const G = useRef(null)
  const [renderSnake, setRenderSnake] = useState([])
  const [renderFood, setRenderFood] = useState([0,0])

  const tickRef = useRef(null)
  const pausedRef = useRef(false)
  const ns = { userSelect:'none', WebkitUserSelect:'none', touchAction:'none' }

  const pushRender = useCallback(() => {
    const g = G.current
    if (!g) return
    setRenderSnake([...g.snake.map(s => [...s])])
    setRenderFood([...g.food])
    setScore(g.score)
  }, [])

  const speed = (s) => s >= 200 ? 100 : s >= 100 ? 130 : s >= 50 ? 160 : 200

  const tick = useCallback(() => {
    if (pausedRef.current) return
    const g = G.current
    if (!g || !g.alive) return
    g.dir = g.nextDir
    const [hx, hy] = g.snake[0]
    const [dx, dy] = g.dir
    const nx = hx + dx, ny = hy + dy

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      g.alive = false; pushRender(); clearInterval(tickRef.current); setScreen('over'); return
    }
    if (g.snake.slice(0, -1).some(([x,y]) => x === nx && y === ny)) {
      g.alive = false; pushRender(); clearInterval(tickRef.current); setScreen('over'); return
    }

    const ate = nx === g.food[0] && ny === g.food[1]
    const newSnake = [[nx, ny], ...g.snake]
    if (!ate) newSnake.pop()
    if (ate) { g.score += 10; g.food = randomFood(newSnake) }
    g.snake = newSnake
    pushRender()
  }, [pushRender])

  const tickFnRef = useRef(null)
  useEffect(() => { tickFnRef.current = tick }, [tick])

  const startGame = useCallback(() => {
    clearInterval(tickRef.current)
    pausedRef.current = false
    setPaused(false)
    G.current = initialState()
    pushRender()
    setScreen('game')
    tickRef.current = setInterval(() => tickFnRef.current?.(), speed(0))
  }, [pushRender])

  const setDir = useCallback((d) => {
    const g = G.current
    if (!g || pausedRef.current) return
    const [dx, dy] = d
    const [cx, cy] = g.dir
    if (dx === -cx && dy === -cy) return
    g.nextDir = d
  }, [])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    if (pausedRef.current) {
      clearInterval(tickRef.current)
    } else {
      tickRef.current = setInterval(() => tickFnRef.current?.(), speed(G.current?.score || 0))
    }
  }, [])

  useEffect(() => {
    if (screen === 'over') {
      const s = G.current?.score || 0
      if (s > bestScore) { setBestScore(s); localStorage.setItem('snake_best', s) }
    }
  }, [screen])

  // Keyboard
  useEffect(() => {
    if (screen !== 'game') return
    const down = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); return }
      if (pausedRef.current) return
      if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') { e.preventDefault(); setDir(DIR.UP) }
      if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') { e.preventDefault(); setDir(DIR.DOWN) }
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') { e.preventDefault(); setDir(DIR.LEFT) }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); setDir(DIR.RIGHT) }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [screen, setDir, togglePause])

  const boardRef = useRef(null)

  useEffect(() => () => clearInterval(tickRef.current), [])

  const level = score >= 200 ? 4 : score >= 100 ? 3 : score >= 50 ? 2 : 1

  // ── Shared stat card ─────────────────────────────────────────
  const StatCard = ({ l, v, color }) => (
    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding: isMobile ? '6px 12px' : '8px 10px', minWidth: isMobile ? 64 : 'auto' }}>
      <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:2 }}>{l}</div>
      <div style={{ fontSize: isMobile ? 16 : 18, fontWeight:800, color: color || 'var(--text)' }}>{v}</div>
    </div>
  )

  // ── D-pad button ─────────────────────────────────────────────
  const DPadBtn = ({ dir: d, icon, style: s }) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); setDir(d) }}
      onClick={() => setDir(d)}
      style={{
        width:52, height:52, borderRadius:10,
        background:'var(--bg-2)', border:'1px solid var(--border-2)',
        color:'var(--text-2)', fontSize:20, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
        WebkitTapHighlightColor:'transparent',
        ...s
      }}
    >{icon}</button>
  )

  // ── Menu ─────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', padding:24, ...ns }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:5, justifyContent:'center', marginBottom:12 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              width:14, height:14, borderRadius:3,
              background: i === 0 ? '#16a34a' : `hsl(${140 - i*10},70%,${45 - i*3}%)`,
              transform: `translateY(${[0,-4,-6,-4,0,4][i]}px)`,
            }} />
          ))}
        </div>
        <div style={{ fontWeight:800, fontSize:32, letterSpacing:'0.12em', color:'#22c55e' }}>SNAKE</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>Eat the food, don't hit the walls</div>
      </div>

      {bestScore > 0 && (
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 20px', textAlign:'center' }}>
          <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Best Score</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#22c55e' }}>{bestScore}</div>
        </div>
      )}

      <button onClick={startGame} style={{ padding:'14px 52px', background:'#22c55e', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
        Play
      </button>
      <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', lineHeight:2 }}>
        <b>Keys:</b> WASD / arrows · P = pause<br/>
        <b>Mobile:</b> Use the d-pad
      </div>
    </div>
  )

  // ── Game Over ────────────────────────────────────────────────
  if (screen === 'over') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
      <div style={{ fontWeight:800, fontSize:28, color:'var(--danger)' }}>GAME OVER</div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>Score</div>
        <div style={{ fontSize:42, fontWeight:800, color:'#22c55e' }}>{score.toLocaleString()}</div>
        {score > 0 && score >= bestScore && <div style={{ fontSize:12, color:'#22c55e', marginTop:4 }}>🏆 New best!</div>}
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>Level {level}</div>
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => setScreen('menu')} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
        <button onClick={startGame} style={{ padding:'10px 24px', background:'#22c55e', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>
      </div>
    </div>
  )

  // ── Game ─────────────────────────────────────────────────────
  const board = (
    <div ref={boardRef} style={{
      position:'relative', width:boardW, height:boardH,
      background:'var(--bg)', border:'2px solid var(--border-2)',
      borderRadius:6, overflow:'hidden', flexShrink:0, cursor:'pointer',
    }}>
      {/* Grid lines */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.05 }}>
        {Array.from({ length: COLS+1 }, (_,i) => <line key={`v${i}`} x1={i*CELL} y1={0} x2={i*CELL} y2={boardH} stroke="var(--text)" strokeWidth={1}/>)}
        {Array.from({ length: ROWS+1 }, (_,i) => <line key={`h${i}`} x1={0} y1={i*CELL} x2={boardW} y2={i*CELL} stroke="var(--text)" strokeWidth={1}/>)}
      </svg>

      {/* Snake */}
      {renderSnake.map(([x,y], i) => {
        const isHead = i === 0
        return (
          <div key={i} style={{
            position:'absolute',
            left: x*CELL+1, top: y*CELL+1,
            width: CELL-2, height: CELL-2,
            background: isHead ? '#16a34a' : `hsl(140,65%,${Math.max(55 - i*1.2, 30)}%)`,
            borderRadius: isHead ? Math.max(CELL*0.25, 3) : Math.max(CELL*0.15, 2),
            boxShadow: isHead ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
          }}/>
        )
      })}

      {/* Food */}
      <div style={{
        position:'absolute',
        left: renderFood[0]*CELL + CELL*0.1,
        top:  renderFood[1]*CELL + CELL*0.1,
        width: CELL*0.8, height: CELL*0.8,
        background:'#ef4444', borderRadius:'50%',
        boxShadow:'0 0 8px rgba(239,68,68,0.6)',
      }}/>

      {/* Pause overlay */}
      {paused && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ color:'#fff', fontWeight:800, fontSize:22, letterSpacing:'0.1em' }}>PAUSED</span>
        </div>
      )}
    </div>
  )

  const statsRow = (
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      <StatCard l="SCORE" v={score.toLocaleString()} color="#22c55e"/>
      <StatCard l="BEST"  v={bestScore.toLocaleString()} color="var(--text-3)"/>
      <StatCard l="LEVEL" v={level} color="var(--accent)"/>
      <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
        <button onClick={togglePause} style={{ padding:'6px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit', whiteSpace:'nowrap' }}>
          {paused ? '▶' : '⏸'}
        </button>
        <button onClick={() => { clearInterval(tickRef.current); setScreen('menu') }} style={{ padding:'6px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
          ✕
        </button>
      </div>
    </div>
  )

  const sidePanel = (
    <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:82 }}>
      <StatCard l="SCORE" v={score.toLocaleString()} color="#22c55e"/>
      <StatCard l="BEST"  v={bestScore.toLocaleString()} color="var(--text-3)"/>
      <StatCard l="LEVEL" v={level} color="var(--accent)"/>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:6 }}>SPEED</div>
        <div style={{ display:'flex', gap:3 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ flex:1, height:6, borderRadius:3, background: level >= i ? '#22c55e' : 'var(--border)' }}/>)}
        </div>
      </div>
      <button onClick={togglePause} style={{ padding:'8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>
      <button onClick={() => { clearInterval(tickRef.current); setScreen('menu') }} style={{ padding:'8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
        ✕ Quit
      </button>
    </div>
  )

  const dpad = (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, ...ns }}>
      <DPadBtn dir={DIR.UP}    icon="▲"/>
      <div style={{ display:'flex', gap:4 }}>
        <DPadBtn dir={DIR.LEFT}  icon="◀"/>
        <div style={{ width:52, height:52 }}/>
        <DPadBtn dir={DIR.RIGHT} icon="▶"/>
      </div>
      <DPadBtn dir={DIR.DOWN}  icon="▼"/>
    </div>
  )

  if (isMobile) return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'12px 8px', overflow:'hidden', gap:8, ...ns }}>
      {statsRow}
      {board}
      {dpad}
    </div>
  )

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', ...ns }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        {board}
        {sidePanel}
      </div>
    </div>
  )
}
