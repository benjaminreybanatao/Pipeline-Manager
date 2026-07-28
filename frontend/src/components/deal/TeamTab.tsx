import { useState } from 'react'
import { useAddTeamMember, useRemoveTeamMember, useTeam, useUsers } from '../../api/hooks'
import { TEAM_ROLES } from '../../lib/constants'
import { humanize } from '../../lib/format'
import { Avatar, Button, Card, EmptyState, ErrorNote, Select, Spinner } from '../ui'

export function TeamTab({ dealId }: { dealId: number }) {
  const { data: team, isLoading } = useTeam(dealId)
  const { data: users } = useUsers()
  const addMember = useAddTeamMember(dealId)
  const removeMember = useRemoveTeamMember(dealId)
  const [form, setForm] = useState({ user_id: '', role: 'analyst' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.user_id) return
    await addMember.mutateAsync({ user_id: Number(form.user_id), role: form.role })
    setForm({ user_id: '', role: 'analyst' })
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Select
            className="w-56"
            aria-label="Teammate"
            value={form.user_id}
            onChange={(event) => setForm({ ...form, user_id: event.target.value })}
          >
            <option value="">Select a teammate…</option>
            {users?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-48"
            aria-label="Role"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            {TEAM_ROLES.map((role) => (
              <option key={role} value={role}>
                {humanize(role)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" disabled={!form.user_id}>
            Add to deal team
          </Button>
        </form>
        <ErrorNote error={addMember.error} />
      </Card>

      <Card>
        {isLoading && <Spinner />}
        {!isLoading && team?.length === 0 && <EmptyState>Nobody assigned yet.</EmptyState>}
        <ul>
          {team?.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
            >
              <Avatar name={member.user.name} />
              <div className="flex-1">
                <p className="text-sm text-ink">{member.user.name}</p>
                <p className="text-xs text-ink-2">{member.user.title ?? member.user.email}</p>
              </div>
              <span className="text-xs text-ink-2">{humanize(member.role)}</span>
              <Button
                variant="ghost"
                aria-label={`Remove ${member.user.name}`}
                onClick={() => removeMember.mutate(member.id)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
