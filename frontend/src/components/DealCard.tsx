import { Link } from 'react-router-dom'
import { useDraggable } from '@dnd-kit/core'
import { STAGE_STALE_DAYS, STAGE_WARNING_DAYS } from '../lib/constants'
import { humanize, money } from '../lib/format'
import type { Deal } from '../types'
import { Avatar, cx } from './ui'

function AgingBadge({ days }: { days: number }) {
  if (days < STAGE_WARNING_DAYS) {
    return <span className="tabular text-muted">{days}d in stage</span>
  }
  const stale = days >= STAGE_STALE_DAYS
  return (
    <span
      className={cx('tabular inline-flex items-center gap-1', stale ? 'text-critical' : 'text-serious')}
      title={stale ? 'Stalled — no stage movement in over six weeks' : 'Slow — watch this one'}
    >
      <span aria-hidden>{stale ? '▲' : '▲'}</span>
      {days}d in stage
    </span>
  )
}

export function DealCard({ deal, dragging }: { deal: Deal; dragging?: boolean }) {
  return (
    <div
      className={cx(
        'rounded-md border border-edge bg-surface p-2.5 text-left shadow-sm',
        dragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* The 4px drag-activation distance keeps this link clickable, so the
            whole card stays draggable — including its title. */}
        <Link to={`/deals/${deal.id}`} className="text-sm font-medium text-ink hover:underline">
          {deal.name}
        </Link>
        {deal.owner && <Avatar name={deal.owner.name} title={`Owner: ${deal.owner.name}`} />}
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-2">
        {humanize(deal.property_type)}
        {deal.market ? ` · ${deal.market}` : ''}
      </p>
      <p className="tabular mt-1.5 text-sm font-semibold text-ink">{money(deal.deal_value)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <AgingBadge days={deal.days_in_stage} />
        {deal.overdue_task_count > 0 ? (
          <span className="tabular text-critical" title="Tasks past their due date">
            ⚑ {deal.overdue_task_count} overdue
          </span>
        ) : deal.open_task_count > 0 ? (
          <span className="tabular text-muted">{deal.open_task_count} open</span>
        ) : null}
      </div>
    </div>
  )
}

export function DraggableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stageId: deal.stage_id },
  })

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cx('touch-none', isDragging && 'z-50')}
      {...listeners}
      {...attributes}
    >
      <DealCard deal={deal} dragging={isDragging} />
    </div>
  )
}
