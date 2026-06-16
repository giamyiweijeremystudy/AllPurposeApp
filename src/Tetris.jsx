import { useState, useEffect, useCallback, useRef } from 'react'

const COLS = 10
const ROWS = 20
const TICK_MS = 500

const PIECES = {
  I: { shape: [[1,1,1,1]], color: '#06b6d4' },
  O: { shape: [[1,1],[1,1]], color: '#eab308' },
  T: { shape: [[0,1,0],[1,1,1]], color: '#a855f7' },
  S: { shape: [[0,1,1],[1,1,0]], color: '#22c55e' },
  Z: { shape: [[1,1,0],[0,1,1]], color: '#ef4444' },
  J: { shape: [[1,0,0],[1,1,1]], color: '#3b82f6' },
  L: { shape: [[0,0,1],[1,1,1]], color: '#f97316' },
}
const PIECE_KEYS = Object.keys(PIECES)

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)]
  return { key, shape: PIECES[key].shape, color: PIECES[key].color }
}
function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}
function rotate(shape) {
  return shape[0].map((_, i) => shape.map(row => row[i]).reverse())
}
function fits(board, shape, x, y) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = y + r, nc = x + c
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false
      if (board[nr][nc]) return false
    }
  return true
}
function place(board, shape, x, y, color) {
  const next = board.map(r => [...r])
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) next[y + r][x + c] = color
  return next
}
function clearLines(board) {
  const kept = board.filter(row => row.some(c => !c))
  const cleared = ROWS - kept.length
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null))
  return { board: [...empty, ...kept], cleared }
}
function startX(shape) { return Math.floor((COLS - shape[0].length) / 2) }
function ghostY(board, shape, x, y) {
  let gy = y
  while (fits(board, shape, x, gy + 1)) gy++
  return gy
}
const SCORES = [0, 100, 300, 500, 800]
const LEVEL_LINES = 10

export function Tetris() {
  const [screen, setScreen] = useState('menu')
  const [board, setBoard] = useState(emptyBoard())
  const [piece, setPiece] = useState(null)
  const [next, setNext] = useState(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [paused, setPaused] = useState(false)

  const pausedRef = useRef(false)
  const boardRef = useRef(emptyBoard())
  const pieceRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })
  const nextRef = useRef(null)
  const scoreRef = useRef(0)
  const linesRef = useRef(0)
  const levelRef = useRef(1)
  const gameOverRef = useRef(false)
  const tickRef = useRef(null)
  const softDropRef = useRef(null)
  const boardElRef = useRef(null)

  const spawnPiece = useCallback((board, nextPiece) => {
    const p = nextPiece || randomPiece()
    const n = randomPiece()
    const x = startX(p.shape)
    if (!fits(board, p.shape, x, 0)) {
      gameOverRef.current = true
      clearInterval(tickRef.current)
      setScreen('over')
      return
    }
    pieceRef.current = p
    posRef.current = { x, y: 0 }
    nextRef.current = n
    setPiece({ ...p })
    setPos({ x, y: 0 })
    setNext({ ...n })
  }, [])

  const lockPiece = useCallback(() => {
    if (!pieceRef.current) return
    const { shape, color } = pieceRef.current
    const { x, y } = posRef.current
    const newBoard = place(boardRef.current, shape, x, y, color)
    const { board: cleared, cleared: n } = clearLines(newBoard)
    boardRef.current = cleared
    const newLines = linesRef.current + n
    const newLevel = Math.floor(newLines / LEVEL_LINES) + 1
    const newScore = scoreRef.current + SCORES[n] * newLevel
    linesRef.current = newLines; levelRef.current = newLevel; scoreRef.current = newScore
    setBoard(cleared.map(r => [...r]))
    setLines(newLines); setLevel(newLevel); setScore(newScore)
    spawnPiece(cleared, nextRef.current)
  }, [spawnPiece])

  const moveDown = useCallback(() => {
    if (pausedRef.current || gameOverRef.current || !pieceRef.current) return
    const { shape } = pieceRef.current
    const { x, y } = posRef.current
    if (fits(boardRef.current, shape, x, y + 1)) {
      posRef.current = { x, y: y + 1 }
      setPos({ x, y: y + 1 })
    } else {
      lockPiece()
    }
  }, [lockPiece])

  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    const ms = Math.max(80, TICK_MS - (levelRef.current - 1) * 40)
    tickRef.current = setInterval(moveDown, ms)
  }, [moveDown])

  const doMove = useCallback((dir) => {
    if (pausedRef.current || gameOverRef.current || !pieceRef.current) return
    const { shape } = pieceRef.current
    const { x, y } = posRef.current
    if (fits(boardRef.current, shape, x + dir, y)) {
      posRef.current = { x: x + dir, y }
      setPos({ x: x + dir, y })
    }
  }, [])

  const doRotate = useCallback(() => {
    if (pausedRef.current || gameOverRef.current || !pieceRef.current) return
    const { shape } = pieceRef.current
    const { x, y } = posRef.current
    const r = rotate(shape)
    for (const kick of [0, -1, 1, -2, 2]) {
      if (fits(boardRef.current, r, x + kick, y)) {
        pieceRef.current = { ...pieceRef.current, shape: r }
        posRef.current = { x: x + kick, y }
        setPiece(p => ({ ...p, shape: r }))
        setPos({ x: x + kick, y })
        return
      }
    }
  }, [])

  const doHardDrop = useCallback(() => {
    if (pausedRef.current || gameOverRef.current || !pieceRef.current) return
    const { shape } = pieceRef.current
    const { x, y } = posRef.current
    let gy = y
    while (fits(boardRef.current, shape, x, gy + 1)) gy++
    posRef.current = { x, y: gy }
    setPos({ x, y: gy })
    setTimeout(() => lockPiece(), 50)
  }, [lockPiece])

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    if (pausedRef.current) clearInterval(tickRef.current)
    else startTick()
  }, [startTick])

  const startGame = useCallback(() => {
    gameOverRef.current = false; pausedRef.current = false
    boardRef.current = emptyBoard()
    scoreRef.current = 0; linesRef.current = 0; levelRef.current = 1
    setBoard(emptyBoard()); setScore(0); setLines(0); setLevel(1)
    setPaused(false); setScreen('game')
    const p = randomPiece(), n = randomPiece()
    const x = startX(p.shape)
    pieceRef.current = p; posRef.current = { x, y: 0 }; nextRef.current = n
    setPiece({ ...p }); setPos({ x, y: 0 }); setNext({ ...n })
  }, [])

  useEffect(() => {
    if (screen === 'game') startTick()
    return () => { clearInterval(tickRef.current); clearInterval(softDropRef.current) }
  }, [screen])

  useEffect(() => {
    if (screen === 'game' && !paused) startTick()
  }, [level])

  // Keyboard
  useEffect(() => {
    if (screen !== 'game') return
    const down = (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(); return }
      if (pausedRef.current) return
      if (e.key === 'ArrowLeft') doMove(-1)
      else if (e.key === 'ArrowRight') doMove(1)
      else if (e.key === 'ArrowUp' || e.key === 'x') doRotate()
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!softDropRef.current)
          softDropRef.current = setInterval(() => { if (!pausedRef.current) moveDown() }, 60)
      } else if (e.key === ' ') { e.preventDefault(); doHardDrop() }
    }
    const up = (e) => {
      if (e.key === 'ArrowDown') { clearInterval(softDropRef.current); softDropRef.current = null }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [screen, doMove, doRotate, doHardDrop, moveDown, togglePause])

  // Touch controls — attached directly to board element to avoid global interference
  useEffect(() => {
    if (screen !== 'game') return
    const el = boardElRef.current
    if (!el) return

    let t0 = null
    let moved = false

    const onStart = (e) => {
      t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
      moved = false
    }

    const onMove = (e) => {
      if (!t0) return
      const dx = e.touches[0].clientX - t0.x
      const dy = e.touches[0].clientY - t0.y
      // Only prevent default for horizontal swipes or downward swipes (not upward scroll)
      if (Math.abs(dx) > 8 || dy > 8) {
        e.preventDefault()
        moved = true
      }
    }

    const onEnd = (e) => {
      if (!t0) return
      const dx = e.changedTouches[0].clientX - t0.x
      const dy = e.changedTouches[0].clientY - t0.y
      const dt = Date.now() - t0.time
      const absDx = Math.abs(dx), absDy = Math.abs(dy)

      if (pausedRef.current || gameOverRef.current) { t0 = null; return }

      if (!moved && absDx < 12 && absDy < 12 && dt < 250) {
        // Tap = rotate
        doRotate()
      } else if (absDx > absDy && absDx > 20) {
        // Horizontal swipe — move by cells
        const cells = Math.round(absDx / 30)
        const dir = dx > 0 ? 1 : -1
        for (let i = 0; i < Math.max(1, cells); i++) doMove(dir)
      } else if (dy > 60) {
        // Swipe down (long) = hard drop
        doHardDrop()
      } else if (dy > 15 && absDy > absDx) {
        // Short swipe down = soft drop one step
        moveDown()
      }

      t0 = null
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [screen, doMove, doRotate, doHardDrop, moveDown])

  const displayBoard = () => {
    const b = board.map(r => [...r])
    if (piece && screen === 'game') {
      const gy = ghostY(boardRef.current, piece.shape, pos.x, pos.y)
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c] && gy + r >= 0 && gy + r < ROWS && !b[gy + r][pos.x + c])
            b[gy + r][pos.x + c] = piece.color + '44'
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c] && pos.y + r >= 0)
            b[pos.y + r][pos.x + c] = piece.color
    }
    return b
  }

  const CELL = 28
  const ns = { userSelect:'none', WebkitUserSelect:'none' }

  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', ...ns }}>
      <div>
        <div style={{ fontWeight:800, fontSize:36, letterSpacing:'0.15em', textAlign:'center', background:'linear-gradient(135deg, #06b6d4, #a855f7, #ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>TETRIS</div>
        <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', marginTop:4 }}>Clear lines, beat your score</div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {Object.entries(PIECES).map(([k, p]) => (
          <div key={k} style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {p.shape.map((row, ri) => (
              <div key={ri} style={{ display:'flex', gap:2 }}>
                {row.map((c, ci) => <div key={ci} style={{ width:10, height:10, borderRadius:2, background: c ? p.color : 'transparent' }} />)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button onClick={startGame} style={{ padding:'14px 48px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
        Play
      </button>
      <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', lineHeight:2 }}>
        <strong>Desktop:</strong> ← → move · ↑/X rotate · ↓ soft drop · Space hard drop<br/>
        <strong>Mobile:</strong> Tap to rotate · swipe ← → to move · swipe ↓ to drop
      </div>
    </div>
  )

  if (screen === 'over') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
      <div style={{ fontWeight:800, fontSize:28, color:'var(--danger)' }}>GAME OVER</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>Score</div>
        <div style={{ fontSize:40, fontWeight:800 }}>{score.toLocaleString()}</div>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>Level {level} · {lines} lines</div>
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => setScreen('menu')} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
        <button onClick={startGame} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>
      </div>
    </div>
  )

  const db = displayBoard()

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', ...ns }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>

        {/* Board — touch target */}
        <div ref={boardElRef} style={{ border:'2px solid var(--border-2)', borderRadius:4, overflow:'hidden', background:'var(--bg)', flexShrink:0, position:'relative', cursor:'pointer' }}>
          {db.map((row, ri) => (
            <div key={ri} style={{ display:'flex' }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{
                  width: CELL, height: CELL,
                  background: cell || 'transparent',
                  borderRight: '1px solid ' + (cell && !cell.endsWith('44') ? 'rgba(0,0,0,0.25)' : 'var(--border)'),
                  borderBottom: '1px solid ' + (cell && !cell.endsWith('44') ? 'rgba(0,0,0,0.25)' : 'var(--border)'),
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
          {[{ label:'SCORE', value: score.toLocaleString() }, { label:'LEVEL', value: level }, { label:'LINES', value: lines }].map(({ label, value }) => (
            <div key={label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:800 }}>{value}</div>
            </div>
          ))}
          {/* Next */}
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:6 }}>NEXT</div>
            {next && next.shape.map((row, ri) => (
              <div key={ri} style={{ display:'flex', gap:2, marginBottom:2 }}>
                {row.map((c, ci) => <div key={ci} style={{ width:14, height:14, borderRadius:2, background: c ? next.color : 'var(--bg-3)' }} />)}
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
