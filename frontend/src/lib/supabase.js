/**
 * lib/supabase.js
 * Supabase client — reads URL and key from Vite env vars
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://lisyiprowqxybfttenud.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3lpcHJvd3F4eWJmdHRlbnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzk3MzQsImV4cCI6MjA4NzcxNTczNH0.hwyd44Vjyi98x_F6aSCiUD-jn8IGLPo0TLLJvS5RAQ8'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase env vars — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use localStorage (not URL hash) to store sessions.
    // This prevents session tokens appearing in the URL after OAuth login,
    // which would allow anyone who receives the URL to hijack the session.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    storageKey: 'oxdemi-auth',
  }
})

/** Get current session JWT token for API calls */
export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}
