import { supabase } from './supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Requests notification permission and subscribes via the service worker's
// push manager, then stores the subscription server-side (RLS-protected,
// under the signed-in user). Returns 'granted' | 'denied' | 'unsupported'.
export async function enablePushNotifications(appId, userId) {
  if (!pushSupported()) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'needs-install' // iOS only allows push from an installed home-screen app

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    app_id: appId, user_id: userId, endpoint: json.endpoint,
    p256dh: json.keys.p256dh, auth: json.keys.auth,
  }, { onConflict: 'endpoint' })
  return 'granted'
}

export async function getPushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'not-enabled'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'enabled' : 'not-enabled'
}
