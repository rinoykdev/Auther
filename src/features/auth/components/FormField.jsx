import PillInput from './PillInput'

/**
 * A PillInput plus its error text.
 *
 * `aria-invalid` and `aria-describedby` are set together: a screen reader
 * announces "invalid" and then reads the reason. Colour alone is not an error
 * message (architecture F — error text must be announced).
 */
function FormField({ id, label, error, ...props }) {
  return (
    <div>
      <PillInput
        id={id}
        label={label}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 pl-6 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
