import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ── Constants ────────────────────────────────────────────────
const SIZE = 10
const SHIPS = [
  { name: 'Carrier',    len: 5 },
  { name: 'Battleship', len: 4 },
  { name: 'Cruiser',    len: 3 },
  { name: 'Submarine',  len: 3 },
  { name: 'Destroyer',  len: 2 },
]

// ── Helpers ──────────────────────────────────────────────────
const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null))

function placeShipOnGrid(grid, ship) {
  const g = grid.map(r => [...r])
  for (const [r, c] of ship.cells) g[r][c] = ship.name
  return g
}

function shipCells(row, col, len, horiz) {
  return Array.from({ length: len }, (_, i) =>
    horiz ? [row, col + i] : [row + i, col]
  )
}

function canPlace(grid, row, col, len, horiz) {
  const cells = shipCells(row, col, len, horiz)
  for (const [r, c] of cells) {
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
  return ships.every(s => s.sunk)
}

// ── AI ───────────────────────────────────────────────────────
function aiShot(shots, ships) {
  // Hunt mode: if there's a hit that isn't sunk, target adjacent
  const hits = shots.filter(([r, c]) => isHit(ships, r, c))
  const sunkCells = ships.filter(s => s.sunk).flatMap(s => s.cells)
  const unsunkHits = hits.filter(([r, c]) => !sunkCells.some(([sr, sc]) => sr === r && sc === c))

  const tried = new Set(shots.map(([r, c]) => `${r},${c}`))
  const candidates = []

  if (unsunkHits.length > 0) {
    for (const [hr, hc] of unsunkHits) {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = hr + dr, nc = hc + dc
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !tried.has(`${nr},${nc}`))
          candidates.push([nr, nc])
      }
    }
  }

  if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)]

  // Random shot on untried cells
  const all = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!tried.has(`${r},${c}`)) all.push([r, c])
  return all[Math.floor(Math.random() * all.length)]
}

// ── Lobby code generator ─────────────────────────────────────
function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase()
}

// ── Cell component ───────────────────────────────────────────
function Cell({ type, onClick, size }) {
  const colors = {
    empty:  'transparent',
    ship:   'var(--accent)',
    hit:    '#ef4444',
    miss:   '#64748b',
    sunk:   '#7f1d1d',
    hover:  'var(--accent-bg)',
    preview:'#818cf8',
    invalid:'#fca5a5',
  }
  return (
    <div onClick={onClick} style={{
      width: size, height: size,
      background: colors[type] || 'transparent',
      border: '1px solid var(--border)',
      borderRadius: 2,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.1s',
      boxShadow: type === 'hit' ? 'inset 0 0 4px rgba(0,0,0,0.3)' : 'none',
    }}/>
  )
}

// ── Grid component ───────────────────────────────────────────
function Grid({ ships, shots, onShot, previewCells, invalidPreview, showShips, cellSize, disabled }) {
  const [hover, setHover] = useState(null)

  const getType = (r, c) => {
    const shot = shots?.some(([sr, sc]) => sr === r && sc === c)
    if (shot) {
      if (isHit(ships, r, c)) {
        const ship = ships.find(s => s.cells.some(([sr, sc]) => sr === r && sc === c))
        return ship?.sunk ? 'sunk' : 'hit'
      }
      return 'miss'
    }
    if (previewCells) {
      const isPreview = previewCells.some(([pr, pc]) => pr === r && pc === c)
      if (isPreview) return invalidPreview ? 'invalid' : 'preview'
    }
    if (showShips && isHit(ships, r, c)) return 'ship'
    if (hover && hover[0] === r && hover[1] === c && !disabled) return 'hover'
    return 'empty'
  }

  return (
    <div style={{ display:'inline-block', border:'1px solid var(--border-2)', borderRadius:4, overflow:'hidden' }}>
      {/* Column labels */}
      <div style={{ display:'flex', paddingLeft: cellSize }}>
        {Array.from({ length: SIZE }, (_, i) => (
          <div key={i} style={{ width:cellSize, textAlign:'center', fontSize:9, color:'var(--text-3)', fontWeight:600 }}>
            {String.fromCharCode(65+i)}
          </div>
        ))}
      </div>
      {Array.from({ length: SIZE }, (_, r) => (
        <div key={r} style={{ display:'flex' }}>
          <div style={{ width:cellSize, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--text-3)', fontWeight:600 }}>{r+1}</div>
          {Array.from({ length: SIZE }, (_, c) => (
            <Cell
              key={c}
              size={cellSize}
              type={getType(r, c)}
              onClick={onShot && !disabled && !shots?.some(([sr,sc]) => sr===r && sc===c) ? () => onShot(r, c) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Ship placement UI ────────────────────────────────────────
function PlacementBoard({ onDone, cellSize }) {
  const [ships, setShips] = useState([])
  const [grid, setGrid] = useState(emptyGrid())
  const [idx, setIdx] = useState(0)
  const [horiz, setHoriz] = useState(true)
  const [hover, setHover] = useState(null)

  const current = SHIPS[idx]

  const preview = hover && current
    ? shipCells(hover[0], hover[1], current.len, horiz)
    : []
  const invalid = preview.length > 0 && !canPlace(grid, hover[0], hover[1], current.len, horiz)

  const handleClick = (r, c) => {
    if (!current) return
    if (!canPlace(grid, r, c, current.len, horiz)) return
    const cells = shipCells(r, c, current.len, horiz)
    const newShip = { name: current.name, len: current.len, cells, horiz, sunk: false }
    const newGrid = placeShipOnGrid(grid, newShip)
    const newShips = [...ships, newShip]
    setGrid(newGrid)
    setShips(newShips)
    setIdx(idx + 1)
    setHover(null)
  }

  const randomize = () => {
    const placed = randomPlacement()
    setShips(placed)
    setIdx(SHIPS.length)
    const g = emptyGrid()
    placed.forEach(s => s.cells.forEach(([r,c]) => { g[r][c] = s.name }))
    setGrid(g)
  }

  const reset = () => {
    setShips([]); setGrid(emptyGrid()); setIdx(0); setHover(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
      <div style={{ fontSize:13, fontWeight:600 }}>
        {idx < SHIPS.length ? `Place your ${current.name} (${current.len} cells)` : 'All ships placed!'}
      </div>

      {idx < SHIPS.length && (
        <button onClick={() => setHoriz(h => !h)} style={{ padding:'5px 14px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          {horiz ? '↔ Horizontal' : '↕ Vertical'} — tap to rotate
        </button>
      )}

      {/* Interactive grid */}
      <div
        style={{ display:'inline-block', border:'1px solid var(--border-2)', borderRadius:4, overflow:'hidden' }}
        onMouseLeave={() => setHover(null)}
      >
        <div style={{ display:'flex', paddingLeft: cellSize }}>
          {Array.from({ length: SIZE }, (_, i) => (
            <div key={i} style={{ width:cellSize, textAlign:'center', fontSize:9, color:'var(--text-3)', fontWeight:600 }}>
              {String.fromCharCode(65+i)}
            </div>
          ))}
        </div>
        {Array.from({ length: SIZE }, (_, r) => (
          <div key={r} style={{ display:'flex' }}>
            <div style={{ width:cellSize, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--text-3)', fontWeight:600 }}>{r+1}</div>
            {Array.from({ length: SIZE }, (_, c) => {
              const isPreview = preview.some(([pr,pc]) => pr===r && pc===c)
              const isShip = !!grid[r][c]
              const type = isShip ? 'ship' : isPreview ? (invalid ? 'invalid' : 'preview') : 'empty'
              return (
                <Cell key={c} size={cellSize} type={type}
                  onClick={idx < SHIPS.length ? () => handleClick(r, c) : undefined}
                />
              )
            }).map((cell, c) => (
              <div key={c} onMouseEnter={() => setHover([r, c])}>{cell}</div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={randomize} style={{ padding:'7px 16px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          🎲 Random
        </button>
        {idx > 0 && (
          <button onClick={reset} style={{ padding:'7px 16px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            ↺ Reset
          </button>
        )}
        {idx >= SHIPS.length && (
          <button onClick={() => onDone(ships)} style={{ padding:'7px 20px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Ready! →
          </button>
        )}
      </div>

      {/* Ship list */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
        {SHIPS.map((s, i) => (
          <div key={s.name} style={{
            fontSize:10, padding:'2px 8px', borderRadius:999,
            background: i < idx ? 'var(--accent)' : i === idx ? 'var(--accent-bg)' : 'var(--bg-2)',
            color: i < idx ? '#fff' : i === idx ? 'var(--accent)' : 'var(--text-3)',
            border: `1px solid ${i === idx ? 'var(--accent)' : 'var(--border)'}`,
            fontWeight: 600,
          }}>{s.name}</div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────
export function Battleship() {
  const [screen, setScreen] = useState('menu')
  const [mode, setMode] = useState(null) // 'ai' | 'online'
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  // AI game state
  const [phase, setPhase] = useState('placing') // placing | playing | over
  const [playerShips, setPlayerShips] = useState([])
  const [aiShips, setAiShips] = useState([])
  const [playerShots, setPlayerShots] = useState([]) // shots player fired at AI
  const [aiShots, setAiShots]     = useState([]) // shots AI fired at player
  const [turn, setTurn] = useState('player')
  const [winner, setWinner] = useState(null)
  const [lastMsg, setLastMsg] = useState('')

  // Online state
  const [lobby, setLobby] = useState(null)
  const [lobbies, setLobbies] = useState([])
  const [onlinePhase, setOnlinePhase] = useState('lobby') // lobby | placing | playing | over
  const [opponentReady, setOpponentReady] = useState(false)
  const [myShots, setMyShots] = useState([])
  const [oppShots, setOppShots] = useState([])
  const [myShips, setMyShips] = useState([])
  const [onlineTurn, setOnlineTurn] = useState(null)
  const [onlineWinner, setOnlineWinner] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const subRef = useRef(null)

  // Window size for responsiveness
  const [winSize, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const h = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const isMobile = winSize.w < 700
  // Cell size: fit two grids side by side on desktop, one per screen on mobile
  const cellSize = isMobile
    ? Math.floor((winSize.w - 48) / (SIZE + 1))
    : Math.floor(Math.min((winSize.w - 120) / (2 * (SIZE + 1)), (winSize.h - 200) / (SIZE + 1)))

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setProfile(data))
      }
    })
  }, [])

  const ns = { userSelect:'none', WebkitUserSelect:'none' }

  // ── AI game logic ───────────────────────────────────────────
  const startAI = () => {
    setAiShips(randomPlacement())
    setPlayerShots([]); setAiShots([])
    setTurn('player'); setWinner(null); setLastMsg('')
    setPhase('placing')
    setMode('ai'); setScreen('game')
  }

  const handlePlacementDone = (ships) => {
    setPlayerShips(ships)
    setPhase('playing')
  }

  const handlePlayerShot = useCallback((r, c) => {
    if (turn !== 'player' || winner) return
    if (playerShots.some(([sr,sc]) => sr===r && sc===c)) return

    const newShots = [...playerShots, [r,c]]
    const updatedAI = checkSunk(aiShips, newShots)
    setAiShips(updatedAI)
    setPlayerShots(newShots)

    const hit = isHit(aiShips, r, c)
    const shipHit = updatedAI.find(s => s.cells.some(([sr,sc]) => sr===r && sc===c))
    const msg = shipHit?.sunk ? `You sunk their ${shipHit.name}!` : hit ? 'Hit!' : 'Miss!'
    setLastMsg(msg)

    if (allSunk(updatedAI)) { setWinner('player'); setPhase('over'); return }
    setTurn('ai')

    // AI fires after short delay
    setTimeout(() => {
      setAiShots(prev => {
        const updatedPlayer = checkSunk(playerShips, prev)
        const shot = aiShot(prev, updatedPlayer.length ? updatedPlayer : playerShips)
        const newAiShots = [...prev, shot]
        const updatedP = checkSunk(playerShips, newAiShots)
        setPlayerShips(updatedP)
        const aiHit = isHit(playerShips, shot[0], shot[1])
        const aiShipHit = updatedP.find(s => s.cells.some(([sr,sc]) => sr===shot[0] && sc===shot[1]))
        setLastMsg(aiShipHit?.sunk ? `AI sunk your ${aiShipHit.name}!` : aiHit ? 'AI hit your ship!' : 'AI missed!')
        if (allSunk(updatedP)) { setWinner('ai'); setPhase('over') }
        else setTurn('player')
        return newAiShots
      })
    }, 700)
  }, [turn, winner, playerShots, aiShips, playerShips])

  // ── Online lobby ────────────────────────────────────────────
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
    // Create player row
    await supabase.from('battleship_players')
      .insert({ lobby_id: data.id, user_id: user.id, ships: [], shots: [], ready: false })
    setOnlinePhase('placing')
    subscribeToLobby(data.id)
  }

  const joinLobby = async (lobbyId, code) => {
    if (!user) return
    setJoinError('')
    const { data: lb } = await supabase.from('battleship_lobbies')
      .select('*').eq('id', lobbyId).single()
    if (!lb || lb.status !== 'waiting') { setJoinError('Lobby not available'); return }
    if (lb.host_id === user.id) { setJoinError("That's your own lobby!"); return }

    await supabase.from('battleship_lobbies')
      .update({ guest_id: user.id, status: 'placing' }).eq('id', lobbyId)
    await supabase.from('battleship_players')
      .insert({ lobby_id: lobbyId, user_id: user.id, ships: [], shots: [], ready: false })
    const updated = { ...lb, guest_id: user.id, status: 'placing' }
    setLobby(updated)
    setOnlinePhase('placing')
    subscribeToLobby(lobbyId)
  }

  const joinByCode = async () => {
    const { data } = await supabase.from('battleship_lobbies')
      .select('*').eq('code', joinCode.toUpperCase()).single()
    if (!data) { setJoinError('Lobby not found'); return }
    await joinLobby(data.id, data.code)
  }

  const subscribeToLobby = (lobbyId) => {
    if (subRef.current) subRef.current.unsubscribe()
    subRef.current = supabase.channel(`battleship:${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battleship_lobbies', filter: `id=eq.${lobbyId}` },
        payload => { setLobby(payload.new) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battleship_players', filter: `lobby_id=eq.${lobbyId}` },
        payload => { handlePlayerUpdate(payload.new) })
      .subscribe()
  }

  const handlePlayerUpdate = useCallback((row) => {
    if (!user) return
    if (row.user_id === user.id) return // own update
    // Opponent update
    setOpponentReady(row.ready)
    setOppShots(row.shots || [])
  }, [user])

  const submitShipsOnline = async (ships) => {
    if (!lobby || !user) return
    setMyShips(ships)
    await supabase.from('battleship_players')
      .update({ ships: ships, ready: true, updated_at: new Date().toISOString() })
      .eq('lobby_id', lobby.id).eq('user_id', user.id)
    setOnlinePhase('waiting_opponent')
  }

  useEffect(() => {
    if (onlinePhase === 'waiting_opponent' && opponentReady) {
      // Both ready — host goes first
      setOnlineTurn(lobby?.host_id)
      setOnlinePhase('playing')
    }
  }, [opponentReady, onlinePhase, lobby])

  const handleOnlineShot = async (r, c) => {
    if (onlineTurn !== user?.id || onlineWinner) return
    if (myShots.some(([sr,sc]) => sr===r && sc===c)) return

    const newShots = [...myShots, [r, c]]
    setMyShots(newShots)
    // Save my shots to my player row (opponent reads this as oppShots)
    await supabase.from('battleship_players')
      .update({ shots: newShots, updated_at: new Date().toISOString() })
      .eq('lobby_id', lobby.id).eq('user_id', user.id)

    // Check win
    const { data: oppRow } = await supabase.from('battleship_players')
      .select('ships').eq('lobby_id', lobby.id).neq('user_id', user.id).single()
    const oppShipsData = oppRow?.ships || []
    const updated = checkSunk(oppShipsData, newShots)
    if (allSunk(updated)) {
      setOnlineWinner(user.id)
      await supabase.from('battleship_lobbies').update({ status: 'finished' }).eq('id', lobby.id)
      setOnlinePhase('over')
      return
    }

    // Switch turn
    const nextTurn = lobby.host_id === user.id ? lobby.guest_id : lobby.host_id
    await supabase.from('battleship_lobbies')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', lobby.id)
    setOnlineTurn(nextTurn)
  }

  // Sync online turn from lobby changes
  useEffect(() => {
    if (!lobby || onlinePhase !== 'playing') return
    // turn is determined by who last shot — tracked locally via handlePlayerUpdate
  }, [lobby])

  useEffect(() => {
    // When opponent shoots, it's our turn
    if (onlinePhase === 'playing' && oppShots.length > myShots.length) {
      setOnlineTurn(user?.id)
    }
  }, [oppShots, myShots, onlinePhase, user])

  useEffect(() => {
    // Check if opponent sunk all our ships
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

  useEffect(() => () => { subRef.current?.unsubscribe() }, [])

  // ── Render helpers ──────────────────────────────────────────
  const StatusBar = ({ msg, color }) => (
    <div style={{ background: color || 'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 16px', fontSize:13, fontWeight:600, textAlign:'center', color:'var(--text)' }}>
      {msg}
    </div>
  )

  const ShipHealth = ({ ships, shots, label }) => {
    const checked = checkSunk(ships, shots)
    return (
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 10px' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
        {checked.map(s => (
          <div key={s.name} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:2, background: s.sunk ? '#ef4444' : '#22c55e', flexShrink:0 }}/>
            <span style={{ fontSize:11, color: s.sunk ? 'var(--text-3)' : 'var(--text)', textDecoration: s.sunk ? 'line-through' : 'none' }}>{s.name}</span>
            <span style={{ fontSize:10, color:'var(--text-3)', marginLeft:'auto' }}>{s.len}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Menu ─────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24, background:'var(--bg)', padding:24, ...ns }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🚢</div>
        <div style={{ fontWeight:800, fontSize:28, letterSpacing:'0.1em' }}>BATTLESHIP</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>Sink the enemy fleet</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:300 }}>
        <button onClick={startAI} style={{ padding:'14px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          🤖 vs Computer
        </button>
        <button onClick={() => { setMode('online'); setScreen('game'); setOnlinePhase('lobby') }} style={{ padding:'14px', background:'var(--bg-2)', border:'2px solid var(--border-2)', borderRadius:'var(--radius-lg)', color:'var(--text)', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          🌐 Play Online
        </button>
      </div>
    </div>
  )

  // ── Online lobby browser ────────────────────────────────────
  if (mode === 'online' && onlinePhase === 'lobby') return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', padding:16, ...ns }}>
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={() => { setScreen('menu'); setMode(null) }} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>← Back</button>
          <span style={{ fontWeight:800, fontSize:18 }}>Online Lobbies</span>
          <button onClick={loadLobbies} style={{ marginLeft:'auto', background:'none', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', padding:'4px 10px', color:'var(--text-2)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>↻ Refresh</button>
        </div>

        {/* Create lobby */}
        <button onClick={createLobby} style={{ width:'100%', padding:'12px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-lg)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:16 }}>
          + Create Lobby
        </button>

        {/* Join by code */}
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          <input
            value={joinCode} onChange={e => setJoinCode(e.target.value)}
            placeholder="Enter lobby code…"
            style={{ flex:1, padding:'9px 12px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'var(--bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none' }}
          />
          <button onClick={joinByCode} style={{ padding:'9px 16px', background:'var(--bg-2)', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            Join
          </button>
        </div>
        {joinError && <div style={{ color:'var(--danger)', fontSize:12, marginBottom:12 }}>{joinError}</div>}

        {/* Lobby list */}
        <div style={{ fontWeight:700, fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Open Lobbies</div>
        {lobbies.length === 0
          ? <div style={{ textAlign:'center', color:'var(--text-3)', fontSize:13, padding:24 }}>No open lobbies — create one!</div>
          : lobbies.map(lb => (
            <div key={lb.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{lb.host?.username || 'Unknown'}'s game</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>Code: {lb.code}</div>
              </div>
              <button onClick={() => joinLobby(lb.id, lb.code)} style={{ padding:'7px 16px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                Join
              </button>
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
      {lobby && <div style={{ fontSize:13, color:'var(--text-3)' }}>Lobby code: <strong style={{ color:'var(--accent)', letterSpacing:'0.1em' }}>{lobby.code}</strong></div>}
      <div style={{ fontSize:12, color:'var(--text-3)' }}>Share the code with your opponent</div>
    </div>
  )

  // ── Placement phase ──────────────────────────────────────────
  if ((mode === 'ai' && phase === 'placing') || (mode === 'online' && onlinePhase === 'placing')) return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:16, gap:12, ...ns }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:500 }}>
        <button onClick={() => { setScreen('menu'); setMode(null); setPhase('placing') }} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>← Menu</button>
        <span style={{ fontWeight:800, fontSize:16 }}>Place Your Ships</span>
      </div>
      {mode === 'online' && lobby && (
        <div style={{ fontSize:12, color:'var(--text-3)' }}>Lobby code: <strong style={{ color:'var(--accent)' }}>{lobby.code}</strong></div>
      )}
      <PlacementBoard
        cellSize={cellSize}
        onDone={mode === 'ai' ? handlePlacementDone : submitShipsOnline}
      />
    </div>
  )

  // ── Game over ─────────────────────────────────────────────────
  if ((mode === 'ai' && phase === 'over') || (mode === 'online' && onlinePhase === 'over')) {
    const won = mode === 'ai' ? winner === 'player' : onlineWinner === user?.id
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', ...ns }}>
        <div style={{ fontSize:48 }}>{won ? '🏆' : '💀'}</div>
        <div style={{ fontWeight:800, fontSize:28, color: won ? '#22c55e' : 'var(--danger)' }}>
          {won ? 'Victory!' : 'Defeated!'}
        </div>
        <div style={{ fontSize:14, color:'var(--text-3)' }}>
          {won ? 'You sunk the enemy fleet!' : 'Your fleet was destroyed!'}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={() => { setScreen('menu'); setMode(null); setPhase('placing'); setOnlinePhase('lobby'); subRef.current?.unsubscribe() }}
            style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            Menu
          </button>
          {mode === 'ai' && (
            <button onClick={startAI} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Play again
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── AI playing ───────────────────────────────────────────────
  if (mode === 'ai' && phase === 'playing') {
    const updatedAI     = checkSunk(aiShips, playerShots)
    const updatedPlayer = checkSunk(playerShips, aiShots)

    const statusMsg = turn === 'player' ? '🎯 Your turn — click the enemy grid' : '⏳ AI is thinking…'

    if (isMobile) return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'10px 8px', ...ns }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%' }}>
          <button onClick={() => { setScreen('menu'); setMode(null); setPhase('placing') }} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>← Menu</button>
          <span style={{ fontWeight:700, fontSize:14, flex:1, textAlign:'center' }}>Battleship</span>
        </div>
        <StatusBar msg={lastMsg || statusMsg}/>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Enemy Waters</div>
        <Grid ships={updatedAI} shots={playerShots} onShot={handlePlayerShot} showShips={false} cellSize={cellSize} disabled={turn !== 'player'}/>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Fleet</div>
        <Grid ships={updatedPlayer} shots={aiShots} showShips={true} cellSize={cellSize}/>
      </div>
    )

    return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', gap:16, padding:16, ...ns }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Enemy Waters</div>
          <Grid ships={updatedAI} shots={playerShots} onShot={handlePlayerShot} showShips={false} cellSize={cellSize} disabled={turn !== 'player'}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:120 }}>
          <button onClick={() => { setScreen('menu'); setMode(null); setPhase('placing') }} style={{ padding:'6px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>← Menu</button>
          <StatusBar msg={lastMsg || statusMsg}/>
          <ShipHealth ships={updatedAI} shots={playerShots} label="ENEMY FLEET"/>
          <ShipHealth ships={updatedPlayer} shots={aiShots} label="YOUR FLEET"/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Fleet</div>
          <Grid ships={updatedPlayer} shots={aiShots} showShips={true} cellSize={cellSize}/>
        </div>
      </div>
    )
  }

  // ── Online playing ───────────────────────────────────────────
  if (mode === 'online' && onlinePhase === 'playing') {
    const isMyTurn = onlineTurn === user?.id
    const myShipsChecked  = checkSunk(myShips, oppShots)
    const oppShipsDisplay = checkSunk(
      SHIPS.map(s => ({ ...s, cells: [], sunk: false })), // placeholder — we don't see their real ships
      myShots
    )
    const statusMsg = isMyTurn ? '🎯 Your turn — fire!' : "⏳ Opponent's turn…"

    if (isMobile) return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg)', overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'10px 8px', ...ns }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%' }}>
          <button onClick={() => { setScreen('menu'); setMode(null); setOnlinePhase('lobby'); subRef.current?.unsubscribe() }} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>← Menu</button>
          <span style={{ fontWeight:700, fontSize:14, flex:1, textAlign:'center' }}>Battleship</span>
        </div>
        <StatusBar msg={statusMsg}/>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Enemy Waters</div>
        <Grid ships={[]} shots={myShots} onShot={handleOnlineShot} showShips={false} cellSize={cellSize} disabled={!isMyTurn}/>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Fleet</div>
        <Grid ships={myShipsChecked} shots={oppShots} showShips={true} cellSize={cellSize}/>
      </div>
    )

    return (
      <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', gap:16, padding:16, ...ns }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Enemy Waters</div>
          <Grid ships={[]} shots={myShots} onShot={handleOnlineShot} showShips={false} cellSize={cellSize} disabled={!isMyTurn}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:120 }}>
          <button onClick={() => { setScreen('menu'); setMode(null); setOnlinePhase('lobby'); subRef.current?.unsubscribe() }} style={{ padding:'6px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>← Menu</button>
          <StatusBar msg={statusMsg}/>
          <ShipHealth ships={myShipsChecked} shots={oppShots} label="YOUR FLEET"/>
          {lobby && <div style={{ fontSize:10, color:'var(--text-3)', textAlign:'center' }}>Code: <strong>{lobby.code}</strong></div>}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Your Fleet</div>
          <Grid ships={myShipsChecked} shots={oppShots} showShips={true} cellSize={cellSize}/>
        </div>
      </div>
    )
  }

  return null
}
