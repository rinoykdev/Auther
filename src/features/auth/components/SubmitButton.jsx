/**
 * Primary action button with a busy state.
 *
 * Disabled while submitting, which is the double-submit guard in architecture
 * H.4: a second click during an in-flight sign-up creates a second request,
 * and on a slow connection that is the normal thing for a user to do.
 */
function SubmitButton({ busy, busyLabel, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      className="w-full rounded-full bg-ink-900 py-4 text-base font-bold text-white transition-colors hover:bg-ink-900/90 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (busyLabel ?? 'Working…') : children}
    </button>
  )
}

export default SubmitButton
