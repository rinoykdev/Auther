/**
 * The rounded field used by both auth screens (VISUAL ONLY).
 *
 * The approved design shows no visible labels, so each field carries a
 * visually hidden one. A placeholder is NOT a label: it disappears on focus
 * and is not reliably announced, which leaves a screen-reader user typing into
 * an unnamed box (architecture F — forms must be keyboard-accessible with
 * labelled fields).
 */
function PillInput({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={id}
        placeholder={label}
        className="w-full rounded-full border border-slate-300 bg-transparent px-6 py-4 text-[0.95rem] text-ink-900 placeholder:text-ink-900/70 focus:border-ink-900 focus:ring-0 focus:outline-none"
        {...props}
      />
    </div>
  )
}

export default PillInput
