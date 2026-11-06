/**
 * Inline message band.
 *
 * `role="alert"` on errors so assistive technology announces them without the
 * user having to go looking; `role="status"` for success and info, which is
 * polite and does not interrupt.
 */
const STYLES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  info: 'bg-slate-100 text-ink-900 ring-slate-200',
}

function Alert({ tone = 'error', children }) {
  if (!children) return null
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl px-5 py-3.5 text-sm ring-1 ${STYLES[tone]}`}
    >
      {children}
    </div>
  )
}

export default Alert
