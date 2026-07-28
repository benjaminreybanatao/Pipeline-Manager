import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDeal, useDeleteDeal, useMoveStage, useStages } from '../api/hooks'
import { ActivityTab } from '../components/deal/ActivityTab'
import { DocumentsTab } from '../components/deal/DocumentsTab'
import { MilestonesTab } from '../components/deal/MilestonesTab'
import { OverviewTab } from '../components/deal/OverviewTab'
import { TasksTab } from '../components/deal/TasksTab'
import { TeamTab } from '../components/deal/TeamTab'
import { Button, Card, ErrorNote, Pill, Select, Spinner, cx } from '../components/ui'
import { STAGE_STALE_DAYS, STAGE_WARNING_DAYS } from '../lib/constants'
import { day, humanize, money, rate } from '../lib/format'
import type { DealDetail } from '../types'

const TABS = ['Overview', 'Tasks', 'Milestones', 'Team', 'Documents', 'Activity'] as const
type Tab = (typeof TABS)[number]

function KeyFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function Header({ deal }: { deal: DealDetail }) {
  const navigate = useNavigate()
  const { data: stages } = useStages()
  const moveStage = useMoveStage()
  const deleteDeal = useDeleteDeal()

  const agingClass =
    deal.days_in_stage >= STAGE_STALE_DAYS
      ? 'text-critical'
      : deal.days_in_stage >= STAGE_WARNING_DAYS
        ? 'text-serious'
        : 'text-ink-2'

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/deals" className="text-xs text-muted hover:underline">
            ← All deals
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-ink">{deal.name}</h1>
          <p className="text-sm text-ink-2">
            {humanize(deal.property_type)}
            {deal.address ? ` · ${deal.address}` : ''}
            {deal.market ? ` · ${deal.market}` : ''}
            {deal.state ? `, ${deal.state}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill color={deal.stage.color}>{deal.stage.name}</Pill>
            <Pill>{humanize(deal.status)}</Pill>
            <span className={cx('tabular text-xs', agingClass)}>
              {deal.days_in_stage}d in stage
            </span>
            {deal.owner && <span className="text-xs text-ink-2">Owner: {deal.owner.name}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted" htmlFor="move-stage">
            Move to
          </label>
          <Select
            id="move-stage"
            className="w-44"
            value={deal.stage_id}
            onChange={(event) =>
              moveStage.mutate({ dealId: deal.id, stageId: Number(event.target.value) })
            }
          >
            {stages?.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
          <Button
            variant="danger"
            onClick={async () => {
              if (!window.confirm(`Delete "${deal.name}"? This cannot be undone.`)) return
              await deleteDeal.mutateAsync(deal.id)
              navigate('/deals')
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-edge pt-3 sm:grid-cols-3 lg:grid-cols-6">
        <KeyFigure label="Deal value" value={money(deal.deal_value, false)} />
        <KeyFigure
          label={`Weighted (${deal.effective_probability}%)`}
          value={money(deal.weighted_value, false)}
        />
        <KeyFigure label="Going-in cap" value={rate(deal.going_in_cap_rate)} />
        <KeyFigure label="Target IRR" value={rate(deal.target_irr, 1)} />
        <KeyFigure
          label="Size"
          value={
            deal.units
              ? `${deal.units} units`
              : deal.square_feet
                ? `${deal.square_feet.toLocaleString()} SF`
                : '—'
          }
        />
        <KeyFigure label="Expected close" value={day(deal.expected_close_date)} />
      </div>

      <ErrorNote error={moveStage.error ?? deleteDeal.error} />
    </Card>
  )
}

export function DealDetailPage() {
  const { dealId } = useParams()
  const id = Number(dealId)
  const { data: deal, isLoading, error } = useDeal(Number.isFinite(id) ? id : undefined)
  const [tab, setTab] = useState<Tab>('Overview')

  if (isLoading) return <Spinner label="Loading deal…" />
  if (error) return <ErrorNote error={error} />
  if (!deal) return null

  return (
    <div className="space-y-4">
      <Header deal={deal} />

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-edge">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
              tab === name
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {name}
            {name === 'Tasks' && deal.open_task_count > 0 && (
              <span className="tabular ml-1.5 text-xs text-muted">{deal.open_task_count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab deal={deal} />}
      {tab === 'Tasks' && <TasksTab dealId={deal.id} />}
      {tab === 'Milestones' && <MilestonesTab dealId={deal.id} />}
      {tab === 'Team' && <TeamTab dealId={deal.id} />}
      {tab === 'Documents' && <DocumentsTab dealId={deal.id} />}
      {tab === 'Activity' && <ActivityTab dealId={deal.id} />}
    </div>
  )
}
