import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// persistSession: true = stays logged in across page reloads (localStorage)
// detectSessionInUrl: true = handles email confirmation links
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage,
  }
})

// Hook to get current user ID synchronously
export function getCurrentUserId() {
  // supabase.auth.getUser() is async, but session is cached synchronously
  return supabase.auth.session?.()?.user?.id || null
}
