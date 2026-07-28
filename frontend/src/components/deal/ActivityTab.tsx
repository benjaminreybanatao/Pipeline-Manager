import { useState } from 'react'
import { useActivities, useAddNote, useDealHistory } from '../../api/hooks'
import { dateTime, day } from '../../lib/format'
import type { ActivityType } from '../../types'
import { Avatar, Button, Card, EmptyState, ErrorNote, Spinner, Textarea } from '../ui'

const ICONS: Record<ActivityType, string> = {
  created: '✦',
  note: '✎',
  stage_change: '→',
  field_change: '±',
  task: '☑',
  milestone: '◆',
  document: '🔗',
  team: '👤',
}

export function ActivityTab({ dealId }: { dealId: number }) {
  const { data: activities, isLoading } = useActivities(dealId)
  const { data: history } = useDealHistory(dealId)
  const addNote = useAddNote(dealId)
  const [note, setNote] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await addNote.mutateAsync(note.trim())
    setNote('')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <Card className="p-3">
          <form onSubmit={submit} className="space-y-2">
            <Textarea
              className="w-full"
              placeholder="Add a note for the team…"
              aria-label="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!note.trim() || addNote.isPending}>
                Post note
              </Button>
            </div>
          </form>
          <ErrorNote error={addNote.error} />
        </Card>

        <Card>
          {isLoading && <Spinner />}
          {!isLoading && activities?.length === 0 && <EmptyState>Nothing logged yet.</EmptyState>}
          <ul>
            {activities?.map((activity) => (
              <li
                key={activity.id}
                className="flex gap-3 border-b border-line px-3 py-2.5 last:border-0"
              >
                <span aria-hidden className="mt-0.5 w-4 text-center text-sm text-muted">
                  {ICONS[activity.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{activity.body}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {activity.user && <Avatar name={activity.user.name} />}
                    {activity.user?.name ?? 'System'} · {dateTime(activity.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="h-fit p-3">
        <h3 className="mb-2 text-sm font-semibold text-ink">Stage history</h3>
        <ol className="space-y-2.5">
          {history?.map((row) => (
            <li key={row.id} className="border-l-2 border-line pl-3">
              <p className="text-sm text-ink">{row.to_stage.name}</p>
              <p className="tabular text-xs text-ink-2">
                {day(row.entered_at)}
                {row.days_in_stage !== null ? ` · ${row.days_in_stage}d` : ' · current'}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
