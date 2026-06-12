import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { Field, Input, Btn } from './ui.jsx'

const THEMES = [
  { id: 'system', label: 'System', desc: 'Follows your device setting' },
  { id: 'light',  label: 'Light',  desc: 'Always light mode' },
  { id: 'dark',   label: 'Dark',   desc: 'Always dark mode' },
]

const ACCENT_COLORS = [
  { id: '#4f46e5', label: 'Indigo'  },
  { id: '#7c3aed', label: 'Violet'  },
  { id: '#0891b2', label: 'Cyan'    },
  { id: '#16a34a', label: 'Green'   },
  { id: '#dc2626', label: 'Red'     },
  { id: '#d97706', label: 'Amber'   },
  { id: '#db2777', label: 'Pink'    },
  { id: '#1e293b', label: 'Slate'   },
]

const AVATAR_COLORS = [
  '#4f46e5','#7c3aed','#0891b2','#16a34a','#dc2626','#d97706','#db2777','#0f172a',
]

function applyTheme(theme, accent) {
  const root = document.documentElement
  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark')
  if (theme === 'light') root.classList.add('theme-light')
  else if (theme === 'dark') root.classList.add('theme-dark')
  // Apply accent color
  if (accent) {
    root.style.setProperty('--accent', accent)
    // Generate accent-bg as 15% opacity
    root.style.setProperty('--accent-bg', accent + '22')
  }
}

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      setUser(session.user)
      loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id) }
      else { setUser(null); setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      applyTheme(data.theme || 'system', data.accent_color)
    }
  }

  return { profile, user, setProfile }
}

// ── Username setup screen (shown on first login) ─────────────
export function UsernameSetup({ user, onComplete }) {
  const defaultName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const [username, setUsername] = useState(defaultName)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!username.trim()) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: user.id, username: username.trim() })
    onComplete(username.trim())
    setSaving(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-3)', padding:20 }}>
      <div style={{ width:'100%', maxWidth:360, background:'var(--bg)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow-lg)', padding:'32px 28px', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>👋</div>
        <div style={{ fontWeight:700, fontSize:20, marginBottom:6 }}>Welcome!</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:24 }}>Choose a username to get started</div>
        <Field label="Username">
          <Input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Your name" onKeyDown={e => e.key==='Enter' && save()} />
        </Field>
        <Btn variant="primary" loading={saving} onClick={save} style={{ width:'100%', justifyContent:'center', padding:'11px', marginTop:8 }}>
          Get started
        </Btn>
      </div>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────
export function SettingsPage({ user, profile, onClose, onProfileUpdate }) {
  const [tab, setTab] = useState('profile') // 'profile' | 'appearance' | 'account'
  const [username, setUsername] = useState(profile?.username || '')
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#4f46e5')
  const [theme, setTheme] = useState(profile?.theme || 'system')
  const [accentColor, setAccentColor] = useState(profile?.accent_color || '#4f46e5')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  const saveProfile = async () => {
    setSaving(true)
    const updates = { id: user.id, username: username.trim(), avatar_color: avatarColor, theme, accent_color: accentColor, updated_at: new Date().toISOString() }
    await supabase.from('profiles').upsert(updates)
    applyTheme(theme, accentColor)
    onProfileUpdate({ ...profile, ...updates })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Live preview theme/accent as user changes them
  const handleThemeChange = (t) => { setTheme(t); applyTheme(t, accentColor) }
  const handleAccentChange = (a) => { setAccentColor(a); applyTheme(theme, a) }

  const changePassword = async () => {
    if (!newPassword.trim()) return
    setPwSaving(true); setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    setPwMsg(error ? error.message : 'Password updated!')
    if (!error) setNewPassword('')
  }

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  const initials = (username || user?.email || '?').slice(0,2).toUpperCase()

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 20px', height:52, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:14, fontWeight:500, fontFamily:'inherit', padding:0 }}>← Back</button>
        <span style={{ flex:1, textAlign:'center', fontWeight:600, fontSize:16 }}>Settings</span>
        <div style={{ width:60 }} />
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Sidebar tabs */}
        <div style={{ width:140, borderRight:'1px solid var(--border)', padding:'12px 0', flexShrink:0 }}>
          {[
            { id:'profile', icon:'ti-user', label:'Profile' },
            { id:'appearance', icon:'ti-palette', label:'Appearance' },
            { id:'account', icon:'ti-shield', label:'Account' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px',
              border:'none', background: tab===t.id ? 'var(--accent-bg)' : 'transparent',
              color: tab===t.id ? 'var(--accent)' : 'var(--text-2)',
              fontWeight: tab===t.id ? 600 : 400, fontSize:13, cursor:'pointer', fontFamily:'inherit',
              textAlign:'left',
            }}>
              <i className={`ti ${t.icon}`} style={{ fontSize:15 }} />
              {t.label}
            </button>
          ))}

          {/* Sign out at bottom */}
          <div style={{ position:'absolute', bottom:20, left:0, width:140, padding:'0 8px' }}>
            <button onClick={() => supabase.auth.signOut()} style={{
              display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 8px',
              border:'1px solid var(--danger)', borderRadius:'var(--radius)',
              background:'transparent', color:'var(--danger)',
              fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500,
            }}>
              <i className="ti ti-logout" style={{ fontSize:14 }} />
              Sign out
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 24px 40px' }}>

          {/* ── Profile tab ── */}
          {tab === 'profile' && (
            <div style={{ maxWidth:420 }}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:20 }}>Profile</div>

              {/* Avatar */}
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24 }}>
                <div style={{
                  width:64, height:64, borderRadius:'50%', background:avatarColor,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22, fontWeight:700, color:'#fff', flexShrink:0,
                }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} />
                    : initials
                  }
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:15 }}>{username || user?.email}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>{user?.email}</div>
                </div>
              </div>

              {/* Avatar color */}
              <Field label="Avatar color">
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingTop:4 }}>
                  {AVATAR_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setAvatarColor(c)} style={{
                      width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer', border:'none',
                      outline: avatarColor===c ? `3px solid ${c}` : 'none',
                      outlineOffset: avatarColor===c ? '2px' : '0',
                    }} />
                  ))}
                </div>
              </Field>

              <Field label="Username">
                <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
              </Field>

              <Btn variant="primary" loading={saving} onClick={saveProfile} style={{ marginTop:4 }}>
                {saved ? '✓ Saved' : 'Save changes'}
              </Btn>
            </div>
          )}

          {/* ── Appearance tab ── */}
          {tab === 'appearance' && (
            <div style={{ maxWidth:480 }}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:20 }}>Appearance</div>

              <Field label="Theme">
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => handleThemeChange(t.id)} style={{
                      display:'flex', alignItems:'center', gap:14, padding:'12px 14px',
                      border: `2px solid ${theme===t.id ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius:'var(--radius)', background: theme===t.id ? 'var(--accent-bg)' : 'var(--bg-2)',
                      cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                    }}>
                      <div style={{
                        width:36, height:36, borderRadius:8, flexShrink:0,
                        background: t.id==='dark' ? '#1a1a1a' : t.id==='light' ? '#ffffff' : 'linear-gradient(135deg, #fff 50%, #1a1a1a 50%)',
                        border:'1px solid var(--border)',
                      }} />
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{t.label}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{t.desc}</div>
                      </div>
                      {theme===t.id && <i className="ti ti-check" style={{ marginLeft:'auto', color:'var(--accent)', fontSize:16 }} />}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Accent colour">
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', paddingTop:4 }}>
                  {ACCENT_COLORS.map(c => (
                    <button key={c.id} type="button" onClick={() => handleAccentChange(c.id)}
                      title={c.label}
                      style={{
                        width:36, height:36, borderRadius:10, background:c.id, cursor:'pointer', border:'none',
                        outline: accentColor===c.id ? `3px solid ${c.id}` : 'none',
                        outlineOffset: accentColor===c.id ? '2px' : '0',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                      {accentColor===c.id && <i className="ti ti-check" style={{ color:'#fff', fontSize:14 }} />}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:6 }}>Changes apply instantly as a preview</div>
              </Field>

              <Btn variant="primary" loading={saving} onClick={saveProfile} style={{ marginTop:4 }}>
                {saved ? '✓ Saved' : 'Save appearance'}
              </Btn>
            </div>
          )}

          {/* ── Account tab ── */}
          {tab === 'account' && (
            <div style={{ maxWidth:420 }}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:20 }}>Account</div>

              <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Signed in as</div>
                <div style={{ fontSize:14, fontWeight:500 }}>{user?.email}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                  via {user?.app_metadata?.provider === 'google' ? 'Google' : 'Email'}
                </div>
              </div>

              {!isGoogleUser && (
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Change password</div>
                  <Field label="New password">
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" />
                  </Field>
                  {pwMsg && (
                    <div style={{ fontSize:12, color: pwMsg.includes('!') ? 'var(--success)' : 'var(--danger)', marginBottom:8 }}>{pwMsg}</div>
                  )}
                  <Btn loading={pwSaving} onClick={changePassword}>Update password</Btn>
                </div>
              )}

              <div style={{ borderTop:'1px solid var(--border)', paddingTop:20 }}>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:8 }}>Sign out</div>
                <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:12 }}>You'll need to sign back in to access your data.</div>
                <Btn variant="danger" onClick={() => supabase.auth.signOut()}>
                  <i className="ti ti-logout" style={{ fontSize:14 }} /> Sign out
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
