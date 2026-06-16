import { useState, useEffect, useRef, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────
const COLS = 10
const ROWS = 20

const PIECES = {
  I: { shape: [[1,1,1,1]],           color: '#06b6d4' },
  O: { shape: [[1,1],[1,1]],         color: '#eab308' },
  T: { shape: [[0,1,0],[1,1,1]],     color: '#a855f7' },
  S: { shape: [[0,1,1],[1,1,0]],     color: '#22c55e' },
  Z: { shape: [[1,1,0],[0,1,1]],     color: '#ef4444' },
  J: { shape: [[1,0,0],[1,1,1]],     color: '#3b82f6' },
  L: { shape: [[0,0,1],[1,1,1]],     color: '#f97316' },
}
const PIECE_KEYS = Object.keys(PIECES)

// Speed in ms per row: only changes at milestones
function tickMs(lines) {
  if (lines >= 100) return 180
  if (lines >= 75)  return 260
  if (lines >= 50)  return 340
  if (lines >= 25)  return 420
  return 500
}

// ── Pure helpers ──────────────────────────────────────────────
const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null))

const randomPiece = () => {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)]
  return { shape: PIECES[key].shape, color: PIECES[key].color }
}

const rotate90 = shape => shape[0].map((_, i) => shape.map(r => r[i]).reverse())

const collides = (board, shape, x, y) => {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = y + r, nc = x + c
      if (nc < 0 || nc >= COLS || nr >= ROWS) return true
      if (nr >= 0 && board[nr][nc]) return true
    }
  return false
}

const stamp = (board, shape, x, y, color) => {
  const b = board.map(r => [...r])
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c] && y + r >= 0 && y + r < ROWS)
        b[y + r][x + c] = color
  return b
}

const sweep = board => {
  const kept = board.filter(row => row.some(c => !c))
  const cleared = ROWS - kept.length
  return {
    board: [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...kept],
    cleared,
  }
}

const spawnX = shape => Math.floor((COLS - shape[0].length) / 2)

const dropY = (board, shape, x, y) => {
  let gy = y
  while (!collides(board, shape, x, gy + 1)) gy++
  return gy
}

// ── Component ─────────────────────────────────────────────────
export function Tetris() {
  const [screen, setScreen] = useState('menu') // menu | game | over

  // All mutable game state lives in a single ref — no stale closures
  const G = useRef(null)

  // Only these drive re-renders
  const [renderBoard, setRenderBoard] = useState(emptyBoard())
  const [renderPiece, setRenderPiece] = useState(null) // { shape, color, x, y }
  const [renderNext, setRenderNext] = useState(null)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [paused, setPaused] = useState(false)

  const tickRef = useRef(null)
  const tickFnRef = useRef(null)
  const boardElRef = useRef(null)
  const pausedRef = useRef(false)

  // ── Render helper ───────────────────────────────────────────
  const pushRender = useCallback(() => {
    const g = G.current
    if (!g) return
    setRenderBoard(g.board.map(r => [...r]))
    setRenderPiece(g.piece ? { ...g.piece } : null)
    setRenderNext(g.next ? { ...g.next } : null)
    setScore(g.score)
    setLines(g.lines)
  }, [])

  // ── Lock current piece, clear lines, spawn next ─────────────
  const lock = useCallback(() => {
    const g = G.current
    if (!g || !g.piece) return

    // Stamp piece onto board
    const stamped = stamp(g.board, g.piece.shape, g.piece.x, g.piece.y, g.piece.color)
    const { board: swept, cleared } = sweep(stamped)

    g.board = swept
    g.lines += cleared
    g.score += [0, 100, 300, 500, 800][cleared] || 0

    // ── GAME OVER: blocks have reached the top row ──────────
    // Check if any cell in row 0 of the board is now filled
    if (swept[0].some(c => c !== null)) {
      g.piece = null
      g.board = swept
      pushRender()
      clearInterval(tickRef.current)
      tickRef.current = null
      setScreen('over')
      return
    }

    // Spawn next piece
    const p = g.next
    const n = randomPiece()
    const x = spawnX(p.shape)
    const y = 0

    g.piece = { ...p, x, y }
    g.next = n
    pushRender()

    // Adjust tick speed if milestone crossed
    const newMs = tickMs(g.lines)
    if (newMs !== g.currentMs) {
      g.currentMs = newMs
      clearInterval(tickRef.current)
      tickRef.current = setInterval(() => tickFnRef.current?.(), newMs)
    }
  }, [pushRender])

  // ── Tick: move piece down one row ────────────────────────────
  const tick = useCallback(() => {
    if (pausedRef.current) return
    const g = G.current
    if (!g || !g.piece) return

    if (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + 1)) {
      g.piece.y += 1
      pushRender()
    } else {
      lock()
    }
  }, [pushRender, lock])
  // Always keep tickFnRef pointing to latest tick
  useEffect(() => { tickFnRef.current = tick }, [tick])

  // ── Move / rotate helpers ────────────────────────────────────
  const moveX = useCallback((dir) => {
    const g = G.current
    if (!g?.piece || pausedRef.current) return
    if (!collides(g.board, g.piece.shape, g.piece.x + dir, g.piece.y)) {
      g.piece.x += dir
      pushRender()
    }
  }, [pushRender])

  const rotate = useCallback(() => {
    const g = G.current
    if (!g?.piece || pausedRef.current) return
    const r = rotate90(g.piece.shape)
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(g.board, r, g.piece.x + kick, g.piece.y)) {
        g.piece.shape = r
        g.piece.x += kick
        pushRender()
        return
      }
    }
  }, [pushRender])

  const softDrop = useCallback(() => {
    const g = G.current
    if (!g?.piece || pausedRef.current) return
    if (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + 1)) {
      g.piece.y += 1
      pushRender()
    } else {
      lock()
    }
  }, [pushRender, lock])

  const hardDrop = useCallback(() => {
    const g = G.current
    if (!g?.piece || pausedRef.current) return
    g.piece.y = dropY(g.board, g.piece.shape, g.piece.x, g.piece.y)
    pushRender()
    lock()
  }, [pushRender, lock])

  // ── Start game ───────────────────────────────────────────────
  const startGame = useCallback(() => {
    clearInterval(tickRef.current)
    pausedRef.current = false
    setPaused(false)

    const board = emptyBoard()
    const piece = { ...randomPiece(), x: 0, y: 0 }
    piece.x = spawnX(piece.shape)
    const next = randomPiece()

    G.current = { board, piece, next, score: 0, lines: 0, currentMs: 500 }
    pushRender()
    setScreen('game')

    tickRef.current = setInterval(() => tickFnRef.current?.(), 500)
  }, [tick, pushRender])

  // ── Pause ────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    if (pausedRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    } else {
      const ms = G.current?.currentMs || 500
      tickRef.current = setInterval(() => tickFnRef.current?.(), ms)
    }
  }, [tick])

  // Cleanup on unmount
  useEffect(() => () => clearInterval(tickRef.current), [])

  // ── Keyboard ─────────────────────────────────────────────────
  const softRef = useRef(null)
  const hardTimer = useRef(null)

  useEffect(() => {
    if (screen !== 'game') return
    const down = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); return }
      if (pausedRef.current) return
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') moveX(-1)
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveX(1)
      if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W' || e.key === 'x' || e.key === 'X') rotate()
      if (e.key === ' ') { e.preventDefault(); hardDrop() }
      if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && !softRef.current) {
        e.preventDefault()
        softRef.current = setInterval(softDrop, 60)
        // Long press → hard drop
        hardTimer.current = setTimeout(() => {
          clearInterval(softRef.current); softRef.current = null
          hardDrop()
        }, 450)
      }
    }
    const up = (e) => {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        clearInterval(softRef.current); softRef.current = null
        clearTimeout(hardTimer.current); hardTimer.current = null
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      clearInterval(softRef.current); softRef.current = null
      clearTimeout(hardTimer.current)
    }
  }, [screen, moveX, rotate, softDrop, hardDrop, togglePause])

  // ── Touch ────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return
    const el = boardElRef.current
    if (!el) return

    const CELL_PX = 28
    let t0 = null, t0orig = null, dir = null

    const onStart = (e) => {
      if (pausedRef.current) return
      const t = e.touches[0]
      t0 = t0orig = { x: t.clientX, y: t.clientY }
      dir = null
    }

    const onMove = (e) => {
      if (!t0 || pausedRef.current) return
      const t = e.touches[0]
      const dx = t.clientX - t0.x
      const dy = t.clientY - t0.y
      const adx = Math.abs(dx), ady = Math.abs(dy)

      if (!dir && (adx > 8 || ady > 8)) dir = adx >= ady ? 'h' : 'v'
      if (dir) e.preventDefault()

      if (dir === 'h') {
        const cells = Math.round(dx / CELL_PX)
        const g = G.current
        if (g?.piece) {
          const target = spawnX(g.piece.shape) + cells
          const clamped = Math.max(0, Math.min(COLS - g.piece.shape[0].length, target))
          if (clamped !== g.piece.x && !collides(g.board, g.piece.shape, clamped, g.piece.y)) {
            g.piece.x = clamped
            pushRender()
          }
        }
      } else if (dir === 'v' && dy >= CELL_PX) {
        softDrop()
        t0 = { x: t.clientX, y: t.clientY } // reset for next row
      }
    }

    const onEnd = (e) => {
      if (!t0orig) return
      const t = e.changedTouches[0]
      const totalDy = t.clientY - t0orig.y
      const totalDx = Math.abs(t.clientX - t0orig.x)
      const totalAdy = Math.abs(totalDy)

      if (!pausedRef.current) {
        if (!dir && totalDx < 10 && totalAdy < 10) rotate()          // tap
        else if (dir === 'v' && totalDy > 60) hardDrop()              // swipe down
      }
      t0 = null; t0orig = null; dir = null
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
    }
  }, [screen, softDrop, hardDrop, rotate, pushRender])

  // ── Render board ─────────────────────────────────────────────
  const display = () => {
    const b = renderBoard.map(r => [...r])
    if (renderPiece) {
      const { shape, color, x, y } = renderPiece
      const gy = dropY(renderBoard, shape, x, y)
      // Ghost
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c] && gy+r >= 0 && gy+r < ROWS && !b[gy+r][x+c])
            b[gy+r][x+c] = color + '44'
      // Piece
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c] && y+r >= 0) b[y+r][x+c] = color
    }
    return b
  }

  const CELL = 28
  const ns = { userSelect:'none', WebkitUserSelect:'none' }
  const milestone = lines >= 100 ? 4 : lines >= 75 ? 3 : lines >= 50 ? 2 : lines >= 25 ? 2 : 1
  const level = milestone

  // ── Screens ───────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', ...ns }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:800, fontSize:36, letterSpacing:'0.15em', background:'linear-gradient(135deg,#06b6d4,#a855f7,#ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>TETRIS</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>Clear lines, beat your score</div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {Object.values(PIECES).map((p, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {p.shape.map((row, ri) => (
              <div key={ri} style={{ display:'flex', gap:2 }}>
                {row.map((c, ci) => <div key={ci} style={{ width:10, height:10, borderRadius:2, background: c ? p.color : 'transparent' }} />)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button onClick={startGame} style={{ padding:'14px 48px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Play</button>
      <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', lineHeight:2 }}>
        <b>Keys:</b> WASD / arrows · Space = hard drop · P = pause<br/>
        <b>Mobile:</b> Tap = rotate · drag = move · swipe down = drop
      </div>
    </div>
  )

  if (screen === 'over') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
      <div style={{ fontWeight:800, fontSize:28, color:'var(--danger)' }}>GAME OVER</div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>Score</div>
        <div style={{ fontSize:42, fontWeight:800 }}>{score.toLocaleString()}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>Level {level} · {lines} lines</div>
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => setScreen('menu')} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
        <button onClick={startGame} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>
      </div>
    </div>
  )

  const db = display()

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', ...ns }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>

        {/* Board */}
        <div ref={boardElRef} style={{ position:'relative', border:'2px solid var(--border-2)', borderRadius:4, overflow:'hidden', background:'var(--bg)', flexShrink:0, cursor:'pointer' }}>
          {db.map((row, ri) => (
            <div key={ri} style={{ display:'flex' }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{
                  width:CELL, height:CELL,
                  background: cell || 'transparent',
                  borderRight:  `1px solid ${cell && !cell.endsWith('44') ? 'rgba(0,0,0,0.2)' : 'var(--border)'}`,
                  borderBottom: `1px solid ${cell && !cell.endsWith('44') ? 'rgba(0,0,0,0.2)' : 'var(--border)'}`,
                  borderRadius: cell && !cell.endsWith('44') ? 3 : 0,
                }} />
              ))}
            </div>
          ))}
          {paused && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontWeight:800, fontSize:22, letterSpacing:'0.1em' }}>PAUSED</span>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:80 }}>
          {[{ l:'SCORE', v: score.toLocaleString() }, { l:'LEVEL', v: level }, { l:'LINES', v: lines }].map(({ l, v }) => (
            <div key={l} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:800 }}>{v}</div>
            </div>
          ))}
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:6 }}>NEXT</div>
            {renderNext && renderNext.shape.map((row, ri) => (
              <div key={ri} style={{ display:'flex', gap:2, marginBottom:2 }}>
                {row.map((c, ci) => <div key={ci} style={{ width:14, height:14, borderRadius:2, background: c ? renderNext.color : 'var(--bg-3)' }} />)}
              </div>
            ))}
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
