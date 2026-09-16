'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBytes } from '@ume/shared'

/**
 * Brand chart palette. One accent (pink) for single-series charts; plan tiers are
 * ordinal (free < plus < pro < studio) so they use a pink lightness ramp rather
 * than four competing hues.
 */
const PINK = 'var(--color-pink)'
const PLAN_RAMP: Record<string, string> = {
  free: '#6f3556',
  plus: '#a8478a',
  pro: 'var(--color-pink)',
  studio: '#f4a3d2',
}
const GRID = 'var(--color-border)'
const TICK = { fill: 'var(--color-fg-subtle)', fontSize: 11 }
const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--color-fg)',
  },
  labelStyle: { color: 'var(--color-fg-muted)', marginBottom: 4 },
  itemStyle: { color: 'var(--color-fg)' },
  cursor: { fill: 'rgba(37,43,38,0.04)' },
}

export function WorkspacesPerWeekChart({
  data,
}: {
  data: Array<{ week: string; label: string; count: number }>
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} interval={1} />
          <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value) => [
              `${Number(value)} workspace${Number(value) === 1 ? '' : 's'}`,
              'Created',
            ]}
            labelFormatter={(label, payload) => {
              const week = payload?.[0]?.payload?.week as string | undefined
              return week ? `Week of ${week}` : String(label)
            }}
          />
          <Bar dataKey="count" fill={PINK} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StorageByPlanChart({
  data,
}: {
  data: Array<{ plan: string; bytes: number; workspaces: number }>
}) {
  const rows = data.map((d) => ({ ...d, gb: d.bytes / 1024 ** 3 }))
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="plan" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => `${Number(v).toFixed(v >= 10 ? 0 : 1)} GB`}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(_value, _name, item) => {
              const p = item?.payload as { bytes: number; workspaces: number } | undefined
              return [
                `${formatBytes(p?.bytes ?? 0)} across ${p?.workspaces ?? 0} workspace${p?.workspaces === 1 ? '' : 's'}`,
                'Stored',
              ]
            }}
            labelFormatter={(label) => `${String(label)} plan`}
          />
          <Bar dataKey="gb" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {rows.map((r) => (
              <Cell key={r.plan} fill={PLAN_RAMP[r.plan] ?? PINK} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MrrByPlanChart({
  data,
}: {
  data: Array<{ plan: string; name: string; active: number; mrrUsd: number }>
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => `$${Number(v)}`}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const p = item?.payload as { active: number } | undefined
              return [
                `$${Number(value).toLocaleString('en-US')} / month from ${p?.active ?? 0} active`,
                'MRR',
              ]
            }}
            labelFormatter={(label) => `${String(label)} plan`}
          />
          <Bar dataKey="mrrUsd" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((r) => (
              <Cell key={r.plan} fill={PLAN_RAMP[r.plan] ?? PINK} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal usage meter used in storage tables. */
export function UsageBar({ used, quota }: { used: number; quota: number }) {
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0
  const tone = pct >= 100 ? 'var(--color-danger)' : pct >= 85 ? 'var(--color-warning)' : PINK
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <span className="text-xs tabular-nums text-fg-muted">{pct.toFixed(pct >= 10 ? 0 : 1)}%</span>
    </div>
  )
}
