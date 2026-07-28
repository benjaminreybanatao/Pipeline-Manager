import { differenceInCalendarDays, format, parseISO } from 'date-fns'

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const fullUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function money(value: string | number | null | undefined, compact = true): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return compact ? compactUsd.format(n) : fullUsd.format(n)
}

export function number(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

/** Rates arrive as decimals (0.0525) and read as percentages (5.25%). */
export function rate(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(digits)}%`
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function day(value: string | null | undefined): string {
  if (!value) return '—'
  return format(parseISO(value), 'MMM d, yyyy')
}

export function dayShort(value: string | null | undefined): string {
  if (!value) return '—'
  return format(parseISO(value), 'MMM d')
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return format(parseISO(value), 'MMM d, yyyy · h:mm a')
}

export function monthLabel(value: string): string {
  return format(parseISO(`${value}-01`), 'MMM yy')
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  return differenceInCalendarDays(parseISO(value), new Date())
}

/** `mixed_use` → `Mixed use`. Used for every enum coming off the API. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
