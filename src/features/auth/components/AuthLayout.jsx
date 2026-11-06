import evCharging from '../../../assets/ev-charging.jpg'
import intellicarLogo from '../../../assets/intellicar-logo.png'

/**
 * =============================================================================
 * AuthLayout — the shared shell behind Login and Sign Up (VISUAL ONLY)
 * =============================================================================
 *
 * Architecture F requires Login and Sign Up to be a pair. This component is how
 * that is enforced structurally rather than by remembering: the branding panel,
 * the page background, the panel radius and the responsive split exist in one
 * place, so the two screens cannot drift apart as either is edited.
 *
 * It renders no form, holds no state and imports no service. Each screen passes
 * its own heading, subheading and body.
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

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:flex-row">
      {/* ---------------------------------------------------------------
          Left — branding. 52% on desktop, stacked above the panel on mobile.
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
          Right — the screen's own panel. 48% on desktop.
          --------------------------------------------------------------- */}
      <section className="flex flex-1 items-stretch p-4 lg:w-[48%] lg:py-8 lg:pr-8 lg:pl-0">
        <div className="flex w-full items-center justify-center rounded-[28px] bg-panel px-6 py-12 sm:px-10 lg:rounded-[32px]">
          <div className="w-full max-w-[540px]">
            <header className="text-center">
              <h2 className="text-[2rem] leading-tight font-extrabold tracking-[-0.02em] text-ink-900 lg:text-[2.5rem]">
                {title}
              </h2>
              <p className="mt-2 text-base text-ink-900/80 lg:text-lg">
                {subtitle}
              </p>
            </header>

            {children}
          </div>
        </div>
      </section>
    </div>
  )
}

export default AuthLayout
