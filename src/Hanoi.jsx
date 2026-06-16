import { useState, useEffect } from 'react'

const COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#a855f7','#ec4899',
]

function minMoves(n) { return Math.pow(2, n) - 1 }

export function Hanoi() {
  const [screen, setScreen]     = useState('menu')
  const [numRings, setNumRings] = useState(4)
  const [pegs, setPegs]         = useState([[], [], []])
  const [selected, setSelected] = useState(null)
  const [moves, setMoves]       = useState(0)
  const [time, setTime]         = useState(0)
  const [running, setRunning]   = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTime(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const startGame = (n) => {
    setPegs([Array.from({ length: n }, (_, i) => n - i), [], []])
    setSelected(null); setMoves(0); setTime(0); setRunning(true); setScreen('game')
  }

  const handlePeg = (pi) => {
    if (selected === null) {
      if (pegs[pi].length === 0) return
      setSelected(pi)
    } else {
      if (selected === pi) { setSelected(null); return }
      const ring = pegs[selected][pegs[selected].length - 1]
      const top  = pegs[pi][pegs[pi].length - 1]
      if (top !== undefined && top < ring) { setSelected(null); return } // invalid
      const next = pegs.map(p => [...p])
      next[selected].pop()
      next[pi].push(ring)
      setPegs(next); setMoves(m => m + 1); setSelected(null)
      if (next[2].length === numRings) { setRunning(false); setScreen('win') }
    }
  }

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  // ── Menu ──────────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28, background:'var(--bg)', userSelect:'none' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontWeight:800, fontSize:30 }}>Tower of Hanoi</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:6 }}>Move all rings to the rightmost peg</div>
        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>You can only place a smaller ring on a larger one</div>
      </div>

      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Number of rings</div>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          {[3,4,5,6,7,8].map(n => (
            <button key={n} onClick={() => setNumRings(n)} style={{
              width:44, height:44, borderRadius:'var(--radius)',
              border:`2px solid ${numRings===n ? 'var(--accent)' : 'var(--border-2)'}`,
              background: numRings===n ? 'var(--accent-bg)' : 'var(--bg-2)',
              color: numRings===n ? 'var(--accent)' : 'var(--text)',
              fontWeight: numRings===n ? 700 : 400,
              fontSize:16, cursor:'pointer', fontFamily:'inherit',
            }}>{n}</button>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:8 }}>
          Minimum moves: {minMoves(numRings).toLocaleString()}
        </div>
      </div>

      <button onClick={() => startGame(numRings)} style={{
        padding:'13px 48px', background:'var(--accent)', border:'none',
        borderRadius:'var(--radius-lg)', color:'#fff', fontSize:16,
        fontWeight:700, cursor:'pointer', fontFamily:'inherit',
      }}>Play</button>
    </div>
  )

  // ── Win ───────────────────────────────────────────────────────
  if (screen === 'win') return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)', userSelect:'none' }}>
      <div style={{ fontSize:40 }}>🎉</div>
      <div style={{ fontWeight:800, fontSize:26, color:'var(--success)' }}>Solved!</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
        {[
          { label:'Moves',      value: moves },
          { label:'Optimal',    value: minMoves(numRings) },
          { label:'Time',       value: fmt(time) },
          { label:'Efficiency', value: `${Math.round((minMoves(numRings)/moves)*100)}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ display:'flex', gap:16, alignItems:'center', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 20px', width:220 }}>
            <span style={{ fontSize:13, color:'var(--text-3)', flex:1 }}>{label}</span>
            <span style={{ fontWeight:700, fontSize:16 }}>{value}</span>
          </div>
        ))}
      </div>
      {moves === minMoves(numRings) && <div style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>✨ Perfect solution!</div>}
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={() => setScreen('menu')} style={{ padding:'10px 24px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Menu</button>
        <button onClick={() => startGame(numRings)} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Play again</button>
      </div>
    </div>
  )

  // ── Game ──────────────────────────────────────────────────────
  const pickedRing = selected !== null ? pegs[selected][pegs[selected].length - 1] : null

  // Layout — scale to fit screen
  const RING_H   = 22    // height of each ring
  const RING_GAP = 3     // gap between rings
  const BASE_H   = 18    // base platform height
  const PEG_W    = 10    // pole width
  const MIN_RW   = 30    // narrowest ring
  const MAX_RW   = 110   // widest ring
  const PEG_AREA_W = MAX_RW + 20  // width of each peg column
  const LIFT_H   = RING_H + 16    // how high selected ring floats above peg top
  const PEG_H    = numRings * (RING_H + RING_GAP) + 8  // pole height

  const ringW = (size) => MIN_RW + ((size - 1) / Math.max(numRings - 1, 1)) * (MAX_RW - MIN_RW)

  // Total board height = LIFT_H (for floating ring) + PEG_H + BASE_H
  const BOARD_H = LIFT_H + PEG_H + BASE_H
  const BOARD_W = PEG_AREA_W * 3

  return (
    <div style={{ position:'absolute', inset:0, background:'var(--bg-3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, userSelect:'none', overflow:'hidden', touchAction:'none' }}>

      {/* Header */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexShrink:0 }}>
        {[
          { label:'Moves', value: moves },
          { label:'Best',  value: minMoves(numRings) },
          { label:'Time',  value: fmt(time) },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign:'center', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'5px 12px' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
            <div style={{ fontSize:15, fontWeight:800 }}>{value}</div>
          </div>
        ))}
        <button onClick={() => { setRunning(false); setScreen('menu') }} style={{ padding:'5px 10px', border:'1px solid var(--border-2)', borderRadius:'var(--radius)', background:'transparent', color:'var(--text-2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>✕</button>
      </div>

      {/* Instruction */}
      <div style={{ fontSize:12, color:'var(--text-3)', height:16, flexShrink:0 }}>
        {selected !== null ? `Ring picked — tap a peg to place` : 'Tap a peg to pick up its top ring'}
      </div>

      {/* Board — fixed size, no scroll */}
      <div style={{ position:'relative', width:BOARD_W, height:BOARD_H, flexShrink:0 }}>
        {pegs.map((peg, pi) => {
          const isSelected = selected === pi
          const canPlace   = selected !== null && selected !== pi &&
            (peg.length === 0 || peg[peg.length-1] > pickedRing)
          const pegLeft    = pi * PEG_AREA_W  // left edge of this peg column
          const pegCenterX = pegLeft + PEG_AREA_W / 2

          return (
            <g key={pi}>
              {/* Click target for entire peg column */}
              <div onClick={() => handlePeg(pi)} style={{
                position:'absolute',
                left: pegLeft, top: 0, width: PEG_AREA_W, height: BOARD_H,
                cursor: 'pointer',
                zIndex: 10,
              }} />

              {/* Floating selected ring above this peg */}
              {isSelected && pickedRing !== null && (
                <div style={{
                  position:'absolute',
                  left: pegCenterX - ringW(pickedRing)/2,
                  top: 4,
                  width: ringW(pickedRing),
                  height: RING_H,
                  borderRadius: 8,
                  background: COLORS[(pickedRing-1) % COLORS.length],
                  border: '3px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                  zIndex: 20,
                  animation: 'hanoiFloat 0.7s ease-in-out infinite alternate',
                }} />
              )}

              {/* Pole */}
              <div style={{
                position:'absolute',
                left: pegCenterX - PEG_W/2,
                top: LIFT_H,
                width: PEG_W,
                height: PEG_H,
                background: isSelected ? 'var(--accent)' : canPlace ? '#22c55e' : 'var(--border-2)',
                borderRadius: '4px 4px 0 0',
                zIndex: 2,
                transition: 'background 0.15s',
              }} />

              {/* Rings on this peg — stacked from base upward */}
              {peg.map((size, ri) => {
                // ri=0 is bottom ring, sits just above base
                // top of ring ri = LIFT_H + PEG_H - (ri+1)*(RING_H+RING_GAP)
                const ringTop = LIFT_H + PEG_H - (ri + 1) * (RING_H + RING_GAP)
                const isTopRing = ri === peg.length - 1
                return (
                  <div key={ri} style={{
                    position:'absolute',
                    left: pegCenterX - ringW(size)/2,
                    top: ringTop,
                    width: ringW(size),
                    height: RING_H,
                    borderRadius: 8,
                    background: COLORS[(size-1) % COLORS.length],
                    opacity: isTopRing && isSelected ? 0.25 : 1,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    zIndex: ri + 3,
                    transition: 'opacity 0.15s',
                  }} />
                )
              })}

              {/* Base platform */}
              <div style={{
                position:'absolute',
                left: pegLeft + 4,
                top: LIFT_H + PEG_H,
                width: PEG_AREA_W - 8,
                height: BASE_H,
                background: isSelected ? 'var(--accent)' : canPlace ? '#22c55e' : 'var(--border-2)',
                borderRadius: 6,
                zIndex: 2,
                transition: 'background 0.15s',
              }} />

              {/* Peg label */}
              <div style={{
                position:'absolute',
                left: pegLeft, top: LIFT_H + PEG_H + BASE_H + 4,
                width: PEG_AREA_W, textAlign:'center',
                fontSize:12, fontWeight:700,
                color: isSelected ? 'var(--accent)' : 'var(--text-3)',
              }}>
                {['A','B','C'][pi]}
              </div>
            </g>
          )
        })}
      </div>

      <style>{`
        @keyframes hanoiFloat {
          from { transform: translateY(0px); }
          to   { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
