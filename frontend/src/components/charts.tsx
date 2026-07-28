import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { humanize, money, monthLabel, number, percent } from '../lib/format'
import type { FunnelStep, StageBucket, Trends } from '../types'
import { Card } from './ui'

const AXIS = { stroke: 'var(--baseline)', fontSize: 11, tickLine: false }
const TICK = { fill: 'var(--text-muted)', fontSize: 11 }
const GRID = 'var(--gridline)'
/** 4px rounded data-end, anchored to the baseline. */
const BAR_RADIUS_X: [number, number, number, number] = [0, 4, 4, 0]
const BAR_RADIUS_Y: [number, number, number, number] = [4, 4, 0, 0]

function compactAxis(value: number): string {
  return money(value)
}

export function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
}) {
  return (
    <Card className="p-4">
      <h2 className="heading text-xs text-ink">{title}</h2>
      {subtitle && <p className="callout mt-0.5 text-xs text-ink-2">{subtitle}</p>}
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

type TooltipRow = { name: string; value: number | string; color?: string }

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string; payload?: unknown }[]
  label?: string | number
  format?: (value: number | string) => string
}) {
  if (!active || !payload?.length) return null
  const rows: TooltipRow[] = payload.map((entry) => ({
    name: entry.name ?? '',
    value: entry.value ?? 0,
    color: entry.color,
  }))
  return (
    <div className="rounded-md border border-edge bg-surface px-2.5 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium text-ink">{label}</p>}
      {rows.map((row) => (
        <p key={row.name} className="tabular flex items-center gap-1.5 text-ink-2">
          {row.color && (
            <span
              aria-hidden
              className="h-2 w-2 rounded-full ring-2 ring-surface"
              style={{ background: row.color }}
            />
          )}
          {row.name}: <span className="font-medium text-ink">{format ? format(row.value) : row.value}</span>
        </p>
      ))}
    </div>
  )
}

const legendStyle = { fontSize: 11, color: 'var(--text-secondary)' }

/** Value in the pipeline right now, gross and probability-weighted. Same unit,
 *  so both series share one axis. */
export function PipelineByStageChart({ buckets }: { buckets: StageBucket[] }) {
  const data = buckets
    .filter((bucket) => bucket.category === 'open')
    .map((bucket) => ({
      stage: bucket.stage_name,
      total: Number(bucket.total_value),
      weighted: Number(bucket.weighted_value),
      count: bucket.deal_count,
    }))

  return (
    <ChartCard
      title="Pipeline by stage"
      subtitle="Gross value and probability-weighted value of live deals"
      height={300}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={compactAxis} tick={TICK} {...AXIS} />
        <YAxis type="category" dataKey="stage" width={110} tick={TICK} {...AXIS} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={<ChartTooltip format={(value) => money(value as number, false)} />}
        />
        <Legend wrapperStyle={legendStyle} />
        <Bar
          dataKey="total"
          name="Gross value"
          fill="var(--series-1)"
          radius={BAR_RADIUS_X}
          barSize={11}
          isAnimationActive={false}
        />
        <Bar
          dataKey="weighted"
          name="Weighted value"
          fill="var(--series-2)"
          radius={BAR_RADIUS_X}
          barSize={11}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartCard>
  )
}

/** How many deals ever reached each stage, and what share moved on. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const data = steps.map((step) => ({
    stage: step.stage_name,
    entered: step.entered,
    conversion: step.conversion_rate,
    days: step.avg_days_in_stage,
  }))

  return (
    <ChartCard
      title="Conversion funnel"
      subtitle="Deals that ever entered each stage, and the share that advanced"
      height={300}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} {...AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" width={110} tick={TICK} {...AXIS} />
        <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<FunnelTooltip />} />
        <Bar
          dataKey="entered"
          name="Deals entered"
          fill="var(--series-1)"
          radius={BAR_RADIUS_X}
          barSize={16}
          isAnimationActive={false}
          label={{
            position: 'right',
            fill: 'var(--text-secondary)',
            fontSize: 11,
            formatter: (value: unknown) => number(Number(value)),
          }}
        >
          {data.map((row) => (
            <Cell key={row.stage} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

function FunnelTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { payload?: { entered: number; conversion: number | null; days: number | null } }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  if (!row) return null
  return (
    <div className="rounded-md border border-edge bg-surface px-2.5 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{label}</p>
      <p className="tabular text-ink-2">
        Entered: <span className="font-medium text-ink">{number(row.entered)}</span>
      </p>
      <p className="tabular text-ink-2">
        Advanced: <span className="font-medium text-ink">{percent(row.conversion)}</span>
      </p>
      <p className="tabular text-ink-2">
        Avg time in stage:{' '}
        <span className="font-medium text-ink">{row.days === null ? '—' : `${row.days}d`}</span>
      </p>
    </div>
  )
}

/** Counts only — dollars get their own chart rather than a second y-axis. */
export function SourcedVsClosedChart({ trends }: { trends: Trends }) {
  const data = trends.months.map((point) => ({
    month: monthLabel(point.month),
    sourced: point.sourced,
    closed: point.closed,
  }))

  return (
    <ChartCard title="Deal flow" subtitle="Deals sourced and deals closed, by month">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={TICK} {...AXIS} />
        <YAxis tick={TICK} {...AXIS} allowDecimals={false} width={32} />
        <Tooltip cursor={{ stroke: 'var(--baseline)' }} content={<ChartTooltip />} />
        <Legend wrapperStyle={legendStyle} />
        <Line
          type="monotone"
          dataKey="sourced"
          name="Sourced"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="closed"
          name="Closed"
          stroke="var(--series-2)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartCard>
  )
}

export function ClosedVolumeChart({ trends }: { trends: Trends }) {
  const data = trends.months.map((point) => ({
    month: monthLabel(point.month),
    value: Number(point.closed_value),
  }))

  return (
    <ChartCard title="Closed volume" subtitle="Purchase price of deals closed, by month">
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={TICK} {...AXIS} />
        <YAxis tickFormatter={compactAxis} tick={TICK} {...AXIS} width={52} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={<ChartTooltip format={(value) => money(value as number, false)} />}
        />
        <Bar
          dataKey="value"
          name="Closed volume"
          fill="var(--series-1)"
          radius={BAR_RADIUS_Y}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartCard>
  )
}

export function BreakdownChart({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle: string
  rows: { label: string; deal_count: number; total_value: string }[]
}) {
  const data = rows.slice(0, 8).map((row) => ({
    label: humanize(row.label),
    value: Number(row.total_value),
    count: row.deal_count,
  }))

  return (
    <ChartCard title={title} subtitle={subtitle} height={Math.max(180, data.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={compactAxis} tick={TICK} {...AXIS} />
        <YAxis type="category" dataKey="label" width={110} tick={TICK} {...AXIS} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={<ChartTooltip format={(value) => money(value as number, false)} />}
        />
        <Bar
          dataKey="value"
          name="Pipeline value"
          fill="var(--series-3)"
          radius={BAR_RADIUS_X}
          barSize={16}
          isAnimationActive={false}
          label={{
            position: 'right',
            fill: 'var(--text-secondary)',
            fontSize: 11,
            formatter: (value: unknown) => money(Number(value)),
          }}
        />
      </BarChart>
    </ChartCard>
  )
}
