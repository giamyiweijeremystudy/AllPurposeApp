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
