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
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = y + r, nc = x + c
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false
      if (board[nr][nc]) return false
    }
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

function startX(shape) {
  return Math.floor((COLS - shape[0].length) / 2)
}

function ghostY(board, shape, x, y) {
  let gy = y
  while (fits(board, shape, x, gy + 1)) gy++
  return gy
}

const SCORES = [0, 100, 300, 500, 800]
const LEVEL_LINES = 10

export function Tetris() {
  const [screen, setScreen] = useState('menu') // menu | game | over
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

  const spawnPiece = useCallback((board, nextPiece) => {
    const p = nextPiece || randomPiece()
    const n = randomPiece()
    const x = startX(p.shape)
    const y = 0
    if (!fits(board, p.shape, x, y)) {
      gameOverRef.current = true
      setScreen('over')
      return
    }
    pieceRef.current = p
    posRef.current = { x, y }
    nextRef.current = n
    setPiece(p)
    setPos({ x, y })
    setNext(n)
  }, [])

  const lockPiece = useCallback(() => {
    const { shape, color } = pieceRef.current
    const { x, y } = posRef.current
    const newBoard = place(boardRef.current, shape, x, y, color)
    const { board: cleared, cleared: n } = clearLines(newBoard)
    boardRef.current = cleared
    const newLines = linesRef.current + n
    const newLevel = Math.floor(newLines / LEVEL_LINES) + 1
    const newScore = scoreRef.current + SCORES[n] * newLevel
    linesRef.current = newLines
    levelRef.current = newLevel
    scoreRef.current = newScore
    setBoard(cleared)
    setLines(newLines)
    setLevel(newLevel)
    setScore(newScore)
    spawnPiece(cleared, nextRef.current)
  }, [spawnPiece])

  const moveDown = useCallback(() => {
    if (pausedRef.current || gameOverRef.current) return
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

  const startGame = useCallback(() => {
    gameOverRef.current = false
    pausedRef.current = false
    boardRef.current = emptyBoard()
    scoreRef.current = 0
    linesRef.current = 0
    levelRef.current = 1
    setBoard(emptyBoard())
    setScore(0)
    setLines(0)
    setLevel(1)
    setPaused(false)
    setScreen('game')
    const p = randomPiece()
    const n = randomPiece()
    const x = startX(p.shape)
    pieceRef.current = p
    posRef.current = { x, y: 0 }
    nextRef.current = n
    setPiece(p)
    setPos({ x, y: 0 })
    setNext(n)
  }, [])

  // Start tick when game starts
  useEffect(() => {
    if (screen === 'game') startTick()
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [screen, startTick])

  // Restart tick when level changes (speed up)
  useEffect(() => {
    if (screen === 'game' && !paused) startTick()
  }, [level])

  // Keyboard
  useEffect(() => {
    if (screen !== 'game') return
    const handle = (e) => {
      if (gameOverRef.current) return
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        pausedRef.current = !pausedRef.current
        setPaused(p => !p)
        if (!pausedRef.current) startTick()
        else clearInterval(tickRef.current)
        return
      }
      if (pausedRef.current) return
      const { shape } = pieceRef.current
      const { x, y } = posRef.current
      if (e.key === 'ArrowLeft') {
        if (fits(boardRef.current, shape, x - 1, y)) { posRef.current = { x: x-1, y }; setPos({ x: x-1, y }) }
      } else if (e.key === 'ArrowRight') {
        if (fits(boardRef.current, shape, x + 1, y)) { posRef.current = { x: x+1, y }; setPos({ x: x+1, y }) }
      } else if (e.key === 'ArrowDown') {
        moveDown()
      } else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') {
        const r = rotate(shape)
        if (fits(boardRef.current, r, x, y)) { pieceRef.current = { ...pieceRef.current, shape: r }; setPiece(p => ({ ...p, shape: r })) }
      } else if (e.key === ' ') {
        e.preventDefault()
        let gy = y
        while (fits(boardRef.current, shape, x, gy + 1)) gy++
        posRef.current = { x, y: gy }
        setPos({ x, y: gy })
        setTimeout(lockPiece, 0)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [screen, moveDown, lockPiece, startTick])

  // Touch controls
  const touchStart = useRef(null)
  const onTouchStart = (e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() } }
  const onTouchEnd = (e) => {
    if (!touchStart.current || pausedRef.current || gameOverRef.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    const dt = Date.now() - touchStart.current.time
    const { shape } = pieceRef.current
    const { x, y } = posRef.current
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
      // Tap = rotate
      const r = rotate(shape)
      if (fits(boardRef.current, r, x, y)) { pieceRef.current = { ...pieceRef.current, shape: r }; setPiece(p => ({ ...p, shape: r })) }
    } else if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe
      const steps = Math.round(dx / 30)
      let nx = x
      for (let i = 0; i < Math.abs(steps); i++) {
        const nxt = nx + Math.sign(steps)
        if (fits(boardRef.current, shape, nxt, y)) nx = nxt
        else break
      }
      if (nx !== x) { posRef.current = { x: nx, y }; setPos({ x: nx, y }) }
    } else if (dy > 40) {
      // Swipe down = hard drop
      let gy = y
      while (fits(boardRef.current, shape, x, gy + 1)) gy++
      posRef.current = { x, y: gy }
      setPos({ x, y: gy })
      setTimeout(lockPiece, 0)
    } else if (dy < -40) {
      // Swipe up = rotate
      const r = rotate(shape)
      if (fits(boardRef.current, r, x, y)) { pieceRef.current = { ...pieceRef.current, shape: r }; setPiece(p => ({ ...p, shape: r })) }
    }
  }

  // Render board with ghost + current piece
  const displayBoard = () => {
    const b = board.map(r => [...r])
    if (piece && screen === 'game') {
      const gy = ghostY(boardRef.current, piece.shape, pos.x, pos.y)
      // Ghost
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c] && gy + r >= 0 && gy + r < ROWS)
            if (!b[gy + r][pos.x + c]) b[gy + r][pos.x + c] = piece.color + '44'
      // Current piece
      for (let r = 0; r < piece.shape.length; r++)
        for (let c = 0; c < piece.shape[r].length; c++)
          if (piece.shape[r][c] && pos.y + r >= 0) b[pos.y + r][pos.x + c] = piece.color
    }
    return b
  }

  const CELL = 28

  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', overflow:'hidden' }}>
      <div>
        <div style={{ fontWeight:800, fontSize:36, letterSpacing:'0.15em', textAlign:'center', background:'linear-gradient(135deg, #06b6d4, #a855f7, #ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>TETRIS</div>
        <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', marginTop:4 }}>Clear lines, beat your score</div>
      </div>

      {/* Preview pieces */}
      <div style={{ display:'flex', gap:12 }}>
        {Object.entries(PIECES).map(([k, p]) => (
          <div key={k} style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {p.shape.map((row, ri) => (
              <div key={ri} style={{ display:'flex', gap:2 }}>
                {row.map((c, ci) => (
                  <div key={ci} style={{ width:10, height:10, borderRadius:2, background: c ? p.color : 'transparent' }} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <button onClick={startGame} style={{
        padding:'14px 48px', background:'var(--accent)', border:'none',
        borderRadius:'var(--radius-lg)', color:'#fff', fontSize:16,
        fontWeight:700, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.05em',
      }}>Play</button>

      <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', lineHeight:1.8 }}>
        ← → Move &nbsp;·&nbsp; ↑ / Tap Rotate &nbsp;·&nbsp; ↓ Soft drop<br/>
        Space Hard drop &nbsp;·&nbsp; P Pause<br/>
        <span style={{ fontSize:10 }}>Mobile: swipe to move, tap to rotate, swipe down to drop</span>
      </div>
    </div>
  )

  if (screen === 'over') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)' }}>
      <div style={{ fontWeight:800, fontSize:28, color:'var(--danger)' }}>GAME OVER</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
        <div style={{ fontSize:13, color:'var(--text-3)' }}>Score</div>
        <div style={{ fontSize:40, fontWeight:800, color:'var(--text)' }}>{score.toLocaleString()}</div>
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
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-3)', overflow:'hidden', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Board */}
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        <div style={{ border:'2px solid var(--border-2)', borderRadius:6, overflow:'hidden', background:'var(--bg)' }}>
          {db.map((row, ri) => (
            <div key={ri} style={{ display:'flex' }}>
              {row.map((cell, ci) => (
                <div key={ci} style={{
                  width:CELL, height:CELL,
                  background: cell || 'transparent',
                  borderRight:'1px solid var(--border)',
                  borderBottom:'1px solid var(--border)',
                  borderRadius: cell && !cell.includes('44') ? 3 : 0,
                  transition: cell ? 'none' : 'background 0.05s',
                }} />
              ))}
            </div>
          ))}
        </div>

        {/* Side panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:16, minWidth:80 }}>
          {/* Score */}
          {[
            { label:'SCORE', value: score.toLocaleString() },
            { label:'LEVEL', value: level },
            { label:'LINES', value: lines },
          ].map(({ label, value }) => (
            <div key={label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 12px' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{value}</div>
            </div>
          ))}

          {/* Next piece */}
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 12px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.1em', marginBottom:8 }}>NEXT</div>
            {next && (
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {next.shape.map((row, ri) => (
                  <div key={ri} style={{ display:'flex', gap:3 }}>
                    {row.map((c, ci) => (
                      <div key={ci} style={{ width:14, height:14, borderRadius:2, background: c ? next.color : 'var(--bg-3)' }} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <button onClick={() => {
            pausedRef.current = !pausedRef.current
            setPaused(p => !p)
            if (!pausedRef.current) startTick()
            else clearInterval(tickRef.current)
          }} style={{ padding:'8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => { clearInterval(tickRef.current); setScreen('menu') }}
            style={{ padding:'8px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
            ✕ Quit
          </button>
        </div>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
          <div style={{ fontWeight:800, fontSize:28, color:'#fff', letterSpacing:'0.1em' }}>PAUSED</div>
          <button onClick={() => { pausedRef.current = false; setPaused(false); startTick() }}
            style={{ padding:'12px 32px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Resume
          </button>
        </div>
      )}
    </div>
  )
}
