import { useState } from 'react'
import { useDeals, useMoveStage, useStages } from '../api/hooks'
import { FilterBar, useDealFilters } from '../components/FilterBar'
import { KanbanBoard } from '../components/KanbanBoard'
import { NewDealModal } from '../components/NewDealModal'
import { Button, ErrorNote, Spinner } from '../components/ui'
import { money } from '../lib/format'

export function PipelinePage() {
  const { filters } = useDealFilters()
  const { data: stages, isLoading: stagesLoading } = useStages()
  // The board shows every open deal at once; 500 is the API's page ceiling.
  const { data, isLoading, error } = useDeals({ ...filters, page_size: 500, sort: '-updated_at' })
  const moveStage = useMoveStage()
  const [creating, setCreating] = useState(false)

  const deals = data?.items ?? []
  const totalValue = deals.reduce((sum, deal) => sum + Number(deal.deal_value ?? 0), 0)
  const weighted = deals.reduce((sum, deal) => sum + Number(deal.weighted_value ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="heading text-xl text-ink">Pipeline</h1>
          <p className="tabular text-sm text-ink-2">
            {deals.length} deals · {money(totalValue)} total · {money(weighted)} weighted
          </p>
        </div>
      </div>

      <FilterBar>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New deal
        </Button>
      </FilterBar>

      <ErrorNote error={error ?? moveStage.error} />

      {isLoading || stagesLoading ? (
        <Spinner label="Loading the board…" />
      ) : (
        <KanbanBoard
          stages={stages ?? []}
          deals={deals}
          onMove={(dealId, stageId) => moveStage.mutate({ dealId, stageId })}
        />
      )}

      {creating && <NewDealModal onClose={() => setCreating(false)} />}
    </div>
  )
}
