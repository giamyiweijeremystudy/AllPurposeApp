import { useState, useEffect, useCallback } from 'react'

const WORD_LENGTH = 5
const MAX_GUESSES = 6

// 200 common 5-letter words
const WORDS = [
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alike','align','alive','alley',
  'allow','alone','along','alter','angel','anger','angle','angry','anime','ankle',
  'annex','apart','apple','apply','arena','argue','arise','armor','array','arrow',
  'asset','atlas','attic','audio','audit','avoid','awake','award','aware','awful',
  'badly','baker','basic','basis','batch','beach','beard','beast','began','begin',
  'being','below','bench','bible','birth','black','blade','blame','bland','blank',
  'blaze','bleed','blend','bless','blind','block','blood','bloom','blown','blues',
  'blunt','board','bonus','boost','bound','boxer','brain','brand','brave','bread',
  'break','breed','brick','bride','brief','bring','broad','broke','brook','brown',
  'brush','build','built','burst','buyer','cabin','cable','camel','candy','cargo',
  'carry','catch','cause','cease','chain','chair','chaos','charm','chart','chase',
  'cheap','check','cheek','chess','chest','chief','child','china','choir','chunk',
  'civic','civil','claim','clash','class','clean','clear','clerk','click','cliff',
  'climb','cling','clock','clone','close','cloth','cloud','coach','coast','color',
  'comic','comes','coral','could','count','court','cover','craft','crane','crash',
  'crazy','cream','creek','crime','crisp','cross','crowd','crown','crush','crust',
  'dance','daily','dairy','death','debut','decay','defer','delta','dense','depot',
  'depth','derby','devil','diary','digit','dirty','disco','ditch','diver','doing',
]

function getTodaysWord() {
  const start = new Date('2024-01-01')
  const today = new Date()
  const diff = Math.floor((today - start) / 86400000)
  return WORDS[diff % WORDS.length].toUpperCase()
}

const QWERTY = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

function getTileState(guess, target, pos) {
  if (guess[pos] === target[pos]) return 'correct'
  if (target.includes(guess[pos])) return 'present'
  return 'absent'
}

function getLetterStates(guesses, target) {
  const states = {}
  for (const guess of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const l = guess[i]
      const s = getTileState(guess, target, i)
      // correct > present > absent
      if (states[l] === 'correct') continue
      if (states[l] === 'present' && s !== 'correct') continue
      states[l] = s
    }
  }
  return states
}

const TILE_COLORS = {
  correct: { bg:'#538d4e', text:'#fff', border:'#538d4e' },
  present: { bg:'#b59f3b', text:'#fff', border:'#b59f3b' },
  absent:  { bg:'#3a3a3c', text:'#fff', border:'#3a3a3c' },
  empty:   { bg:'transparent', text:'var(--text)', border:'var(--border-2)' },
  active:  { bg:'transparent', text:'var(--text)', border:'var(--text-2)' },
}

const KEY_COLORS = {
  correct: { bg:'#538d4e', text:'#fff' },
  present: { bg:'#b59f3b', text:'#fff' },
  absent:  { bg:'#3a3a3c', text:'#6b6b67' },
  default: { bg:'var(--bg-3)', text:'var(--text)' },
}

export function Wordle() {
  const target = getTodaysWord()
  const [guesses, setGuesses] = useState([])
  const [current, setCurrent] = useState('')
  const [shake, setShake] = useState(false)
  const [reveal, setReveal] = useState(-1) // which row is revealing
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [won, setWon] = useState(false)

  const letterStates = getLetterStates(guesses, target)

  const showMessage = (msg, duration = 1800) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), duration)
  }

  const submitGuess = useCallback(() => {
    if (current.length < WORD_LENGTH) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      showMessage('Not enough letters')
      return
    }
    if (!WORDS.includes(current.toLowerCase()) && !WORDS.includes(current.toUpperCase())) {
      // Accept any 5-letter word attempt for playability
    }
    const newGuesses = [...guesses, current]
    setGuesses(newGuesses)
    setCurrent('')
    setReveal(newGuesses.length - 1)

    const isWin = current === target
    const isLoss = newGuesses.length >= MAX_GUESSES && !isWin

    setTimeout(() => {
      setReveal(-1)
      if (isWin) {
        setDone(true); setWon(true)
        const msgs = ['Genius!','Magnificent!','Impressive!','Splendid!','Great!','Phew!']
        showMessage(msgs[Math.min(newGuesses.length - 1, 5)], 3000)
      } else if (isLoss) {
        setDone(true)
        showMessage(target, 4000)
      }
    }, WORD_LENGTH * 350 + 200)
  }, [current, guesses, target])

  const handleKey = useCallback((key) => {
    if (done) return
    if (key === 'ENTER') { submitGuess(); return }
    if (key === '⌫' || key === 'BACKSPACE') { setCurrent(c => c.slice(0, -1)); return }
    if (/^[A-Z]$/.test(key) && current.length < WORD_LENGTH) {
      setCurrent(c => c + key)
    }
  }, [done, current, submitGuess])

  useEffect(() => {
    const handler = (e) => handleKey(e.key.toUpperCase())
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKey])

  const reset = () => {
    setGuesses([]); setCurrent(''); setDone(false); setWon(false); setMessage('')
  }

  // Build the 6-row grid
  const rows = Array.from({ length: MAX_GUESSES }, (_, ri) => {
    if (ri < guesses.length) return { word: guesses[ri], state: 'done' }
    if (ri === guesses.length && !done) return { word: current.padEnd(WORD_LENGTH, ' '), state: 'active' }
    return { word: '     ', state: 'empty' }
  })

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Wordle</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Daily puzzle · {new Date().toLocaleDateString([], { month:'long', day:'numeric', year:'numeric' })}</div>
      </div>

      {/* Message toast */}
      <div style={{
        height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.2s', opacity: message ? 1 : 0,
      }}>
        <div style={{
          background: 'var(--text)', color: 'var(--bg)',
          padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
        }}>{message || '.'}</div>
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{
            display: 'flex', gap: 5,
            animation: shake && ri === guesses.length ? 'wordleShake 0.5s ease' : 'none',
          }}>
            {Array.from({ length: WORD_LENGTH }, (_, ci) => {
              const letter = row.word[ci]?.trim() || ''
              const isRevealing = reveal === ri
              const delay = isRevealing ? ci * 350 : 0

              let tileState = 'empty'
              if (row.state === 'done') tileState = getTileState(row.word, target, ci)
              else if (row.state === 'active' && letter) tileState = 'active'

              const c = TILE_COLORS[tileState]

              return (
                <div key={ci} style={{
                  width: 56, height: 56,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${c.border}`,
                  background: row.state === 'done' ? 'transparent' : c.bg,
                  color: c.text,
                  fontSize: 22, fontWeight: 700, textTransform: 'uppercase',
                  borderRadius: 4,
                  transition: `background ${isRevealing ? '0.1s' : '0s'} ${delay}ms, border-color ${isRevealing ? '0.1s' : '0s'} ${delay}ms`,
                  ...(row.state === 'done' && {
                    background: isRevealing
                      ? 'transparent'
                      : c.bg,
                    animationDelay: `${delay}ms`,
                  }),
                }}>
                  {/* For revealed rows, animate flip */}
                  {row.state === 'done' ? (
                    <span style={{
                      display: 'block',
                      animation: isRevealing ? `wordleFlip 0.7s ease ${delay}ms both` : 'none',
                    }}>{letter}</span>
                  ) : letter}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Done state */}
      {done && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {won
            ? <div style={{ fontSize: 14, color: 'var(--success)', fontWeight: 600 }}>Solved in {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}!</div>
            : <div style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 600 }}>Better luck tomorrow! The word was <strong>{target}</strong></div>
          }
          <button onClick={reset} style={{
            padding: '8px 24px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius)', color: '#fff', fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>Play again (new word)</button>
        </div>
      )}

      {/* Keyboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {QWERTY.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
            {row.map(key => {
              const isWide = key === 'ENTER' || key === '⌫'
              const st = letterStates[key] ? KEY_COLORS[letterStates[key]] : KEY_COLORS.default
              return (
                <button key={key} onClick={() => handleKey(key)} style={{
                  width: isWide ? 52 : 36, height: 46,
                  background: st.bg, color: st.text,
                  border: 'none', borderRadius: 4,
                  fontSize: isWide ? 11 : 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.2s',
                }}>{key}</button>
              )
            })}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes wordleShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes wordleFlip {
          0% { transform: rotateX(0); }
          50% { transform: rotateX(-90deg); }
          100% { transform: rotateX(0); }
        }
      `}</style>
    </div>
  )
}
