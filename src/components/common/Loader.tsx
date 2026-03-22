import clsx from 'clsx'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function Loader({ size = 'md', label = 'Loading...', className }: LoaderProps) {
  return (
    <div className={clsx('inline-flex items-center gap-2 text-sm text-secondary', className)}>
      <span
        className={clsx(
          'inline-block animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)] border-t-[var(--accent-primary)]',
          size === 'sm' && 'h-3.5 w-3.5',
          size === 'md' && 'h-4.5 w-4.5',
          size === 'lg' && 'h-6 w-6',
        )}
      />
      <span>{label}</span>
    </div>
  )
}

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('h-4 animate-pulse rounded-lg bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)]', className)} />
}
