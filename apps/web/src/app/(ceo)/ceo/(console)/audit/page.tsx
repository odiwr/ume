import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'
import { AUDIT_PREFIXES, clampPage, listAudit, str } from '@/lib/ceo/queries'
import { PageHeader, FilterChips } from '@/components/ceo/page-header'
import { DataTable, JsonInline, Mono, type Column } from '@/components/ceo/data-table'
import { Pagination } from '@/components/ceo/pagination'
import { Ago } from '@/components/ceo/time'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Audit' }

type Row = Awaited<ReturnType<typeof listAudit>>['rows'][number]

export default async function CeoAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const prefix = str(sp.prefix) || undefined
  const scope = str(sp.scope) === 'global' ? 'global' : undefined
  const workspaceId = str(sp.workspaceId) || undefined
  const page = clampPage(sp.page)
  const r = await listAudit({ page, prefix, scope, workspaceId })
  const params = { prefix: r.prefix || undefined, scope, workspaceId }
  const scopedWorkspaceName = workspaceId
    ? (r.rows.find((x) => x.log.workspaceId === workspaceId)?.workspaceName ?? null)
    : null

  const columns: Column<Row>[] = [
    { key: 'when', header: 'When', render: (x) => <Ago date={x.log.createdAt} /> },
    {
      key: 'action',
      header: 'Action',
      render: (x) => (
        <Mono className={x.log.action.startsWith('ceo.') ? 'text-pink-soft' : undefined}>
          {x.log.action}
        </Mono>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (x) =>
        x.log.actorUserId ? (
          <Link href={`/ceo/users/${x.log.actorUserId}`} className="hover:text-pink-soft">
            {x.actorEmail ?? <Mono>{x.log.actorUserId}</Mono>}
          </Link>
        ) : x.log.actorDiscordId ? (
          <Mono>discord:{x.log.actorDiscordId}</Mono>
        ) : (
          <span className="text-fg-subtle">system</span>
        ),
    },
    {
      key: 'ws',
      header: 'Workspace',
      render: (x) =>
        x.log.workspaceId ? (
          <Link href={`/ceo/workspaces/${x.log.workspaceId}`} className="hover:text-pink-soft">
            {x.workspaceName ?? <Mono>{x.log.workspaceId}</Mono>}
          </Link>
        ) : (
          <Badge>global</Badge>
        ),
    },
    {
      key: 'target',
      header: 'Target',
      render: (x) =>
        x.log.targetType ? (
          <span className="text-xs text-fg-muted">
            {x.log.targetType} {x.log.targetId ? <Mono>{x.log.targetId}</Mono> : null}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    { key: 'meta', header: 'Details', render: (x) => <JsonInline value={x.log.metadata} /> },
    {
      key: 'ip',
      header: 'IP',
      render: (x) =>
        x.log.ip ? <Mono>{x.log.ip}</Mono> : <span className="text-fg-subtle">—</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Audit"
        description="Every privileged mutation, from the app, the bot and this console. Global rows have no workspace; ceo.* rows are yours."
      />
      <div className="flex flex-col gap-2">
        <FilterChips
          basePath="/ceo/audit"
          param="prefix"
          current={r.prefix || null}
          extra={{ scope, workspaceId }}
          options={[
            { value: null, label: 'All actions' },
            ...AUDIT_PREFIXES.map((p) => ({ value: p, label: p.slice(0, -1) })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            basePath="/ceo/audit"
            param="scope"
            current={scope ?? null}
            extra={{ prefix: params.prefix, workspaceId }}
            options={[
              { value: null, label: 'All rows' },
              { value: 'global', label: 'Global only' },
            ]}
          />
          {workspaceId ? (
            <Link
              href={`/ceo/audit${params.prefix ? `?prefix=${encodeURIComponent(params.prefix)}` : ''}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-pink/40 bg-pink/15 px-3 py-1 text-xs font-medium text-pink-soft hover:bg-pink/25"
            >
              workspace: {scopedWorkspaceName ?? workspaceId} <X className="size-3" />
            </Link>
          ) : null}
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={r.rows}
        rowKey={(x) => x.log.id}
        empty="No audit entries match."
        dense
      />
      <Pagination
        page={r.page}
        pageSize={r.pageSize}
        total={r.total}
        basePath="/ceo/audit"
        params={params}
      />
    </>
  )
}
