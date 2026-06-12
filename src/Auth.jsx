import { useState } from 'react'
import { supabase } from './supabase.js'
import { Field, Input, Btn } from './ui.jsx'

export function AuthScreen() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handle = async () => {
    if (!email.trim() || (!password.trim() && mode !== 'forgot')) return
    setLoading(true); setError(''); setInfo('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
        // session persistence is controlled by Supabase client config below
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
        else setInfo('Check your email to confirm your account, then sign in.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) setError(error.message)
        else setInfo('Password reset email sent. Check your inbox.')
      }
    } finally { setLoading(false) }
  }

  const signInWithGoogle = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const title = mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-3)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
        padding: '32px 28px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 24,
          }}>
            <i className="ti ti-layout-dashboard" style={{ color: '#fff' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>My App</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{title}</div>
        </div>

        {/* Error / info */}
        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
            {error}
          </div>
        )}
        {info && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--success)', marginBottom: 16 }}>
            {info}
          </div>
        )}

        {/* Google button — only on login/signup */}
        {mode !== 'forgot' && (
          <>
            <button onClick={signInWithGoogle} disabled={loading} style={{
              width: '100%', padding: '11px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--bg-2)', border: '1.5px solid var(--border-2)',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 500, color: 'var(--text)',
              marginBottom: 16, transition: 'border-color 0.15s, background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#4285f4'; e.currentTarget.style.background = 'var(--bg-3)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.background = 'var(--bg-2)' }}
            >
              {/* Google SVG logo */}
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
              <span style={{ fontSize:12, color:'var(--text-3)', whiteSpace:'nowrap' }}>or continue with email</span>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>
          </>
        )}

        {/* Form */}
        <Field label="Email">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </Field>

        {mode !== 'forgot' && (
          <Field label="Password">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handle()} />
          </Field>
        )}

        {mode === 'login' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            {/* Keep me signed in toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div onClick={() => setKeepSignedIn(v => !v)} style={{
                width: 36, height: 20, borderRadius: 10,
                background: keepSignedIn ? 'var(--accent)' : 'var(--bg-3)',
                border: '1.5px solid ' + (keepSignedIn ? 'var(--accent)' : 'var(--border-2)'),
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: keepSignedIn ? 17 : 2,
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Keep me signed in</span>
            </label>
            <button onClick={() => { setMode('forgot'); setError(''); setInfo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              Forgot password?
            </button>
          </div>
        )}

        <Btn variant="primary" loading={loading} onClick={handle}
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }}>
          {title}
        </Btn>

        {/* Switch modes */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-3)' }}>
          {mode === 'login' && <>
            Don't have an account?{' '}
            <button onClick={() => { setMode('signup'); setError(''); setInfo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              Sign up
            </button>
          </>}
          {mode === 'signup' && <>
            Already have an account?{' '}
            <button onClick={() => { setMode('login'); setError(''); setInfo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              Sign in
            </button>
          </>}
          {mode === 'forgot' && (
            <button onClick={() => { setMode('login'); setError(''); setInfo('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
