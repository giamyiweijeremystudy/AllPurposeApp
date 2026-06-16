import { useState, useEffect } from 'react'

const COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#a855f7','#ec4899',
]

function minMoves(n) { return Math.pow(2, n) - 1 }

export function Hanoi() {
  const [screen, setScreen]     = useState('menu')  // menu | game | win
  const [numRings, setNumRings] = useState(4)
  const [pegs, setPegs]         = useState([[], [], []])
  const [selected, setSelected] = useState(null)    // index of peg with picked ring
  const [moves, setMoves]       = useState(0)
  const [time, setTime]         = useState(0)
  const [running, setRunning]   = useState(false)

  // Timer
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTime(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const startGame = (n) => {
    const rings = Array.from({ length: n }, (_, i) => n - i) // biggest first
    setPegs([rings, [], []])
    setSelected(null)
    setMoves(0)
    setTime(0)
    setRunning(true)
    setScreen('game')
  }

  const handlePeg = (pegIdx) => {
    if (screen !== 'game') return

    if (selected === null) {
      // Pick up top ring from this peg
      if (pegs[pegIdx].length === 0) return
      setSelected(pegIdx)
    } else {
      if (selected === pegIdx) {
        // Tap same peg = deselect
        setSelected(null)
        return
      }
      // Try to place
      const ring = pegs[selected][pegs[selected].length - 1]
      const target = pegs[pegIdx]
      if (target.length > 0 && target[target.length - 1] < ring) {
        // Invalid move
        setSelected(null)
        return
      }
      // Valid move
      const next = pegs.map(p => [...p])
      next[selected].pop()
      next[pegIdx].push(ring)
      setPegs(next)
      setMoves(m => m + 1)
      setSelected(null)

      // Win condition: all rings on peg 2
      if (next[2].length === numRings) {
        setRunning(false)
        setScreen('win')
      }
    }
  }

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  // ── Layout constants ──────────────────────────────────────────
  const PEG_W    = 8
  const BASE_H   = 16
  const RING_H   = 24
  const MAX_W    = 120   // widest ring
  const MIN_W    = 28    // narrowest ring
  const PEG_H    = numRings * RING_H + 32
  const TOTAL_W  = MAX_W + 24
  const BOARD_W  = TOTAL_W * 3 + 16

  // Width of a ring by size (1 = smallest)
  const ringW = (size) => MIN_W + ((size - 1) / (numRings - 1 || 1)) * (MAX_W - MIN_W)

  // ── Menu ──────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28, background:'var(--bg)', userSelect:'none' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:800, fontSize:30, letterSpacing:'0.08em' }}>Tower of Hanoi</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:6 }}>Move all rings to the rightmost peg</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>You can only place a smaller ring on a larger one</div>
      </div>

      {/* Animated preview */}
      <div style={{ display:'flex', gap:24, alignItems:'flex-end', height:90 }}>
        {[[4,3,2,1],[],[]] .map((peg, pi) => (
          <div key={pi} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <div style={{ width:6, height:70, background:'var(--border-2)', borderRadius:3, marginBottom:4 }} />
            {[...peg].reverse().map((r, ri) => (
              <div key={ri} style={{
                width: 18 + r * 14, height:14, borderRadius:6,
                background: COLORS[(r - 1) % COLORS.length],
                marginTop: ri === 0 ? 0 : -16,
              }} />
            ))}
            <div style={{ width:80, height:8, background:'var(--border-2)', borderRadius:4 }} />
          </div>
        ))}
      </div>

      {/* Ring count selector */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Number of rings</div>
        <div style={{ display:'flex', gap:8 }}>
          {[3,4,5,6,7,8].map(n => (
            <button key={n} onClick={() => setNumRings(n)} style={{
              width:44, height:44, borderRadius:'var(--radius)',
              border: `2px solid ${numRings === n ? 'var(--accent)' : 'var(--border-2)'}`,
              background: numRings === n ? 'var(--accent-bg)' : 'var(--bg-2)',
              color: numRings === n ? 'var(--accent)' : 'var(--text)',
              fontWeight: numRings === n ? 700 : 400,
              fontSize:16, cursor:'pointer', fontFamily:'inherit',
            }}>{n}</button>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:8 }}>
          Minimum moves to solve: {minMoves(numRings).toLocaleString()}
        </div>
      </div>

      <button onClick={() => startGame(numRings)} style={{
        padding:'13px 48px', background:'var(--accent)', border:'none',
        borderRadius:'var(--radius-lg)', color:'#fff', fontSize:16,
        fontWeight:700, cursor:'pointer', fontFamily:'inherit',
      }}>Play</button>
    </div>
  )

  // ── Win screen ────────────────────────────────────────────────
  if (screen === 'win') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', userSelect:'none' }}>
      <div style={{ fontSize:40 }}>🎉</div>
      <div style={{ fontWeight:800, fontSize:26, color:'var(--success)' }}>Solved!</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
        {[
          { label:'Moves', value: moves },
          { label:'Optimal', value: minMoves(numRings) },
          { label:'Time', value: fmt(time) },
          { label:'Efficiency', value: `${Math.round((minMoves(numRings) / moves) * 100)}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ display:'flex', gap:16, alignItems:'center', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 20px', width:200 }}>
            <span style={{ fontSize:13, color:'var(--text-3)', flex:1 }}>{label}</span>
            <span style={{ fontWeight:700, fontSize:16 }}>{value}</span>
          </div>
        ))}
      </div>
      {moves === minMoves(numRings) && (
        <div style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>✨ Perfect solution!</div>
      )}
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => setScreen('menu')} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
        <button onClick={() => startGame(numRings)} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>
      </div>
    </div>
  )

  // ── Game ──────────────────────────────────────────────────────
  const pickedRing = selected !== null ? pegs[selected][pegs[selected].length - 1] : null

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, userSelect:'none', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', gap:20, alignItems:'center' }}>
        {[
          { label:'Moves', value: moves },
          { label:'Best', value: minMoves(numRings) },
          { label:'Time', value: fmt(time) },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign:'center', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'6px 14px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
            <div style={{ fontSize:16, fontWeight:800 }}>{value}</div>
          </div>
        ))}
        <button onClick={() => { setRunning(false); setScreen('menu') }} style={{ padding:'6px 12px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>✕ Quit</button>
      </div>

      {/* Instruction */}
      <div style={{ fontSize:12, color:'var(--text-3)', minHeight:16 }}>
        {selected !== null
          ? `Ring ${pickedRing} selected — tap a peg to place it`
          : 'Tap a peg to pick up its top ring'
        }
      </div>

      {/* Board */}
      <div style={{ display:'flex', gap:0, alignItems:'flex-end', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'20px 12px 0', overflow:'auto', maxWidth:'95vw' }}>
        {pegs.map((peg, pi) => {
          const isSelected = selected === pi
          const canPlace = selected !== null && selected !== pi && (
            peg.length === 0 || peg[peg.length - 1] > pickedRing
          )
          const hasRings = peg.length > 0

          return (
            <div key={pi} onClick={() => handlePeg(pi)}
              style={{
                width: TOTAL_W,
                display:'flex', flexDirection:'column', alignItems:'center',
                cursor: (hasRings && selected === null) || selected !== null ? 'pointer' : 'default',
                position:'relative',
                paddingBottom: 0,
              }}
            >
              {/* Picked ring hovering above */}
              {isSelected && pickedRing && (
                <div style={{
                  width: ringW(pickedRing),
                  height: RING_H - 4,
                  borderRadius: 8,
                  background: COLORS[(pickedRing - 1) % COLORS.length],
                  border: '3px solid white',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  marginBottom: 8,
                  opacity: 0.9,
                  animation: 'hanoiFloat 0.6s ease-in-out infinite alternate',
                }} />
              )}
              {!isSelected && <div style={{ height: RING_H + 8 }} />}

              {/* Drop zone highlight */}
              {canPlace && (
                <div style={{
                  position:'absolute', top: RING_H + 12, left:8, right:8, bottom:BASE_H,
                  border:'2px dashed var(--accent)', borderRadius:8, pointerEvents:'none',
                  opacity:0.5,
                }} />
              )}

              {/* Peg pole */}
              <div style={{
                width: PEG_W, height: PEG_H,
                background: isSelected ? 'var(--accent)' : canPlace ? 'var(--success)' : 'var(--border-2)',
                borderRadius: '4px 4px 0 0',
                transition: 'background 0.15s',
                zIndex:1,
              }} />

              {/* Rings stacked on peg (bottom to top in DOM, visually stacked) */}
              <div style={{ position:'absolute', bottom: BASE_H, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                {peg.map((size, ri) => (
                  <div key={ri} style={{
                    width: ringW(size),
                    height: RING_H - 4,
                    borderRadius: 8,
                    background: COLORS[(size - 1) % COLORS.length],
                    boxShadow: ri === peg.length - 1 && isSelected ? 'none' : '0 2px 6px rgba(0,0,0,0.15)',
                    opacity: ri === peg.length - 1 && isSelected ? 0.3 : 1,
                    transition: 'opacity 0.15s',
                    zIndex: ri + 2,
                  }} />
                ))}
              </div>

              {/* Base */}
              <div style={{
                width: TOTAL_W - 8, height: BASE_H,
                background: isSelected ? 'var(--accent)' : canPlace ? 'var(--success)' : 'var(--border-2)',
                borderRadius: '0 0 8px 8px',
                transition: 'background 0.15s',
              }} />

              {/* Peg label */}
              <div style={{ fontSize:11, color: isSelected ? 'var(--accent)' : 'var(--text-3)', fontWeight:600, marginTop:6, marginBottom:8 }}>
                {['A','B','C'][pi]}
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes hanoiFloat {
          from { transform: translateY(0); }
          to   { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
