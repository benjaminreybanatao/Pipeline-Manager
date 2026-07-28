import { Link } from 'react-router-dom'
import { useAllTasks, useDeals, useFunnel, useStageBuckets, useSummary, useTrends } from '../api/hooks'
import {
  BreakdownChart,
  ClosedVolumeChart,
  FunnelChart,
  PipelineByStageChart,
  SourcedVsClosedChart,
} from '../components/charts'
import { Card, EmptyState, ErrorNote, Spinner, cx } from '../components/ui'
import { STAGE_STALE_DAYS } from '../lib/constants'
import { day, humanize, money, number, percent } from '../lib/format'

function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail?: string
  tone?: 'critical' | 'serious'
}) {
  return (
    <Card className="p-3.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cx(
          'mt-1 text-2xl font-semibold',
          tone === 'critical' ? 'text-critical' : tone === 'serious' ? 'text-serious' : 'text-ink',
        )}
      >
        {value}
      </p>
      {detail && <p className="tabular mt-0.5 text-xs text-ink-2">{detail}</p>}
    </Card>
  )
}

/** Deals sitting in one stage past the stall threshold — the list you work from. */
function StalledDeals() {
  const { data } = useDeals({
    status: ['active'],
    sort: 'stage_entered_at',
    page_size: 10,
  })
  const stalled = (data?.items ?? []).filter((deal) => deal.days_in_stage >= STAGE_STALE_DAYS)

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Stalled deals</h2>
      <p className="callout mt-0.5 text-xs text-ink-2">
        No stage movement in {STAGE_STALE_DAYS}+ days
      </p>
      {stalled.length === 0 ? (
        <EmptyState>Nothing stalled — the board is moving.</EmptyState>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-2">
              <th scope="col" className="pb-1.5 font-medium">
                Deal
              </th>
              <th scope="col" className="pb-1.5 font-medium">
                Stage
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                Value
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                In stage
              </th>
            </tr>
          </thead>
          <tbody>
            {stalled.map((deal) => (
              <tr key={deal.id} className="border-b border-line last:border-0">
                <td className="py-1.5">
                  <Link to={`/deals/${deal.id}`} className="text-ink hover:underline">
                    {deal.name}
                  </Link>
                </td>
                <td className="py-1.5 text-ink-2">{deal.stage.name}</td>
                <td className="tabular py-1.5 text-right">{money(deal.deal_value)}</td>
                <td className="tabular py-1.5 text-right text-critical">{deal.days_in_stage}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/** Everything past due across the whole pipeline, soonest first. */
function OverdueTasks() {
  const { data: tasks } = useAllTasks({ overdue: true })

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Overdue tasks</h2>
      <p className="callout mt-0.5 text-xs text-ink-2">Past their due date and not done</p>
      {!tasks?.length ? (
        <EmptyState>Nothing overdue.</EmptyState>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-2">
              <th scope="col" className="pb-1.5 font-medium">
                Task
              </th>
              <th scope="col" className="pb-1.5 font-medium">
                Deal
              </th>
              <th scope="col" className="pb-1.5 font-medium">
                Assignee
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                Due
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 10).map((task) => (
              <tr key={task.id} className="border-b border-line last:border-0">
                <td className="py-1.5 text-ink">{task.title}</td>
                <td className="py-1.5">
                  <Link to={`/deals/${task.deal_id}`} className="text-ink-2 hover:underline">
                    {task.deal_name}
                  </Link>
                </td>
                <td className="py-1.5 text-ink-2">{task.assignee?.name ?? 'Unassigned'}</td>
                <td className="tabular py-1.5 text-right text-critical">{day(task.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/** The chart data as a table — identity is never carried by color alone. */
function StageTable() {
  const { data: buckets } = useStageBuckets()
  if (!buckets) return null

  return (
    <Card className="overflow-x-auto p-4">
      <h2 className="text-sm font-semibold text-ink">Stage detail</h2>
      <table className="mt-3 w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-edge text-left text-xs text-ink-2">
            <th scope="col" className="pb-1.5 font-medium">
              Stage
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Deals
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Gross value
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Weighted
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Avg days
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Stalled
            </th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.stage_id} className="border-b border-line last:border-0">
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full ring-2 ring-surface"
                    style={{ background: bucket.color }}
                  />
                  <span className="text-ink">{bucket.stage_name}</span>
                  {bucket.category !== 'open' && (
                    <span className="text-xs text-muted">{humanize(bucket.category)}</span>
                  )}
                </span>
              </td>
              <td className="tabular py-1.5 text-right text-ink-2">{bucket.deal_count}</td>
              <td className="tabular py-1.5 text-right">{money(bucket.total_value)}</td>
              <td className="tabular py-1.5 text-right">{money(bucket.weighted_value)}</td>
              <td className="tabular py-1.5 text-right text-ink-2">
                {bucket.avg_days_in_stage === null ? '—' : `${bucket.avg_days_in_stage}d`}
              </td>
              <td className="tabular py-1.5 text-right text-ink-2">
                {bucket.stalled_count || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export function DashboardPage() {
  const summary = useSummary()
  const buckets = useStageBuckets()
  const funnel = useFunnel()
  const trends = useTrends(12)

  const error = summary.error ?? buckets.error ?? funnel.error ?? trends.error
  if (error) return <ErrorNote error={error} />
  if (summary.isLoading || !summary.data) return <Spinner label="Crunching the pipeline…" />

  const s = summary.data

  return (
    <div className="space-y-4">
      <div>
        <h1 className="heading text-xl text-ink">Dashboard</h1>
        <p className="callout text-sm text-ink-2">Where the pipeline stands as of {day(new Date().toISOString())}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatTile
          label="Live deals"
          value={number(s.active_deals)}
          detail={`${money(s.total_pipeline_value)} gross`}
        />
        <StatTile
          label="Weighted pipeline"
          value={money(s.weighted_pipeline_value)}
          detail="Value × probability"
        />
        <StatTile
          label="Closing this quarter"
          value={number(s.closing_this_quarter)}
          detail={money(s.closing_this_quarter_value)}
        />
        <StatTile
          label="Win rate"
          value={percent(s.win_rate)}
          detail={`${s.won_deals} won · ${s.lost_deals} lost`}
        />
        <StatTile
          label="Avg days to close"
          value={s.avg_days_to_close === null ? '—' : `${s.avg_days_to_close}d`}
          detail="Created to closed, won deals"
        />
        <StatTile
          label="Needs attention"
          value={number(s.stalled_deals + s.overdue_tasks)}
          detail={`${s.stalled_deals} stalled deals · ${s.overdue_tasks} overdue tasks`}
          tone={s.stalled_deals + s.overdue_tasks > 0 ? 'serious' : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {buckets.data && <PipelineByStageChart buckets={buckets.data} />}
        {funnel.data && <FunnelChart steps={funnel.data} />}
        {trends.data && <SourcedVsClosedChart trends={trends.data} />}
        {trends.data && <ClosedVolumeChart trends={trends.data} />}
        {trends.data && (
          <BreakdownChart
            title="By property type"
            subtitle="Gross value of live deals"
            rows={trends.data.by_property_type}
          />
        )}
        {trends.data && (
          <BreakdownChart
            title="By market"
            subtitle="Gross value of live deals (top 8)"
            rows={trends.data.by_market}
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StageTable />
        <StalledDeals />
        <OverdueTasks />
      </div>
    </div>
  )
}
