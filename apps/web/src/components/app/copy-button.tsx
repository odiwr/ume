'use client'
import * as React from 'react'
import { Check, Copy } from '@/components/ui/icons'
import { toast } from 'sonner'
import { Button, type ButtonProps } from '@/components/ui/button'

export function CopyButton({ value, label = 'Copy', children, ...props }: { value: string; label?: string } & Omit<ButtonProps, 'onClick' | 'value'>) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error('Could not copy. Select the text and copy it manually.')
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {children ?? (copied ? 'Copied' : label)}
    </Button>
  )
}
