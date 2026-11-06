import { useState } from 'react'
import Alert from './Alert'
import GoogleMark from './GoogleMark'

/**
 * The Google button from the approved design.
 *
 * Social sign-in is DEFERRED (architecture 0.2), so there is nothing behind
 * it. Rather than render a control that silently does nothing — which reads as
 * a bug — it says so when pressed. Removing it would diverge from the approved
 * design; leaving it mute would be a broken promise in the UI.
 */
function SocialButton({ verb = 'sign in' }) {
  const [notice, setNotice] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setNotice(true)}
        className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-transparent py-4 text-base font-semibold text-ink-900 transition-colors hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        <GoogleMark />
        Continue with Google
      </button>

      {notice && (
        <div className="mt-4">
          <Alert tone="info">
            Google sign-in is not enabled yet. Please {verb} with your email
            address for now.
          </Alert>
        </div>
      )}
    </>
  )
}

export default SocialButton
