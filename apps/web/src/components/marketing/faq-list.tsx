'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from '@/components/ui/icons'

export interface FaqItem {
  q: string
  a: ReactNode
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="rounded-2xl bg-surface-2/60 px-5 py-2 sm:px-6">
      <h3>
        <button
          type="button"
          id={`${id}-question`}
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left text-base font-medium"
        >
          <span>{item.q}</span>
          <ChevronDown
            className={`size-4 shrink-0 text-fg-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div
        id={`${id}-answer`}
        role="region"
        aria-labelledby={`${id}-question`}
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-w-prose pb-5 pt-2 text-base leading-relaxed text-fg-muted [&_a]:text-pink-soft [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-surface-3 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-fg">
            {item.a}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="">
      {items.map((item) => (
        <FaqRow key={item.q} item={item} />
      ))}
    </div>
  )
}
