import { supabase } from './supabase.js'
import { useState, useEffect, useCallback } from 'react'

const WORD_LENGTH = 5
const MAX_GUESSES = 6

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
  'draft','drain','drama','drank','drawn','dream','dress','drink','drive','drove',
  'dwarf','eager','early','earth','eight','elite','empty','enemy','enjoy','enter',
  'entry','equal','error','essay','event','every','exact','exist','extra','fable',
  'faced','fact','faith','false','fancy','fatal','fault','feast','fence','fever',
  'fiber','field','fifth','fifty','fight','final','first','fixed','flame','flash',
  'fleet','flesh','float','flood','floor','flour','fluid','focus','force','forge',
  'forth','forum','found','frame','frank','fraud','fresh','front','frost','fruit',
  'fully','funny','giant','given','glass','globe','gloom','glory','glove','going',
  'grace','grade','grain','grand','grant','graph','grasp','grass','grave','great',
  'green','greet','grief','grind','groan','gross','group','grove','grown','guard',
  'guess','guest','guide','guild','guilt','guise','habit','handy','happy','harsh',
  'hasty','heart','heavy','hence','herbs','hinge','honor','horse','hotel','house',
  'human','humid','image','imply','inbox','index','indie','infer','inner','input',
  'inter','intro','issue','ivory','jewel','joint','joker','judge','juice','juicy',
  'jumbo','karma','keeps','kneel','knife','knock','known','label','later','laugh',
  'layer','learn','legal','level','light','limit','linen','liner','liver','local',
  'lofty','logic','loose','lover','lower','lucky','lunar','lying','magic','major',
  'maker','manor','maple','march','match','mayor','media','merit','metal','minor',
  'model','money','month','moral','motor','mount','mouth','moved','music','naive',
  'naval','needs','nerve','never','night','ninja','noble','noise','north','noted',
  'novel','nurse','nylon','ocean','offer','often','olive','omega','onset','orbit',
  'order','other','outer','owner','ozone','paint','panel','paper','party','peace',
  'pearl','phase','phone','photo','piano','piece','pilot','pitch','pixel','pizza',
  'place','plain','plane','plant','plate','plaza','plead','pluck','plumb','plume',
  'plump','plunge','point','polar','power','press','price','pride','prime','print',
  'prior','prize','probe','proof','prose','proud','prove','proxy','psalm','pulse',
  'punch','pupil','purse','queen','query','quest','queue','quick','quiet','quite',
  'quota','quote','radar','radio','raise','rally','range','rapid','ratio','reach',
  'react','ready','realm','rebel','refer','reign','relax','repay','reset','rider',
  'ridge','rifle','right','risky','rival','river','robot','rocky','rouge','rough',
  'round','route','royal','rugby','ruler','rural','saint','salad','sauce','scale',
  'scare','scene','scope','score','scout','screw','seize','sense','serve','seven',
  'shade','shake','shaky','shame','shape','share','sharp','sheer','sheet','shelf',
  'shell','shift','shine','shirt','shock','shoot','shore','short','shout','sight',
  'silly','since','sixth','sixty','skill','skull','skunk','slate','sleep','slice',
  'slide','slope','small','smart','smell','smile','smith','smoke','snake','solar',
  'solid','solve','sonic','sorry','south','space','spare','spark','speak','spell',
  'spend','spice','spill','spite','split','spoke','spoon','sport','spray','squad',
  'stack','staff','stage','stain','stake','stale','stand','start','state','stays',
  'steal','steam','steel','steep','steer','stern','stick','still','stomp','stone',
  'stool','store','story','stove','strap','straw','strip','stuck','study','stuff',
  'style','sugar','suite','sunny','super','surge','swamp','sweep','sweet','swift',
  'sword','sworn','table','taste','teach','tears','teeth','tempo','tense','tenth',
  'terms','thank','theme','there','thick','thing','think','third','those','three',
  'threw','throw','thumb','tiger','tight','timer','tired','title','toast','today',
  'token','tooth','total','touch','tough','towel','tower','toxic','track','trade',
  'trail','train','trait','tramp','trend','trial','tribe','trick','tried','troop',
  'trout','trove','truck','truly','trump','trunk','trust','truth','tulip','tumor',
  'tuner','tweak','twice','twist','tying','ultra','under','unify','union','unite',
  'until','upper','upset','urban','usage','using','usual','utter','vague','valid',
  'value','valve','video','vigor','viral','virus','visit','visor','vista','vital',
  'vivid','vocal','voice','voter','wagon','waste','watch','water','weary','weave',
  'weird','whale','where','which','while','white','whole','whose','wider','witch',
  'woman','world','worse','worst','worth','would','wrath','write','wrote','yacht',
  'yield','young','youth','zebra','zonal',
]

function getTodaysWord() {
  const start = new Date('2024-01-01')
  const today = new Date()
  const diff = Math.floor((today - start) / 86400000)
  return WORDS[diff % WORDS.length].toUpperCase()
}

function getRandomWord(exclude) {
  const pool = WORDS.filter(w => w.toUpperCase() !== exclude)
  return pool[Math.floor(Math.random() * pool.length)].toUpperCase()
}

const QWERTY = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

function getGuessStates(guess, target) {
  const result = Array(WORD_LENGTH).fill('absent')
  const targetLeft = target.split('')
  // Pass 1: greens
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct'
      targetLeft[i] = null // consumed
    }
  }
  // Pass 2: yellows — only for unmatched positions
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue
    const j = targetLeft.indexOf(guess[i])
    if (j !== -1) {
      result[i] = 'present'
      targetLeft[j] = null // consume so duplicates don't over-yellow
    }
  }
  return result
}

function getTileState(guess, target, pos) {
  return getGuessStates(guess, target)[pos]
}

function getLetterStates(guesses, target) {
  const states = {}
  for (const guess of guesses) {
    const tileStates = getGuessStates(guess, target)
    for (let i = 0; i < guess.length; i++) {
      const l = guess[i], s = tileStates[i]
      if (states[l] === 'correct') continue
      if (states[l] === 'present' && s !== 'correct') continue
      states[l] = s
    }
  }
  return states
}

const TILE = {
  correct: { bg:'#538d4e', text:'#fff', border:'#538d4e' },
  present: { bg:'#b59f3b', text:'#fff', border:'#b59f3b' },
  absent:  { bg:'#3a3a3c', text:'#fff', border:'#3a3a3c' },
  empty:   { bg:'transparent', text:'var(--text)', border:'var(--border-2)' },
  active:  { bg:'transparent', text:'var(--text)', border:'var(--text-2)' },
}
const KEY = {
  correct: { bg:'#538d4e', text:'#fff' },
  present: { bg:'#b59f3b', text:'#fff' },
  absent:  { bg:'#3a3a3c', text:'#888' },
  default: { bg:'var(--bg-3)', text:'var(--text)' },
}

// ── Main menu ────────────────────────────────────────────────
function MainMenu({ onSelectMode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24,
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {['W','O','R','D','L','E'].map((l, i) => (
            <div key={i} style={{
              width: 42, height: 42, borderRadius: 6,
              background: ['#538d4e','#b59f3b','#538d4e','#3a3a3c','#b59f3b','#538d4e'][i],
              color: '#fff', fontWeight: 800, fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              letterSpacing: 0,
            }}>{l}</div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Guess the 5-letter word in 6 tries</div>
      </div>

      {/* Mode buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
        <ModeCard
          icon="ti-calendar"
          title="Daily"
          sub="One puzzle per day · everyone plays the same word"
          color="#538d4e"
          onClick={() => onSelectMode('daily')}
        />
        <ModeCard
          icon="ti-infinity"
          title="Free Play"
          sub="Unlimited random words · practice anytime"
          color="#4f46e5"
          onClick={() => onSelectMode('free')}
        />
      </div>

      {/* How to play */}
      <div style={{ maxWidth: 320, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>How to play</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Guess the word in 6 tries. Each guess must be a valid 5-letter word.
          After each guess, the tiles change colour:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {[
            { color:'#538d4e', label:'Correct spot' },
            { color:'#b59f3b', label:'Wrong spot' },
            { color:'#3a3a3c', label:'Not in word' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 4, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModeCard({ icon, title, sub, color, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px', borderRadius: 'var(--radius-lg)',
        border: `2px solid ${hov ? color : 'var(--border)'}`,
        background: hov ? color + '15' : 'var(--bg-2)',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'border-color 0.15s, background 0.15s',
        width: '100%',
      }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
      </div>
      <i className="ti ti-chevron-right" style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 16 }} />
    </button>
  )
}

// ── Game board ───────────────────────────────────────────────
function GameBoard({ mode, onBack }) {
  const dailyWord = getTodaysWord()
  const todayStr = new Date().toISOString().split('T')[0]
  const [target, setTarget] = useState(() => mode === 'daily' ? dailyWord : getRandomWord(''))
  const [guesses, setGuesses] = useState([])
  const [current, setCurrent] = useState('')
  const [shake, setShake] = useState(false)
  const [reveal, setReveal] = useState(-1)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [won, setWon] = useState(false)
  const [loadingState, setLoadingState] = useState(mode === 'daily')

  // Load saved daily state on mount
  useEffect(() => {
    if (mode !== 'daily') return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setLoadingState(false); return }
      const { data } = await supabase
        .from('wordle_state')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', todayStr)
        .single()
      if (data) {
        setTarget(data.target)
        setGuesses(data.guesses || [])
        setDone(data.completed)
        setWon(data.won)
        if (data.completed) {
          const msgs = ['Genius!','Magnificent!','Impressive!','Splendid!','Great!','Phew!']
          if (data.won) setMessage(msgs[Math.min((data.guesses||[]).length-1, 5)])
          else setMessage(data.target)
        }
      }
      setLoadingState(false)
    })
  }, [])

  // Save state after each guess (daily only)
  const saveState = async (newGuesses, completed, wonGame, tgt) => {
    if (mode !== 'daily') return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('wordle_state').upsert({
      user_id: session.user.id,
      date: todayStr,
      target: tgt,
      guesses: newGuesses,
      completed,
      won: wonGame,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
  }

  const letterStates = getLetterStates(guesses, target)

  const showMsg = (msg, dur = 1800) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), dur)
  }

  const submitGuess = useCallback(() => {
    if (current.length < WORD_LENGTH) {
      setShake(true); setTimeout(() => setShake(false), 500)
      showMsg('Not enough letters'); return
    }
    if (!WORDS.includes(current.toLowerCase())) {
      setShake(true); setTimeout(() => setShake(false), 500)
      showMsg('Not in word list'); return
    }
    const newGuesses = [...guesses, current]
    setGuesses(newGuesses); setCurrent('')
    setReveal(newGuesses.length - 1)
    const isWin = current === target
    const isLoss = newGuesses.length >= MAX_GUESSES && !isWin
    const completed = isWin || isLoss
    if (completed) saveState(newGuesses, true, isWin, target)
    else saveState(newGuesses, false, false, target)
    setTimeout(() => {
      setReveal(-1)
      if (isWin) {
        setDone(true); setWon(true)
        showMsg(['Genius!','Magnificent!','Impressive!','Splendid!','Great!','Phew!'][Math.min(newGuesses.length-1,5)], 3000)
      } else if (isLoss) {
        setDone(true); showMsg(target, 5000)
      }
    }, WORD_LENGTH * 350 + 200)
  }, [current, guesses, target])

  const handleKey = useCallback((key) => {
    if (done) return
    if (key === 'ENTER') { submitGuess(); return }
    if (key === '⌫' || key === 'BACKSPACE') { setCurrent(c => c.slice(0,-1)); return }
    if (/^[A-Z]$/.test(key) && current.length < WORD_LENGTH) setCurrent(c => c + key)
  }, [done, current, submitGuess])

  useEffect(() => {
    const h = e => handleKey(e.key.toUpperCase())
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleKey])

  const playAgain = () => {
    if (mode === 'free') {
      setTarget(getRandomWord(target))
      setGuesses([]); setCurrent(''); setDone(false); setWon(false); setMessage('')
    }
  }

  if (loadingState) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <i className="ti ti-loader-2 spin" style={{ fontSize:24, color:'var(--text-3)' }} />
    </div>
  )

  const rows = Array.from({ length: MAX_GUESSES }, (_, ri) => {
    if (ri < guesses.length) return { word: guesses[ri], state: 'done' }
    if (ri === guesses.length && !done) return { word: current.padEnd(WORD_LENGTH,' '), state: 'active' }
    return { word: '     ', state: 'empty' }
  })

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflow: 'hidden',
      // On mobile: distribute space so nothing scrolls
      justifyContent: 'space-between',
      padding: '8px 8px 12px',
      maxWidth: 400, width: '100%', margin: '0 auto',
    }}>

      {/* Top row: back + title + mode badge */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit', padding:0, display:'flex', alignItems:'center', gap:4 }}>
          ← Menu
        </button>
        <span style={{ flex:1, textAlign:'center', fontWeight:800, fontSize:17, letterSpacing:'0.12em', textTransform:'uppercase' }}>Wordle</span>
        <span style={{
          fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999,
          background: mode==='daily' ? '#538d4e22' : 'var(--accent-bg)',
          color: mode==='daily' ? '#538d4e' : 'var(--accent)',
          textTransform:'uppercase', letterSpacing:'0.08em',
        }}>{mode === 'daily' ? '📅 Daily' : '∞ Free'}</span>
      </div>

      {/* Message */}
      <div style={{ height:28, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <div style={{
          background:'var(--text)', color:'var(--bg)', padding:'4px 14px',
          borderRadius:6, fontSize:12, fontWeight:600,
          opacity: message ? 1 : 0, transition:'opacity 0.2s',
        }}>{message || '·'}</div>
      </div>

      {/* Grid — flex-shrink:0, fixed size */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display:'flex', gap:4, animation: shake && ri===guesses.length ? 'wordleShake 0.5s' : 'none' }}>
            {Array.from({ length: WORD_LENGTH }, (_, ci) => {
              const letter = row.word[ci]?.trim() || ''
              const isRev = reveal === ri
              const delay = isRev ? ci*350 : 0
              let ts = 'empty'
              if (row.state==='done') ts = getTileState(row.word, target, ci)
              else if (row.state==='active' && letter) ts = 'active'
              const c = TILE[ts]
              return (
                <div key={ci} style={{
                  width:52, height:52,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  border:`2px solid ${c.border}`,
                  background: row.state==='done' && !isRev ? c.bg : c.bg,
                  color:c.text, fontSize:20, fontWeight:700, textTransform:'uppercase',
                  borderRadius:4,
                  transition: isRev ? `background 0.1s ${delay}ms, border-color 0.1s ${delay}ms` : 'none',
                }}>
                  <span style={{ animation: isRev ? `wordleFlip 0.7s ease ${delay}ms both` : 'none', display:'block' }}>
                    {letter}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Done overlay — sits between grid and keyboard */}
      <div style={{ height:36, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {done && (
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {won
              ? <span style={{ fontSize:13, color:'var(--success)', fontWeight:600 }}>🎉 {guesses.length}/6</span>
              : <span style={{ fontSize:13, color:'var(--danger)', fontWeight:600 }}>Answer: <strong>{target}</strong></span>
            }
            {mode==='free' && (
              <button onClick={playAgain} style={{ padding:'5px 14px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                New word
              </button>
            )}
          </div>
        )}
      </div>

      {/* Keyboard */}
      <div style={{ display:'flex', flexDirection:'column', gap:5, width:'100%', flexShrink:0 }}>
        {QWERTY.map((row, ri) => (
          <div key={ri} style={{ display:'flex', justifyContent:'center', gap:4 }}>
            {row.map(key => {
              const wide = key==='ENTER'||key==='⌫'
              const st = letterStates[key] ? KEY[letterStates[key]] : KEY.default
              return (
                <button key={key} onClick={() => handleKey(key)} style={{
                  width: wide ? 50 : 32, height:42,
                  background:st.bg, color:st.text,
                  border:'none', borderRadius:4,
                  fontSize: wide ? 10 : 13, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  flexShrink:0, transition:'background 0.15s',
                }}>{key}</button>
              )
            })}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes wordleShake {
          0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}
        }
        @keyframes wordleFlip {
          0%{transform:rotateX(0)}50%{transform:rotateX(-90deg)}100%{transform:rotateX(0)}
        }
      `}</style>
    </div>
  )
}

// ── Root export ──────────────────────────────────────────────
export function Wordle() {
  const [mode, setMode] = useState(null) // null = menu, 'daily' | 'free'

  return (
    <div style={{
      // Fill the content area completely, no scroll
      position:'absolute', inset:0,
      display:'flex', flexDirection:'column',
      background:'var(--bg)',
      overflow:'hidden',
    }}>
      {mode === null
        ? <MainMenu onSelectMode={setMode} />
        : <GameBoard mode={mode} onBack={() => setMode(null)} />
      }
    </div>
  )
}
