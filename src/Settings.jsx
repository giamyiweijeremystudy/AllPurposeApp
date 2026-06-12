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

export function applyTheme(theme, accent) {
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')
  if (theme === 'light') root.classList.add('theme-light')
  else if (theme === 'dark') root.classList.add('theme-dark')
  if (accent) {
    root.style.setProperty('--accent', accent)
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

// ── Username setup (first login) ─────────────────────────────
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

// ── Delete account flow ───────────────────────────────────────
function DeleteAccountFlow({ user, onCancel }) {
  const [step, setStep] = useState(1) // 1=confirm, 2=type email
  const [emailInput, setEmailInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const emailPrefix = user?.email?.split('@')[0] || ''
  const matches = emailInput === emailPrefix

  const doDelete = async () => {
    if (!matches) return
    setDeleting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      const json = await res.json()
      if (json.error) { setError(json.error); setDeleting(false) }
      else await supabase.auth.signOut()
    } catch (e) {
      setError(e.message); setDeleting(false)
    }
  }

  if (step === 1) return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ fontSize:32, textAlign:'center', marginBottom:12 }}>⚠️</div>
        <div style={{ fontWeight:700, fontSize:17, marginBottom:8, textAlign:'center' }}>Delete account?</div>
        <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, marginBottom:20, textAlign:'center' }}>
          This will permanently delete your account and all your data — events, tasks, and settings. This cannot be undone.
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn onClick={onCancel} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
          <Btn variant="danger" onClick={() => setStep(2)} style={{ flex:1, justifyContent:'center' }}>
            Yes, continue
          </Btn>
        </div>
      </div>
    </div>
  )

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ fontWeight:700, fontSize:17, marginBottom:8 }}>Confirm deletion</div>
        <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:16, lineHeight:1.6 }}>
          Type <strong>{emailPrefix}</strong> to confirm you want to permanently delete your account.
        </div>

        {/* Input showing email prefix then @... auto appended */}
        <div style={{ position:'relative', marginBottom:16 }}>
          <input
            value={emailInput}
            onChange={e => {
              // Only allow up to the @ part
              const val = e.target.value.replace(/@.*/, '')
              if (val.length <= emailPrefix.length) setEmailInput(val)
            }}
            placeholder={emailPrefix}
            style={{
              width:'100%', padding:'10px 12px',
              border:`1.5px solid ${matches ? 'var(--danger)' : 'var(--border-2)'}`,
              borderRadius:'var(--radius)', background:'var(--bg-2)', color:'var(--text)',
              fontSize:15, outline:'none', fontFamily:'monospace', boxSizing:'border-box',
            }}
          />
          {/* Show the @domain part greyed out overlaid */}
          <div style={{
            position:'absolute', top:'50%', transform:'translateY(-50%)',
            left: `calc(12px + ${emailInput.length}ch)`,
            fontSize:15, color:'var(--text-3)', fontFamily:'monospace',
            pointerEvents:'none',
          }}>
            {emailPrefix.slice(emailInput.length)}<span style={{ color:'var(--border-2)' }}>@{user?.email?.split('@')[1]}</span>
          </div>
        </div>

        {error && <div style={{ fontSize:12, color:'var(--danger)', marginBottom:10 }}>{error}</div>}

        <div style={{ display:'flex', gap:10 }}>
          <Btn onClick={onCancel} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
          <Btn variant="danger" loading={deleting} onClick={doDelete}
            style={{ flex:1, justifyContent:'center', opacity: matches ? 1 : 0.4 }}>
            Delete forever
          </Btn>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
  display:'flex', alignItems:'center', justifyContent:'center',
  zIndex:3000, padding:20,
}
const dialogStyle = {
  background:'var(--bg)', borderRadius:'var(--radius-lg)',
  border:'1px solid var(--border)', padding:'24px',
  width:'100%', maxWidth:360, boxShadow:'var(--shadow-lg)',
}

// ── Edit Profile modal ────────────────────────────────────────
function EditProfileModal({ user, profile, onClose, onSave }) {
  const [username, setUsername] = useState(profile?.username || '')
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || '#4f46e5')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    const updates = { id: user.id, username: username.trim(), avatar_color: avatarColor, updated_at: new Date().toISOString() }
    await supabase.from('profiles').upsert(updates)
    onSave({ ...profile, ...updates })
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const initials = (username || user?.email || '?').slice(0,2).toUpperCase()

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...dialogStyle, maxWidth:400 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontWeight:600, fontSize:16 }}>Edit profile</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>

        {/* Avatar preview */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:avatarColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:700, color:'#fff' }}>
            {initials}
          </div>
        </div>

        <Field label="Username">
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
        </Field>

        <Field label="Avatar colour">
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

        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <Btn onClick={onClose} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={save} style={{ flex:1, justifyContent:'center' }}>
            {saved ? '✓ Saved' : 'Save'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────
export function SettingsPage({ user, profile, onClose, onProfileUpdate }) {
  const [tab, setTab] = useState('profile')
  const [theme, setTheme] = useState(profile?.theme || 'system')
  const [accentColor, setAccentColor] = useState(profile?.accent_color || '#4f46e5')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showDeleteFlow, setShowDeleteFlow] = useState(false)

  const saveAppearance = async () => {
    setSaving(true)
    const updates = { id: user.id, theme, accent_color: accentColor, updated_at: new Date().toISOString() }
    await supabase.from('profiles').upsert(updates)
    onProfileUpdate({ ...profile, ...updates })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleThemeChange = (t) => { setTheme(t); applyTheme(t, accentColor) }
  const handleAccentChange = (a) => { setAccentColor(a); applyTheme(theme, a) }

  const changePassword = async () => {
    if (!newPassword.trim()) return
    setPwSaving(true); setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    setPwMsg(error ? error.message : '✓ Password updated!')
    if (!error) setNewPassword('')
  }

  const isGoogleUser = user?.app_metadata?.provider === 'google'
  const initials = (profile?.username || user?.email || '?').slice(0,2).toUpperCase()

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'var(--bg)', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 20px', height:52, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:14, fontWeight:500, fontFamily:'inherit', padding:0 }}>← Back</button>
        <span style={{ flex:1, textAlign:'center', fontWeight:600, fontSize:16 }}>Settings</span>
        <div style={{ width:60 }} />
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Sidebar */}
        <div style={{ width:140, borderRight:'1px solid var(--border)', padding:'12px 0', flexShrink:0, display:'flex', flexDirection:'column' }}>
          {[
            { id:'profile', icon:'ti-user', label:'Profile' },
            { id:'appearance', icon:'ti-palette', label:'Appearance' },
            { id:'account', icon:'ti-shield', label:'Account' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 16px',
              border:'none', background: tab===t.id ? 'var(--accent-bg)' : 'transparent',
              color: tab===t.id ? 'var(--accent)' : 'var(--text-2)',
              fontWeight: tab===t.id ? 600 : 400, fontSize:13, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
            }}>
              <i className={`ti ${t.icon}`} style={{ fontSize:15 }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 24px 40px' }}>

          {/* ── Profile ── */}
          {tab === 'profile' && (
            <div style={{ maxWidth:420 }}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:20 }}>Profile</div>

              {/* Avatar + name card */}
              <div style={{ display:'flex', alignItems:'center', gap:16, padding:'16px', background:'var(--bg-2)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginBottom:20 }}>
                <div style={{
                  width:56, height:56, borderRadius:'50%', background: profile?.avatar_color || '#4f46e5',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, fontWeight:700, color:'#fff', flexShrink:0,
                }}>{initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {profile?.username || user?.email}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{user?.email}</div>
                </div>
                <Btn onClick={() => setShowEditProfile(true)} style={{ flexShrink:0 }}>
                  <i className="ti ti-pencil" style={{ fontSize:13 }} /> Edit
                </Btn>
              </div>

              <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
                Click <strong>Edit</strong> to change your display name and avatar colour.
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {tab === 'appearance' && (
            <div style={{ maxWidth:480 }}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:20 }}>Appearance</div>

              <Field label="Theme">
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => handleThemeChange(t.id)} style={{
                      display:'flex', alignItems:'center', gap:14, padding:'12px 14px',
                      border:`2px solid ${theme===t.id ? 'var(--accent)' : 'var(--border)'}`,
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
                    <button key={c.id} type="button" onClick={() => handleAccentChange(c.id)} title={c.label} style={{
                      width:36, height:36, borderRadius:10, background:c.id, cursor:'pointer', border:'none',
                      outline: accentColor===c.id ? `3px solid ${c.id}` : 'none',
                      outlineOffset: accentColor===c.id ? '2px' : '0',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {accentColor===c.id && <i className="ti ti-check" style={{ color:'#fff', fontSize:14 }} />}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:6 }}>Changes preview instantly — save to keep them</div>
              </Field>

              <Btn variant="primary" loading={saving} onClick={saveAppearance}>
                {saved ? '✓ Saved' : 'Save appearance'}
              </Btn>
            </div>
          )}

          {/* ── Account ── */}
          {tab === 'account' && (
            <div style={{ maxWidth:420 }}>
              <div style={{ fontWeight:600, fontSize:16, marginBottom:20 }}>Account</div>

              <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Signed in as</div>
                <div style={{ fontSize:14, fontWeight:500 }}>{user?.email}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>via {isGoogleUser ? 'Google' : 'Email'}</div>
              </div>

              {!isGoogleUser && (
                <div style={{ marginBottom:24, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Change password</div>
                  <Field label="New password">
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" />
                  </Field>
                  {pwMsg && <div style={{ fontSize:12, color: pwMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)', marginBottom:8 }}>{pwMsg}</div>}
                  <Btn loading={pwSaving} onClick={changePassword}>Update password</Btn>
                </div>
              )}

              {/* Sign out */}
              <div style={{ marginBottom:24, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:8 }}>Sign out</div>
                <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:12 }}>You'll need to sign back in to access your data.</div>
                <Btn variant="danger" onClick={() => supabase.auth.signOut()}>
                  <i className="ti ti-logout" style={{ fontSize:14 }} /> Sign out
                </Btn>
              </div>

              {/* Delete account */}
              <div>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Delete account</div>
                <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:12, lineHeight:1.5 }}>
                  Permanently deletes your account and all associated data. This cannot be undone.
                </div>
                <button onClick={() => setShowDeleteFlow(true)} style={{
                  padding:'9px 16px', borderRadius:'var(--radius)', fontSize:13,
                  background:'transparent', border:'1px solid var(--danger)', color:'var(--danger)',
                  cursor:'pointer', fontFamily:'inherit', fontWeight:500,
                }}>
                  Delete my account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit profile modal */}
      {showEditProfile && (
        <EditProfileModal
          user={user} profile={profile}
          onClose={() => setShowEditProfile(false)}
          onSave={p => { onProfileUpdate(p); setShowEditProfile(false) }}
        />
      )}

      {/* Delete account flow */}
      {showDeleteFlow && (
        <DeleteAccountFlow user={user} onCancel={() => setShowDeleteFlow(false)} />
      )}
    </div>
  )
}
