/**
 * =============================================================================
 * Supabase connectivity health check
 * =============================================================================
 *
 * Answers one question — "is this app correctly wired to the right Supabase
 * Cloud project?" — and distinguishes the three ways the answer can be no.
 *
 * DESIGN RULE: this check creates nothing. No table, no view, no function, no
 * row, no bucket, no RPC. A schema object that exists only to be pinged is a
 * schema object that must then be secured, migrated, documented and reasoned
 * about in every future RLS review — a poor trade for a connectivity test.
 *
 * It therefore targets an endpoint the project exposes BEFORE any schema
 * exists, so it works on a brand-new project and keeps working once tables
 * arrive (Milestone 3 onward).
 *
 * WHY RAW fetch() RATHER THAN supabase-js: the client wraps transport failures
 * and HTTP error responses into similar-looking error objects, which destroys
 * exactly the distinction this check exists to make. A raw request lets us see
 * whether an HTTP response arrived at all. The client is separately exercised
 * below, so both the configuration and the library are covered.
 * =============================================================================
 */

import { supabase } from './supabaseClient'

/**
 * The three possible outcomes. They separate cleanly because they fail at
 * different layers: UNREACHABLE never reaches Supabase, KEY_REJECTED reaches it
 * and is refused at the gateway, CONNECTED reaches it and is answered.
 */
export const HealthState = {
  /** No HTTP response arrived. DNS failure, refused connection, timeout, CORS,
   *  offline, or a paused free-tier project. Usually VITE_SUPABASE_URL. */
  UNREACHABLE: 'UNREACHABLE',

  /** Supabase answered, and the answer was a refusal. Usually
   *  VITE_SUPABASE_PUBLISHABLE_KEY — wrong, truncated, or from another project. */
  KEY_REJECTED: 'KEY_REJECTED',

  /** Correctly configured and talking to the right project. */
  CONNECTED: 'CONNECTED',
}

/**
 * Remedies, kept beside the states so the UI never has to invent guidance.
 */
const REMEDY = {
  [HealthState.UNREACHABLE]:
    'Check VITE_SUPABASE_URL in .env.local against Supabase dashboard -> ' +
    'Project Settings -> API -> Project URL. Also check your internet ' +
    'connection, and whether a free-tier project has paused through ' +
    'inactivity (restore it from the dashboard). Restart the dev server after ' +
    'editing .env.local.',
  [HealthState.KEY_REJECTED]:
    'Check VITE_SUPABASE_PUBLISHABLE_KEY in .env.local against Supabase ' +
    'dashboard -> Project Settings -> API. Use the PUBLISHABLE (anon) key, ' +
    'never the secret / service-role key. Restart the dev server afterwards.',
  [HealthState.CONNECTED]: null,
}

/**
 * Run the connectivity check.
 *
 * @returns {Promise<{
 *   state: keyof typeof HealthState,
 *   summary: string,
 *   remedy: string | null,
 *   httpStatus: number | null,
 *   clientOk: boolean,
 *   observed: string,
 * }>}
 *
 * `observed` records what actually came back, so docs/setup.md can be written
 * from evidence rather than from expectations. The exact status code and body
 * for a rejected key are gateway implementation details that can differ by
 * endpoint and version — this field is how we find out rather than assume.
 */
export async function checkSupabaseConnectivity() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  // The Auth settings endpoint returns the project's public auth configuration.
  // Preferred over the REST root because it also confirms the Auth service
  // specifically — the service every flow in Milestones 4 and 5 depends on —
  // and its body independently reflects settings we configure in Step 5.
  const endpoint = `${url}/auth/v1/settings`

  let response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: { apikey: key },
    })
  } catch (networkError) {
    // No HTTP response arrived at all. This is the key distinction: a transport
    // failure has no status code, whereas a refusal does.
    return {
      state: HealthState.UNREACHABLE,
      summary: 'No response from Supabase. The request never reached a server.',
      remedy: REMEDY[HealthState.UNREACHABLE],
      httpStatus: null,
      clientOk: false,
      observed: `fetch threw: ${networkError?.name ?? 'Error'}: ${
        networkError?.message ?? String(networkError)
      }`,
    }
  }

  if (!response.ok) {
    // Supabase answered and refused. 401/403 is the expected shape for a bad
    // key, but we report the ACTUAL status rather than asserting one.
    let body = ''
    try {
      body = (await response.text()).slice(0, 200)
    } catch {
      body = '(body unreadable)'
    }

    return {
      state: HealthState.KEY_REJECTED,
      summary: `Supabase responded with HTTP ${response.status} — the project was reached, but the request was refused.`,
      remedy: REMEDY[HealthState.KEY_REJECTED],
      httpStatus: response.status,
      clientOk: false,
      observed: `HTTP ${response.status} ${response.statusText}; body: ${body}`,
    }
  }

  // Reached and answered. Now confirm the supabase-js client itself is usable.
  //
  // getSession() reads local storage and does not hit the network, so it proves
  // the client module constructed correctly — not that the server trusts us.
  // That distinction matters and is architecture C.9 rule 4: getSession() is a
  // local read and is never a security signal. It is used here as a smoke test
  // of the client only.
  let clientOk = false
  let clientNote = ''
  try {
    const { error } = await supabase.auth.getSession()
    clientOk = !error
    clientNote = error ? `getSession error: ${error.message}` : 'getSession ok (no session, as expected)'
  } catch (clientError) {
    clientNote = `getSession threw: ${clientError?.message ?? String(clientError)}`
  }

  return {
    state: HealthState.CONNECTED,
    summary: 'Connected to Supabase Cloud. Auth service reachable and key accepted.',
    remedy: null,
    httpStatus: response.status,
    clientOk,
    observed: `HTTP ${response.status} from /auth/v1/settings; ${clientNote}`,
  }
}
