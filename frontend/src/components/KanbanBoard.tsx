import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { money } from '../lib/format'
import type { Deal, Stage } from '../types'
import { DealCard, DraggableDealCard } from './DealCard'
import { cx } from './ui'

function Column({
  stage,
  deals,
  isTarget,
}: {
  stage: Stage
  deals: Deal[]
  isTarget: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((sum, deal) => sum + Number(deal.deal_value ?? 0), 0)

  return (
    <section
      ref={setNodeRef}
      aria-label={stage.name}
      className={cx(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-surface-2/60 transition',
        isOver ? 'border-series-1' : 'border-edge',
        isTarget && !isOver && 'border-dashed',
      )}
    >
      <header className="border-b border-edge px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface"
            style={{ background: stage.color }}
          />
          <h2 className="truncate text-sm font-semibold text-ink">{stage.name}</h2>
          <span className="tabular ml-auto text-xs text-muted">{deals.length}</span>
        </div>
        <p className="tabular mt-0.5 text-xs text-ink-2">
          {money(total)} · {stage.default_probability}% default
        </p>
      </header>
      <div className="flex max-h-[calc(100vh-15rem)] flex-col gap-2 overflow-y-auto p-2">
        {deals.map((deal) => (
          <DraggableDealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && <p className="py-6 text-center text-xs text-muted">No deals</p>}
      </div>
    </section>
  )
}

export function KanbanBoard({
  stages,
  deals,
  onMove,
}: {
  stages: Stage[]
  deals: Deal[]
  onMove: (dealId: number, stageId: number) => void
}) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  // A few pixels of travel before a drag starts, so card links still click.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const dragging = deals.find((deal) => deal.id === draggingId) ?? null

  function onDragStart(event: DragStartEvent) {
    setDraggingId(Number(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const stageId = event.over ? Number(event.over.id) : null
    const dealId = Number(event.active.id)
    const from = event.active.data.current?.stageId as number | undefined
    if (stageId && stageId !== from) onMove(dealId, stageId)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            deals={deals.filter((deal) => deal.stage_id === stage.id)}
            isTarget={dragging !== null && dragging.stage_id !== stage.id}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="w-72 rotate-1">
            <DealCard deal={dragging} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
