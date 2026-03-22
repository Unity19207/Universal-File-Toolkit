import clsx from 'clsx'
import { forwardRef } from 'react'
import type { CSSProperties, PropsWithChildren } from 'react'

interface CardProps {
  className?: string
  hoverable?: boolean
  style?: CSSProperties
}

export const Card = forwardRef<HTMLElement, PropsWithChildren<CardProps>>(function Card(
  { children, className, hoverable = false, style },
  ref,
) {
  return (
    <section
      ref={ref}
      style={style}
      className={clsx('surface smooth-theme rounded-3xl p-6 shadow-soft', hoverable && 'hover-lift cursor-pointer hover:shadow-glow', className)}
    >
      {children}
    </section>
  )
})
