import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * Shared test setup.
 *
 * Supabase environment variables are stubbed here so that importing
 * src/lib/supabaseClient.js in a test does not throw. The values are
 * deliberately fake: no test in this project talks to a real Supabase project,
 * because tests that depend on a shared cloud backend are slow, flaky, and
 * mutate state other developers can see (plan §5.3).
 */
vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key_not_real')

afterEach(() => {
  cleanup()
})
