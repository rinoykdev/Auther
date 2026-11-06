import { describe, expect, it } from 'vitest'
import { GENERIC_CREDENTIALS, toUserMessage } from './errorMessages'

/**
 * These tests exist because this file is a SECURITY control, not a copy deck.
 * H.3 Family 3 requires that no mapped message distinguishes "no such
 * account" from "wrong password".
 */
describe('toUserMessage', () => {
  it('collapses every credential failure into one message', () => {
    const causes = [
      { code: 'invalid_credentials' },
      { code: 'user_not_found' },
      { code: 'invalid_grant' },
      { message: 'Invalid login credentials' },
    ]
    const rendered = new Set(causes.map(toUserMessage))

    // One distinct output. If this set ever grows, the form has become a
    // membership oracle.
    expect(rendered.size).toBe(1)
    expect([...rendered][0]).toBe(GENERIC_CREDENTIALS)
  })

  it('never leaks a raw backend message for an unknown error', () => {
    const message = toUserMessage({
      code: 'some_future_code',
      message: 'relation "public.secrets" does not exist',
    })
    expect(message).not.toMatch(/relation|public\.|does not exist/)
    expect(message).toBe('Something went wrong. Please try again.')
  })

  it('explains the cross-browser PKCE failure instead of saying "error"', () => {
    const message = toUserMessage({ message: 'invalid request: code verifier should be non-empty' })
    expect(message).toMatch(/different browser/i)
  })

  it('returns null for no error', () => {
    expect(toUserMessage(null)).toBeNull()
  })
})
