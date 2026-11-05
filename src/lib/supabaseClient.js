/**
 * =============================================================================
 * Supabase client — the single source
 * =============================================================================
 *
 * This is the ONLY place in the application where a Supabase client is created.
 * One client, one configuration, one place to audit (architecture B.3).
 *
 * Nothing outside `features/auth/services/` should import this directly once
 * those services exist. Pages never talk to Supabase; they talk to services,
 * which talk to this client. That boundary is what lets us change provider or
 * library version by editing a handful of files instead of the whole app.
 *
 * Backend is Supabase Cloud. There is no local Supabase stack and Docker is not
 * a dependency of this project (architecture A.5).
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'

/* -----------------------------------------------------------------------------
 * Environment
 * -----------------------------------------------------------------------------
 * Vite bundles every VITE_-prefixed variable into the public JavaScript that
 * ships to the browser. That is correct and expected for these two values:
 *
 *   - the project URL is public;
 *   - the publishable key is designed to be shipped in frontend code.
 *
 * The publishable key is safe in the browser ONLY because database permissions
 * (GRANTs) and RLS policies refuse to serve data they should not. It is not a
 * security boundary by itself (architecture E.5).
 *
 * The Supabase SECRET / service-role key must never appear here, in any VITE_
 * variable, or anywhere in frontend code. It bypasses RLS entirely.
 * -------------------------------------------------------------------------- */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Fail fast, and fail clearly.
 *
 * Without this, a missing or misspelled variable surfaces later as an opaque
 * network or 401 error several screens into the app — which is a genuinely
 * expensive way to lose an afternoon. A loud error naming the exact variable
 * and the exact file to fix is worth the eight lines.
 *
 * Note this validates presence and shape only. Whether the values are CORRECT
 * is a question only the server can answer; that is what the connectivity
 * health check in Step 4 is for.
 */
function assertEnvironment() {
  const missing = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabasePublishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')

  if (missing.length > 0) {
    throw new Error(
      `[supabaseClient] Missing required environment variable(s): ${missing.join(
        ', ',
      )}.\n\n` +
        'Fix:\n' +
        '  1. cp .env.example .env.local\n' +
        '  2. Fill in the values from your Supabase Cloud DEVELOPMENT project\n' +
        '     (Supabase dashboard -> Project Settings -> API)\n' +
        '  3. Restart the dev server (Vite only reads env files at startup)\n\n' +
        'Never put the secret / service-role key in a VITE_ variable.',
    )
  }

  // Catch the most common copy-paste mistake: pasting the dashboard page URL
  // (https://supabase.com/dashboard/project/...) instead of the project API URL.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(supabaseUrl)) {
    throw new Error(
      `[supabaseClient] VITE_SUPABASE_URL does not look like a Supabase project URL.\n\n` +
        `  Received: ${supabaseUrl}\n` +
        `  Expected: https://<project-ref>.supabase.co\n\n` +
        'Find it under Project Settings -> API -> Project URL. It is NOT the ' +
        'supabase.com/dashboard address shown in your browser.',
    )
  }
}

assertEnvironment()

/* -----------------------------------------------------------------------------
 * Client
 * -----------------------------------------------------------------------------
 * Every auth option below is set EXPLICITLY, even where it matches the library
 * default. These four options determine how sessions are established, stored
 * and refreshed, and the exact session-state transitions in architecture C.9
 * depend on them. A silent default change in a future supabase-js version would
 * break the email-callback and password-recovery flows without breaking a test,
 * which is precisely the kind of failure that is expensive to diagnose.
 * -------------------------------------------------------------------------- */

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    /**
     * PKCE (Proof Key for Code Exchange).
     *
     * Email links return an authorization `code` in the query string, which is
     * exchanged for a session using a code verifier stored in THIS browser.
     * More secure than the implicit flow, which puts tokens in the URL fragment.
     *
     * Known and accepted trade-off (architecture C.2): because the verifier is
     * browser-local, a confirmation link opened in a DIFFERENT browser than the
     * one used to sign up cannot complete the exchange. Milestone 4 handles that
     * as a clear, recoverable error with a resend action — not as a bug.
     */
    flowType: 'pkce',

    /**
     * Let supabase-js detect an auth code in the URL on load and exchange it
     * automatically. This is what makes the /auth/callback and /reset-password
     * routes work. Milestone 4 may additionally call exchangeCodeForSession
     * explicitly for clearer error handling.
     */
    detectSessionInUrl: true,

    /**
     * Persist the session in browser storage so a page refresh does not log the
     * user out. The accepted consequence is that XSS is the primary threat to
     * session integrity; mitigations are in architecture E.2.
     */
    persistSession: true,

    /**
     * Refresh the short-lived access token in the background before it expires.
     *
     * IMPORTANT (architecture C.9 rule 3): a refresh produces a new token but
     * does NOT re-prove the user's identity. `iat` and `exp` advance; the
     * authentication time does not. Any future "has this user authenticated
     * recently?" check must read the authentication-time claim, never `iat`,
     * and never `amr` — which records the method, not the moment.
     */
    autoRefreshToken: true,
  },
})
