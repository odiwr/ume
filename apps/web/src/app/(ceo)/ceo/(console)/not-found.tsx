import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonClasses } from '@/components/ui/button'

export default function CeoNotFound() {
  return (
    <EmptyState
      icon={<SearchX className="size-6" />}
      title="Nothing at this address"
      description="The record was purged, the id is wrong, or the link is stale. Ids are prefixed: ws_ for workspaces, users carry the auth id."
      className="mt-12"
    >
      <Link href="/ceo" className={buttonClasses('secondary', 'sm')}>
        Back to overview
      </Link>
    </EmptyState>
  )
}
