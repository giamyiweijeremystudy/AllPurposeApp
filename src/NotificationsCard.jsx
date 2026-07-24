import { useState, useEffect } from 'react'
import { enablePushNotifications, getPushStatus, isStandalone, isIOS, pushSupported } from './pushNotifications.js'

// Prompts to install the app to the home screen (where supported) and to
// enable push notifications, showing a daily reminders digest. Dismisses
// itself once notifications are enabled, or if the platform can't support
// them at all, and remembers a manual dismissal per browser.
export function NotificationsCard({ appId, userId }) {
  const [status, setStatus] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('notif-card-dismissed') === '1')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPushStatus().then(setStatus)
    const onBeforeInstall = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => { localStorage.setItem('notif-card-dismissed', '1'); setDismissed(true) }

  const doInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const doEnable = async () => {
    setBusy(true)
    const result = await enablePushNotifications(appId, userId)
    setBusy(false)
    if (result === 'granted') setStatus('enabled')
    else if (result === 'denied') setStatus('denied')
    else if (result === 'needs-install') setStatus('needs-install')
  }

  if (dismissed || status === 'enabled' || status === 'unsupported' || !pushSupported()) return null
  const iosNeedsInstall = isIOS() && !isStandalone()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 12,
      padding: '11px 12px', background: 'var(--accent-soft)', marginBottom: 16,
    }}>
      <i className="ti ti-bell-ringing" style={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
          {iosNeedsInstall ? 'Add to Home Screen for reminders' : 'Get a daily reminders digest'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          {iosNeedsInstall
            ? 'Tap Share → Add to Home Screen, then open the app from there to enable notifications.'
            : status === 'denied'
              ? 'Notifications are blocked — enable them in your browser/device settings.'
              : "A daily notification for anything due today or overdue."}
        </div>
      </div>
      {!iosNeedsInstall && status !== 'denied' && (
        <>
          {installPrompt && (
            <button onClick={doInstall} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Install
            </button>
          )}
          <button onClick={doEnable} disabled={busy} style={{ border: 'none', borderRadius: 8, padding: '7px 11px', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Enabling…' : 'Enable'}
          </button>
        </>
      )}
      <button onClick={dismiss} title="Dismiss" style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 4 }}>
        <i className="ti ti-x" />
      </button>
    </div>
  )
}
