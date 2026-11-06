/**
 * Shown while the session is being restored (architecture F screen 12).
 *
 * Exists so guards never have to choose between "flash the login page" and
 * "render a blank screen" during the moment before the session is known.
 */
function FullPageSpinner({ label = 'Loading' }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-ink-950"
      role="status"
    >
      <span className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default FullPageSpinner
