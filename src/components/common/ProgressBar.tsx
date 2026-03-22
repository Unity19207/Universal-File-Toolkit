interface ProgressBarProps {
  value: number
}

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="h-2.5 rounded-full bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)]">
      <div
        className="smooth-theme h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all"
        style={{ width: `${Math.min(Math.max(value * 100, 2), 100)}%` }}
      />
    </div>
  )
}
