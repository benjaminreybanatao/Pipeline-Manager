import { useState } from 'react'
import { useCreateMilestone, useMilestones, useUpdateMilestone } from '../../api/hooks'
import { day, daysUntil } from '../../lib/format'
import type { Milestone } from '../../types'
import { Button, Card, EmptyState, ErrorNote, Input, Spinner, cx } from '../ui'

function statusOf(milestone: Milestone): { label: string; className: string } {
  if (milestone.actual_date) return { label: 'Hit', className: 'text-good' }
  if (milestone.is_overdue) return { label: 'Overdue', className: 'text-critical' }
  const days = daysUntil(milestone.target_date)
  if (days !== null && days <= 7) return { label: `In ${days}d`, className: 'text-serious' }
  return { label: 'Upcoming', className: 'text-ink-2' }
}

export function MilestonesTab({ dealId }: { dealId: number }) {
  const { data: milestones, isLoading } = useMilestones(dealId)
  const updateMilestone = useUpdateMilestone(dealId)
  const createMilestone = useCreateMilestone(dealId)
  const [form, setForm] = useState({ name: '', target_date: '' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await createMilestone.mutateAsync({
      name: form.name.trim(),
      target_date: form.target_date || null,
    })
    setForm({ name: '', target_date: '' })
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Input
            className="min-w-56 flex-1"
            placeholder="Add a milestone…"
            aria-label="Milestone name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            className="w-40"
            type="date"
            aria-label="Target date"
            value={form.target_date}
            onChange={(event) => setForm({ ...form, target_date: event.target.value })}
          />
          <Button type="submit" variant="primary" disabled={!form.name.trim()}>
            Add milestone
          </Button>
        </form>
        <ErrorNote error={createMilestone.error} />
      </Card>

      <Card>
        {isLoading && <Spinner />}
        {!isLoading && milestones?.length === 0 && <EmptyState>No milestones yet.</EmptyState>}
        <ol>
          {milestones?.map((milestone) => {
            const status = statusOf(milestone)
            return (
              <li
                key={milestone.id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
              >
                <span
                  aria-hidden
                  className={cx(
                    'h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface',
                    milestone.actual_date
                      ? 'bg-good'
                      : milestone.is_overdue
                        ? 'bg-critical'
                        : 'bg-baseline',
                  )}
                />
                <div className="min-w-40 flex-1">
                  <p className="text-sm text-ink">
                    {milestone.name}
                    {milestone.is_critical && (
                      <span className="ml-2 text-xs text-muted">critical path</span>
                    )}
                  </p>
                  <p className="tabular text-xs text-ink-2">Target {day(milestone.target_date)}</p>
                </div>
                <span className={cx('w-20 text-xs font-medium', status.className)}>{status.label}</span>
                <label className="text-xs text-ink-2">
                  <span className="sr-only">Completed on</span>
                  <Input
                    className="w-40"
                    type="date"
                    value={milestone.actual_date ?? ''}
                    onChange={(event) =>
                      updateMilestone.mutate({
                        milestoneId: milestone.id,
                        body: { actual_date: event.target.value || null },
                      })
                    }
                  />
                </label>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
