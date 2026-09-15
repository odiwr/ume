import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function Logo({ size = 32, withWordmark = true, href = '/', className }: { size?: number; withWordmark?: boolean; href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2', className)} aria-label="Ume home">
      <span className="inline-flex items-center justify-center rounded-lg bg-pink" style={{ width: size, height: size }}>
        <Image src="/brand/ume-logo.svg" alt="" width={size} height={size} className="scale-[1.15]" priority />
      </span>
      {withWordmark ? <span className="font-display text-xl font-bold tracking-tight">ume</span> : null}
    </Link>
  )
}
