import evCharging from '../../../assets/ev-charging.jpg'
import intellicarLogo from '../../../assets/intellicar-logo.png'

/**
 * =============================================================================
 * Login — VISUAL ONLY
 * =============================================================================
 *
 * Presentational implementation of the approved login design, built ahead of
 * Milestone 4 as an explicitly scoped visual task.
 *
 * THERE IS NO AUTHENTICATION HERE, deliberately:
 *   - the form does not submit;
 *   - the inputs hold no state and are not validated;
 *   - the Login button does nothing;
 *   - "Continue with Google" is not wired to OAuth;
 *   - "Forgot password" does not navigate or send anything;
 *   - nothing imports supabaseClient.
 *
 * Real behaviour arrives in Milestone 4 (registration, verification, login)
 * and Milestone 5 (password recovery). Social sign-in is deferred entirely
 * (architecture 0.2) — the Google button is rendered because it is in the
 * approved design, not because the capability exists.
 *
 * The form carries onSubmit={(e) => e.preventDefault()} so that pressing Enter
 * in a field cannot trigger a native page navigation. That is layout hygiene,
 * not authentication logic.
 * =============================================================================
 */

const FEATURES = [
  {
    label: 'Live tracking',
    icon: (
      <>
        <circle cx="12" cy="12" r="3.25" />
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 1.75v2.75M12 19.5v2.75M22.25 12H19.5M4.5 12H1.75" />
      </>
    ),
  },
  {
    label: 'Smart charging',
    icon: (
      <>
        <path d="M6 3v6.5a3 3 0 0 0 3 3h.5" />
        <path d="M18 3v6.5a3 3 0 0 1-3 3h-.5" />
        <path d="M9.5 12.5V21M14.5 12.5V21" />
        <path d="M12 6.5 10.25 9.5h3.5L12 12.5" />
      </>
    ),
  },
  {
    label: 'Battery health',
    icon: (
      <>
        <rect x="2.5" y="7.5" width="15" height="9" rx="2.5" />
        <path d="M20.5 11v2" />
        <path d="M10.5 9.75 8.75 12.5h2.5L9.5 15.25" />
      </>
    ),
  },
]

function FeatureBadge({ label, icon }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full bg-white/[0.07] py-2.5 pr-5 pl-2.5 text-sm font-medium text-white/90 ring-1 ring-white/[0.08] backdrop-blur-sm">
      <span className="flex size-7 items-center justify-center rounded-full bg-white/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 text-white"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      {label}
    </span>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.26a12 12 0 0 0 0 10.77l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.1C6.22 6.88 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:flex-row">
      {/* ---------------------------------------------------------------
          Left — branding. 52% on desktop, stacked above the form on mobile.
          --------------------------------------------------------------- */}
      <section className="relative flex shrink-0 flex-col overflow-hidden px-6 pt-10 pb-0 lg:w-[52%] lg:px-10 lg:pt-12">
        {/*
          Both source images are JPEGs with a baked-in near-black background,
          which renders as a faintly visible rectangle against the page.
          `mix-blend-mode: screen` solves this properly rather than by nudging
          colours until the seam is hard to see: screen leaves the backdrop
          unchanged wherever the source is black, so the black simply drops out
          and the artwork composites onto the page. No alpha channel needed and
          no dependence on the two blacks matching exactly.
        */}
        <img
          src={intellicarLogo}
          alt="Intellicar — driven by data"
          className="h-14 w-auto self-center mix-blend-screen lg:h-[72px]"
        />

        <div className="flex flex-1 flex-col items-center justify-center py-10 lg:py-0">
          <h1 className="max-w-[18ch] text-center text-[1.75rem] leading-[1.3] font-normal tracking-[-0.01em] text-white sm:max-w-[20ch] sm:text-4xl lg:max-w-[700px] lg:text-[2.75rem] lg:leading-[1.25]">
            Power, monitor &amp; optimize your EV fleet at scale
          </h1>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-12 lg:flex-nowrap">
            {FEATURES.map((f) => (
              <FeatureBadge key={f.label} {...f} />
            ))}
          </div>
        </div>

        {/* Hero. The image's own background measures #020307 against the page's
            #000308, so it seats into the page with no visible seam. */}
        <div className="mt-auto -mx-6 lg:-mx-10">
          <img
            src={evCharging}
            alt=""
            aria-hidden="true"
            className="h-[34vh] w-full object-cover object-center mix-blend-screen select-none lg:h-[46vh] [mask-image:linear-gradient(to_bottom,transparent_0%,black_28%,black_88%,transparent_100%)] lg:[mask-image:linear-gradient(to_bottom,transparent_0%,black_30%)]"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Right — login panel. 48% on desktop.
          --------------------------------------------------------------- */}
      <section className="flex flex-1 items-stretch p-4 lg:w-[48%] lg:py-8 lg:pr-8 lg:pl-0">
        <div className="flex w-full items-center justify-center rounded-[28px] bg-panel px-6 py-12 sm:px-10 lg:rounded-[32px]">
          <div className="w-full max-w-[540px]">
            <header className="text-center">
              <h2 className="text-[2rem] leading-tight font-extrabold tracking-[-0.02em] text-ink-900 lg:text-[2.5rem]">
                Welcome back
              </h2>
              <p className="mt-2 text-base text-ink-900/80 lg:text-lg">
                Login to your Intellicar account
              </p>
            </header>

            <form
              className="mt-12 lg:mt-24"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="space-y-5 lg:space-y-7">
                <div>
                  <label htmlFor="email" className="sr-only">
                    Login with email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Login with email"
                    className="w-full rounded-full border border-slate-300 bg-transparent px-6 py-4 text-[0.95rem] text-ink-900 placeholder:text-ink-900/70 focus:border-ink-900 focus:ring-0 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    className="w-full rounded-full border border-slate-300 bg-transparent px-6 py-4 text-[0.95rem] text-ink-900 placeholder:text-ink-900/70 focus:border-ink-900 focus:ring-0 focus:outline-none"
                  />
                  <div className="mt-2 pl-1.5">
                    {/*
                      Intentionally a button, not a link: password recovery is
                      Milestone 5 and there is no destination yet. An <a href="#">
                      would be a broken promise in the markup.
                    */}
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Forgot password
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="mt-9 w-full rounded-full bg-ink-900 py-4 text-base font-bold text-white transition-colors hover:bg-ink-900/90 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none lg:mt-14"
              >
                Login
              </button>
            </form>

            <p className="mt-8 text-center text-[0.95rem] text-ink-900/80 lg:mt-10">
              Or sign in with
            </p>

            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-transparent py-4 text-base font-semibold text-ink-900 transition-colors hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LoginPage
