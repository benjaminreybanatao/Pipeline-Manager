import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeals } from '../api/hooks'
import { FilterBar, useDealFilters } from '../components/FilterBar'
import { NewDealModal } from '../components/NewDealModal'
import { Button, Card, ErrorNote, EmptyState, Pill, Spinner, cx } from '../components/ui'
import { day, humanize, money, number, rate } from '../lib/format'
import type { Deal } from '../types'

const COLUMNS: { key: string; label: string; sortable?: string; align?: 'right' }[] = [
  { key: 'name', label: 'Deal', sortable: 'name' },
  { key: 'stage', label: 'Stage' },
  { key: 'property_type', label: 'Type' },
  { key: 'market', label: 'Market' },
  { key: 'value', label: 'Value', sortable: 'value', align: 'right' },
  { key: 'probability', label: 'Prob.', align: 'right' },
  { key: 'weighted', label: 'Weighted', align: 'right' },
  { key: 'cap', label: 'Cap', align: 'right' },
  { key: 'owner', label: 'Owner' },
  { key: 'close', label: 'Expected close', sortable: 'expected_close_date' },
  { key: 'aging', label: 'In stage', sortable: 'stage_entered_at', align: 'right' },
  { key: 'tasks', label: 'Tasks', align: 'right' },
]

function toCsv(deals: Deal[]): string {
  const header = [
    'Name',
    'Stage',
    'Status',
    'Property type',
    'Market',
    'Value',
    'Probability',
    'Weighted value',
    'Going-in cap',
    'Owner',
    'Expected close',
    'Days in stage',
  ]
  const rows = deals.map((deal) => [
    deal.name,
    deal.stage.name,
    deal.status,
    deal.property_type,
    deal.market ?? '',
    deal.deal_value ?? '',
    deal.effective_probability,
    deal.weighted_value,
    deal.going_in_cap_rate ?? '',
    deal.owner?.name ?? '',
    deal.expected_close_date ?? '',
    deal.days_in_stage,
  ])
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function DealsPage() {
  const { filters, params, setParams } = useDealFilters()
  const [creating, setCreating] = useState(false)

  const sort = params.get('sort') ?? '-updated_at'
  const page = Number(params.get('page') ?? 1)
  const { data, isLoading, error } = useDeals({ ...filters, sort, page, page_size: 50 })

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  function toggleSort(column: string) {
    setParam('sort', sort === column ? `-${column}` : column)
  }

  function exportCsv() {
    const blob = new Blob([toCsv(data?.items ?? [])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'pipeline.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Deals</h1>
          <p className="tabular text-sm text-ink-2">
            {data ? `${number(data.total)} matching deals` : '—'}
          </p>
        </div>
      </div>

      <FilterBar>
        <Button onClick={exportCsv} disabled={!data?.items.length}>
          Export CSV
        </Button>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New deal
        </Button>
      </FilterBar>

      <ErrorNote error={error} />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    'px-3 py-2 text-xs font-medium text-ink-2',
                    column.align === 'right' && 'text-right',
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.sortable!)}
                      className="hover:text-ink"
                    >
                      {column.label}
                      {sort.replace('-', '') === column.sortable && (
                        <span aria-hidden> {sort.startsWith('-') ? '↓' : '↑'}</span>
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((deal) => (
              <tr key={deal.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <Link to={`/deals/${deal.id}`} className="font-medium text-ink hover:underline">
                    {deal.name}
                  </Link>
                  {deal.status !== 'active' && (
                    <span className="ml-2 text-xs text-muted">{humanize(deal.status)}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Pill color={deal.stage.color}>{deal.stage.name}</Pill>
                </td>
                <td className="px-3 py-2 text-ink-2">{humanize(deal.property_type)}</td>
                <td className="px-3 py-2 text-ink-2">{deal.market ?? '—'}</td>
                <td className="tabular px-3 py-2 text-right">{money(deal.deal_value)}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">
                  {deal.effective_probability}%
                </td>
                <td className="tabular px-3 py-2 text-right">{money(deal.weighted_value)}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">
                  {rate(deal.going_in_cap_rate)}
                </td>
                <td className="px-3 py-2 text-ink-2">{deal.owner?.name ?? '—'}</td>
                <td className="px-3 py-2 text-ink-2">{day(deal.expected_close_date)}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">{deal.days_in_stage}d</td>
                <td className="tabular px-3 py-2 text-right">
                  {deal.overdue_task_count > 0 ? (
                    <span className="text-critical">⚑ {deal.overdue_task_count}</span>
                  ) : (
                    <span className="text-ink-2">{deal.open_task_count || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <Spinner />}
        {!isLoading && data?.items.length === 0 && (
          <EmptyState>No deals match these filters.</EmptyState>
        )}
      </Card>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <span className="tabular text-sm text-ink-2">
            Page {data.page} of {data.pages}
          </span>
          <Button disabled={data.page <= 1} onClick={() => setParam('page', String(data.page - 1))}>
            Previous
          </Button>
          <Button
            disabled={data.page >= data.pages}
            onClick={() => setParam('page', String(data.page + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {creating && <NewDealModal onClose={() => setCreating(false)} />}
    </div>
  )
}
