
import { createClient } from '@supabase/supabase-js'

/* ============================================================
   XYPHORA PRIME MANAGEMENT SYSTEM
   SUPABASE CLIENT CONFIGURATION
============================================================ */

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/* ============================================================
   ENVIRONMENT VALIDATION
============================================================ */

if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is not configured'
  )
}

if (!supabaseKey) {
  throw new Error(
    'VITE_SUPABASE_PUBLISHABLE_KEY is not configured'
  )
}

/* ============================================================
   SUPABASE CLIENT
============================================================ */

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      // Preserve login across page refreshes and
      // browser reopening, subject to the session
      // expiration rules in AuthContext.tsx.
      persistSession: true,

      // Keep valid Supabase access tokens refreshed.
      // This does not reset our 4-hour login limit.
      autoRefreshToken: true,

      // Allow Supabase to process auth redirects,
      // including password recovery and OAuth.
      detectSessionInUrl: true,

      // Store the session in browser localStorage.
      // AuthContext.tsx separately tracks inactivity
      // and maximum session duration.
      storage: window.localStorage,

      // Use PKCE for supported authentication flows.
      flowType: 'pkce',

      // Distinct storage key for this application.
      storageKey: 'xyphora-prime-management-auth',
    },
  }
)
