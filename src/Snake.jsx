import { useState, useEffect, useRef, useCallback } from 'react'

const COLS = 20
const ROWS = 20
const CELL = 22

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

export function Snake() {
  const [screen, setScreen] = useState('menu') // menu | game | over
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('snake_best') || 0))
  const [paused, setPaused] = useState(false)

  const G = useRef(null)
  const [renderSnake, setRenderSnake] = useState([])
  const [renderFood, setRenderFood] = useState([0,0])

  const tickRef = useRef(null)
  const pausedRef = useRef(false)
  const ns = { userSelect:'none', WebkitUserSelect:'none' }

  const pushRender = useCallback(() => {
    const g = G.current
    if (!g) return
    setRenderSnake([...g.snake.map(s => [...s])])
    setRenderFood([...g.food])
    setScore(g.score)
  }, [])

  const tick = useCallback(() => {
    if (pausedRef.current) return
    const g = G.current
    if (!g || !g.alive) return

    g.dir = g.nextDir
    const [hx, hy] = g.snake[0]
    const [dx, dy] = g.dir
    const nx = hx + dx
    const ny = hy + dy

    // Wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      g.alive = false
      pushRender()
      clearInterval(tickRef.current)
      setScreen('over')
      return
    }

    // Self collision (skip tail tip — it moves away)
    if (g.snake.slice(0, -1).some(([x,y]) => x === nx && y === ny)) {
      g.alive = false
      pushRender()
      clearInterval(tickRef.current)
      setScreen('over')
      return
    }

    const ate = nx === g.food[0] && ny === g.food[1]
    const newSnake = [[nx, ny], ...g.snake]
    if (!ate) newSnake.pop()

    if (ate) {
      g.score += 10
      g.food = randomFood(newSnake)
    }
    g.snake = newSnake
    pushRender()
  }, [pushRender])

  const tickFnRef = useRef(null)
  useEffect(() => { tickFnRef.current = tick }, [tick])

  const speed = (score) => {
    if (score >= 200) return 80
    if (score >= 100) return 110
    if (score >= 50)  return 140
    return 170
  }

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
    if (!g) return
    const [dx, dy] = d
    const [cx, cy] = g.dir
    // Prevent 180 reverse
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

  // Save best score on game over
  useEffect(() => {
    if (screen === 'over') {
      const s = G.current?.score || 0
      if (s > bestScore) {
        setBestScore(s)
        localStorage.setItem('snake_best', s)
      }
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
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') setDir(DIR.LEFT)
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setDir(DIR.RIGHT)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [screen, setDir, togglePause])

  // Touch swipe
  const boardRef = useRef(null)
  useEffect(() => {
    if (screen !== 'game') return
    const el = boardRef.current
    if (!el) return
    let t0 = null
    const onStart = (e) => { const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY } }
    const onEnd = (e) => {
      if (!t0) return
      const t = e.changedTouches[0]
      const dx = t.clientX - t0.x
      const dy = t.clientY - t0.y
      const adx = Math.abs(dx), ady = Math.abs(dy)
      if (Math.max(adx, ady) < 15) return
      if (adx > ady) setDir(dx > 0 ? DIR.RIGHT : DIR.LEFT)
      else setDir(dy > 0 ? DIR.DOWN : DIR.UP)
      t0 = null
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [screen, setDir])

  useEffect(() => () => clearInterval(tickRef.current), [])

  const level = score >= 200 ? 4 : score >= 100 ? 3 : score >= 50 ? 2 : 1

  // ── Menu ──────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28, background:'var(--bg)', ...ns }}>
      <div style={{ textAlign:'center' }}>
        {/* Snake logo */}
        <div style={{ display:'flex', gap:5, justifyContent:'center', marginBottom:14 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              width:16, height:16, borderRadius:4,
              background: i === 0 ? '#22c55e' : `hsl(${140 - i * 10},70%,${45 - i * 3}%)`,
              transform: `translateY(${[0,-4,-6,-4,0,4][i]}px)`,
              transition: 'transform 0.3s',
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
        <b>Mobile:</b> Swipe to change direction
      </div>
    </div>
  )

  // ── Game Over ─────────────────────────────────────────────
  if (screen === 'over') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
      <div style={{ fontWeight:800, fontSize:28, color:'var(--danger)' }}>GAME OVER</div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>Score</div>
        <div style={{ fontSize:42, fontWeight:800, color:'#22c55e' }}>{score.toLocaleString()}</div>
        {score >= bestScore && score > 0 && (
          <div style={{ fontSize:12, color:'#22c55e', marginTop:4 }}>🏆 New best!</div>
        )}
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>Level {level}</div>
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => setScreen('menu')} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
        <button onClick={startGame} style={{ padding:'10px 24px', background:'#22c55e', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>
      </div>
    </div>
  )

  // ── Game ──────────────────────────────────────────────────
  const boardW = COLS * CELL
  const boardH = ROWS * CELL

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', ...ns }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>

        {/* Board */}
        <div ref={boardRef} style={{ position:'relative', width:boardW, height:boardH, background:'var(--bg)', border:'2px solid var(--border-2)', borderRadius:6, overflow:'hidden', flexShrink:0, cursor:'pointer' }}>

          {/* Grid lines */}
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.06 }}>
            {Array.from({ length: COLS + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i*CELL} y1={0} x2={i*CELL} y2={boardH} stroke="var(--text)" strokeWidth={1} />
            ))}
            {Array.from({ length: ROWS + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i*CELL} x2={boardW} y2={i*CELL} stroke="var(--text)" strokeWidth={1} />
            ))}
          </svg>

          {/* Snake */}
          {renderSnake.map(([x,y], i) => {
            const isHead = i === 0
            const lightness = 55 - i * 1.2
            return (
              <div key={i} style={{
                position:'absolute',
                left: x * CELL + 1,
                top:  y * CELL + 1,
                width: CELL - 2,
                height: CELL - 2,
                background: isHead ? '#16a34a' : `hsl(140,65%,${Math.max(lightness, 30)}%)`,
                borderRadius: isHead ? 5 : 3,
                boxShadow: isHead ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
                transition: 'left 0.05s, top 0.05s',
              }} />
            )
          })}

          {/* Food */}
          <div style={{
            position:'absolute',
            left: renderFood[0] * CELL + 2,
            top:  renderFood[1] * CELL + 2,
            width: CELL - 4,
            height: CELL - 4,
            background: '#ef4444',
            borderRadius: '50%',
            boxShadow: '0 0 8px rgba(239,68,68,0.6)',
          }} />

          {/* Pause overlay */}
          {paused && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontWeight:800, fontSize:22, letterSpacing:'0.1em' }}>PAUSED</span>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:80 }}>
          {[
            { l:'SCORE', v: score.toLocaleString(), color:'#22c55e' },
            { l:'BEST',  v: bestScore.toLocaleString(), color:'var(--text-3)' },
            { l:'LEVEL', v: level, color:'var(--accent)' },
          ].map(({ l, v, color }) => (
            <div key={l} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:800, color }}>{v}</div>
            </div>
          ))}

          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:6 }}>SPEED</div>
            <div style={{ display:'flex', gap:3 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ flex:1, height:6, borderRadius:3, background: level >= i ? '#22c55e' : 'var(--border)' }} />
              ))}
            </div>
          </div>

          <button onClick={togglePause} style={{ padding:'8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => { clearInterval(tickRef.current); setScreen('menu') }} style={{ padding:'8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
            ✕ Quit
          </button>
        </div>
      </div>
    </div>
  )
}
