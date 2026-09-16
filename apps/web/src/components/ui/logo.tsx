import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function BrandMark({
  size = 30,
  circleSize = size + 14,
}: {
  size?: number
  circleSize?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-blush"
      style={{ width: circleSize, height: circleSize }}
    >
      <Image
        src="/brand/ume-logo.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 scale-[1.15] object-contain"
        style={{ width: size, height: size }}
      />
    </span>
  )
}

export function Logo({
  size = 30,
  circleSize,
  withWordmark = true,
  href = '/',
  className,
}: {
  size?: number
  circleSize?: number
  withWordmark?: boolean
  href?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn('inline-flex min-h-11 shrink-0 items-center gap-2.5', className)}
      aria-label="Ume home"
    >
      <BrandMark size={size} circleSize={circleSize} />
      {withWordmark ? (
        <span className="font-display text-3xl font-semibold tracking-tight">ume</span>
      ) : null}
    </Link>
  )
}
