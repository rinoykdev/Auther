import { afterEach, describe, expect, it, vi } from 'vitest'
import { HealthState, checkSupabaseConnectivity } from './healthCheck'

/**
 * Unit tests for connectivity classification.
 *
 * The point of this check is telling the three failure modes APART, so each
 * test asserts the specific state rather than merely "it failed". A check that
 * collapsed "wrong URL" and "wrong key" into one error would pass a looser
 * test and be useless at 11pm.
 */
describe('checkSupabaseConnectivity', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports UNREACHABLE when no HTTP response arrives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const result = await checkSupabaseConnectivity()

    expect(result.state).toBe(HealthState.UNREACHABLE)
    // No response means no status code. This is the distinguishing property.
    expect(result.httpStatus).toBeNull()
    expect(result.remedy).toMatch(/VITE_SUPABASE_URL/)
    expect(result.observed).toMatch(/Failed to fetch/)
  })

  it('reports KEY_REJECTED when Supabase answers with a refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '{"message":"Invalid API key"}',
      }),
    )

    const result = await checkSupabaseConnectivity()

    expect(result.state).toBe(HealthState.KEY_REJECTED)
    // A response DID arrive — that is what separates this from UNREACHABLE.
    expect(result.httpStatus).toBe(401)
    expect(result.remedy).toMatch(/PUBLISHABLE/)
  })

  it('reports CONNECTED on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '{}',
      }),
    )

    const result = await checkSupabaseConnectivity()

    expect(result.state).toBe(HealthState.CONNECTED)
    expect(result.httpStatus).toBe(200)
    expect(result.remedy).toBeNull()
  })

  it('queries an endpoint that requires no database schema', async () => {
    // Regression guard for a design rule: the health check must never depend on
    // a table, view or function existing. Pointing it at a schema object would
    // create something to secure, migrate and reason about in every later RLS
    // review, and would break on a brand-new project.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{}',
    })
    vi.stubGlobal('fetch', fetchMock)

    await checkSupabaseConnectivity()

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('/auth/v1/settings')
    expect(url).not.toContain('/rest/v1/')
  })
})
