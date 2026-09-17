import type { Metadata } from 'next'
import Link from 'next/link'
import { clampPage, listUsers, str } from '@/lib/ceo/queries'
import { requireCeo } from '@/lib/session'
import { PageHeader, FilterChips } from '@/components/ceo/page-header'
import { SearchForm } from '@/components/ceo/search-form'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { Pagination } from '@/components/ceo/pagination'
import { Ago } from '@/components/ceo/time'
import { Badge } from '@/components/ui/badge'
import { UserBanControl } from '@/components/ceo/user-actions'

export const metadata: Metadata = { title: 'Users' }

type Row = Awaited<ReturnType<typeof listUsers>>['rows'][number]

export default async function CeoUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireCeo()
  const sp = await searchParams
  const q = str(sp.q)
  const banned = str(sp.filter) === 'banned'
  const page = clampPage(sp.page)
  const result = await listUsers({ q, page, banned })

  const columns: Column<Row>[] = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="min-w-0">
          <Link href={`/ceo/users/${u.id}`} className="font-medium hover:text-pink-soft">
            {u.name || u.email}
          </Link>
          <p className="text-xs text-fg-muted">
            {u.email}
            {u.emailVerified ? '' : ' (unverified)'}
          </p>
        </div>
      ),
    },
    {
      key: 'discord',
      header: 'Discord',
      render: (u) =>
        u.discordUserId ? (
          <span className="text-sm">
            @{u.discordUsername ?? '?'} <Mono>{u.discordUserId}</Mono>
          </span>
        ) : (
          <span className="text-fg-subtle">not linked</span>
        ),
    },
    { key: 'memberships', header: 'Memberships', align: 'right', render: (u) => u.memberships },
    { key: 'owned', header: 'Owns', align: 'right', render: (u) => u.owned },
    {
      key: 'banned',
      header: 'Status',
      render: (u) =>
        u.banned ? (
          <Badge tone="danger" title={u.banReason ?? undefined}>
            banned
          </Badge>
        ) : (
          <Badge tone="success">active</Badge>
        ),
    },
    { key: 'created', header: 'Joined', render: (u) => <Ago date={u.createdAt} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <UserBanControl
          userId={u.id}
          email={u.email}
          banned={u.banned}
          inline
          isSelf={u.id === session.user.id}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Users" />
      <div className="flex flex-col gap-3">
        <SearchForm
          basePath="/ceo/users"
          q={q}
          placeholder="Search email, name, Discord username or id"
          hidden={{ filter: banned ? 'banned' : undefined }}
        />
        <FilterChips
          basePath="/ceo/users"
          param="filter"
          current={banned ? 'banned' : null}
          extra={{ q }}
          options={[
            { value: null, label: 'All' },
            { value: 'banned', label: 'Banned' },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={result.rows}
        rowKey={(u) => u.id}
        empty="No users match."
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        basePath="/ceo/users"
        params={{ q, filter: banned ? 'banned' : undefined }}
      />
    </>
  )
}
