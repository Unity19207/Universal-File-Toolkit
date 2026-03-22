import clsx from 'clsx'
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  children,
  className,
  tone = 'primary',
  size = 'md',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={clsx(
        'smooth-theme inline-flex items-center justify-center gap-2 rounded-xl font-medium shadow-soft transition duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'px-3 py-2 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-sm',
        tone === 'primary' &&
          'bg-[var(--accent-primary)] text-white hover:brightness-110 hover:shadow-[0_10px_28px_-12px_color-mix(in_srgb,var(--accent-primary)_86%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]',
        tone === 'secondary' &&
          'surface text-primary hover:bg-[color-mix(in_srgb,var(--bg-surface)_78%,var(--accent-primary)_22%)]',
        tone === 'ghost' && 'bg-transparent text-secondary shadow-none hover:bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--bg-surface))]',
        tone === 'danger' &&
          'bg-[var(--negative)] text-white hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--negative)_26%,transparent)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
