'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { useAnimate } from 'motion/react-mini'
import { cn } from '@/lib/utils'

/** A single wipe reveals the fill and reversed lettering together. */
export function FillLink({
  href,
  children,
  className,
  external = false,
}: {
  href: string
  children: ReactNode
  className?: string
  external?: boolean
}) {
  const [scope, animate] = useAnimate<HTMLAnchorElement>()
  const hovered = useRef(false)
  const focused = useRef(false)

  function update() {
    const active = hovered.current || focused.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    animate(
      '[data-fill]',
      { clipPath: active ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)' },
      {
        duration: reducedMotion ? 0 : 0.38,
        ease: [0.22, 1, 0.36, 1],
      },
    )
  }

  return (
    <Link
      ref={scope}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(
        'fill-link relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full border border-fg px-5 py-3 text-sm font-semibold',
        className,
      )}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          hovered.current = true
          update()
        }
      }}
      onPointerLeave={() => {
        hovered.current = false
        update()
      }}
      onFocus={() => {
        focused.current = true
        update()
      }}
      onBlur={() => {
        focused.current = false
        update()
      }}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
      <span
        data-fill
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-fg text-white"
        style={{ clipPath: 'inset(100% 0% 0% 0%)' }}
      >
        {children}
      </span>
    </Link>
  )
}
