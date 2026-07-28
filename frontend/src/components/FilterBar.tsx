import { useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useMarkets, useUsers } from '../api/hooks'
import { DEAL_STATUSES, PROPERTY_TYPES } from '../lib/constants'
import { humanize } from '../lib/format'
import type { DealFilters } from '../types'
import { Button, Input, Select } from './ui'

/**
 * Filters live in the URL so the Pipeline board and the Deals table stay in
 * sync and a filtered view can be pasted into Slack.
 */
export function useDealFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<DealFilters>(() => {
    const q = params.get('q') ?? undefined
    const market = params.getAll('market')
    const propertyType = params.getAll('property_type')
    const status = params.getAll('status')
    const ownerId = params.getAll('owner_id').map(Number).filter(Number.isFinite)
    const minPrice = params.get('min_price')
    return {
      q,
      market: market.length ? market : undefined,
      property_type: propertyType.length ? (propertyType as DealFilters['property_type']) : undefined,
      status: status.length ? (status as DealFilters['status']) : undefined,
      owner_id: ownerId.length ? ownerId : undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
    }
  }, [params])

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    next.delete(key)
    if (value) next.append(key, value)
    next.delete('page')
    setParams(next, { replace: true })
  }

  function clear() {
    const next = new URLSearchParams(params)
    for (const key of ['q', 'market', 'property_type', 'status', 'owner_id', 'min_price']) {
      next.delete(key)
    }
    setParams(next, { replace: true })
  }

  const activeCount = ['q', 'market', 'property_type', 'status', 'owner_id', 'min_price'].filter(
    (key) => params.get(key),
  ).length

  return { filters, params, setParams, setFilter, clear, activeCount }
}

export function FilterBar({ children }: { children?: React.ReactNode }) {
  const { params, setFilter, clear, activeCount } = useDealFilters()
  const { data: markets } = useMarkets()
  const { data: users } = useUsers()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-56"
        type="search"
        placeholder="Search deals, brokers, markets…"
        aria-label="Search deals"
        value={params.get('q') ?? ''}
        onChange={(event) => setFilter('q', event.target.value)}
      />
      <Select
        className="w-40"
        aria-label="Market"
        value={params.get('market') ?? ''}
        onChange={(event) => setFilter('market', event.target.value)}
      >
        <option value="">All markets</option>
        {markets?.map((market) => (
          <option key={market} value={market}>
            {market}
          </option>
        ))}
      </Select>
      <Select
        className="w-44"
        aria-label="Property type"
        value={params.get('property_type') ?? ''}
        onChange={(event) => setFilter('property_type', event.target.value)}
      >
        <option value="">All property types</option>
        {PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>
            {humanize(type)}
          </option>
        ))}
      </Select>
      <Select
        className="w-36"
        aria-label="Status"
        value={params.get('status') ?? ''}
        onChange={(event) => setFilter('status', event.target.value)}
      >
        <option value="">All statuses</option>
        {DEAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {humanize(status)}
          </option>
        ))}
      </Select>
      <Select
        className="w-40"
        aria-label="Owner"
        value={params.get('owner_id') ?? ''}
        onChange={(event) => setFilter('owner_id', event.target.value)}
      >
        <option value="">All owners</option>
        {users?.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </Select>
      {activeCount > 0 && (
        <Button variant="ghost" onClick={clear}>
          Clear filters ({activeCount})
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  )
}
