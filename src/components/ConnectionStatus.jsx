import { useEffect, useState } from 'react'
import { HealthState, checkSupabaseConnectivity } from '../lib/healthCheck'

/**
 * Surfaces the Supabase connectivity state (see lib/healthCheck.js).
 *
 * This is a development diagnostic, not a product feature. It exists so that a
 * misconfiguration announces itself in plain language on the page instead of
 * surfacing three screens later as an opaque 401 — which, against a cloud
 * backend, is a genuinely expensive way to lose an afternoon.
 *
 * It is NOT a security signal. It reports whether this app can talk to the
 * project, nothing about what the caller is permitted to read or write. That is
 * decided by PostgreSQL GRANTs and RLS policies (architecture E.3, E.4).
 */

const PRESENTATION = {
  [HealthState.CONNECTED]: {
    label: 'Connected',
    dot: 'bg-emerald-500',
    frame: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30',
    text: 'text-emerald-900 dark:text-emerald-200',
  },
  [HealthState.KEY_REJECTED]: {
    label: 'Key rejected',
    dot: 'bg-amber-500',
    frame: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
    text: 'text-amber-900 dark:text-amber-200',
  },
  [HealthState.UNREACHABLE]: {
    label: 'Unreachable',
    dot: 'bg-rose-500',
    frame: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30',
    text: 'text-rose-900 dark:text-rose-200',
  },
}

function ConnectionStatus() {
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    checkSupabaseConnectivity().then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!result) {
    return (
      <div className="mt-8 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-slate-400" />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Checking Supabase connection&hellip;
        </span>
      </div>
    )
  }

  const style = PRESENTATION[result.state]

  return (
    <div className={`mt-8 rounded-xl border px-5 py-4 ${style.frame}`}>
      <div className="flex items-center gap-3">
        <span className={`size-2 shrink-0 rounded-full ${style.dot}`} />
        <span className={`text-sm font-medium ${style.text}`}>
          Supabase: {style.label}
          {result.httpStatus !== null && (
            <span className="ml-2 font-mono text-xs opacity-70">
              HTTP {result.httpStatus}
            </span>
          )}
        </span>
      </div>

      <p className={`mt-2 text-sm ${style.text} opacity-90`}>{result.summary}</p>

      {result.remedy && (
        <p className={`mt-3 text-sm ${style.text} opacity-80`}>
          <span className="font-medium">Fix:</span> {result.remedy}
        </p>
      )}

      <details className="mt-3">
        <summary
          className={`cursor-pointer text-xs ${style.text} opacity-70 select-none`}
        >
          Observed response
        </summary>
        <pre
          className={`mt-2 overflow-x-auto rounded-lg bg-black/5 p-3 font-mono text-xs break-words whitespace-pre-wrap ${style.text} dark:bg-black/30`}
        >
          {result.observed}
        </pre>
      </details>
    </div>
  )
}

export default ConnectionStatus
