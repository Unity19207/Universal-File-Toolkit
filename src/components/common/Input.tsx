import clsx from 'clsx'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-primary">{label}</span> : null}
      <input
        id={id}
        className={clsx(
          'smooth-theme surface w-full rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted focus:border-[var(--accent-primary)] focus:outline-none',
          error && 'border-[color-mix(in_srgb,var(--negative)_45%,transparent)]',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-[var(--negative)]">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}
