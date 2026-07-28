import { useState } from 'react'
import {
  useCreateStage,
  useCreateUser,
  useDeleteStage,
  useReorderStages,
  useStages,
  useUpdateStage,
  useUsers,
} from '../api/hooks'
import { Avatar, Button, Card, ErrorNote, Field, Input, Select, Spinner } from '../components/ui'
import { humanize } from '../lib/format'
import type { Stage, StageCategory } from '../types'

const CATEGORIES: StageCategory[] = ['open', 'won', 'lost']

function StageRow({ stage, index, count }: { stage: Stage; index: number; count: number }) {
  const { data: stages } = useStages()
  const updateStage = useUpdateStage()
  const reorder = useReorderStages()
  const deleteStage = useDeleteStage()

  function move(direction: -1 | 1) {
    if (!stages) return
    const ids = stages.map((s) => s.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  return (
    <li className="flex flex-wrap items-end gap-2 border-b border-line px-3 py-2.5 last:border-0">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-label={`Move ${stage.name} up`}
          disabled={index === 0}
          onClick={() => move(-1)}
          className="rounded px-1 text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-30"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Move ${stage.name} down`}
          disabled={index === count - 1}
          onClick={() => move(1)}
          className="rounded px-1 text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-30"
        >
          ▼
        </button>
      </div>
      <label className="flex-1">
        <span className="mb-1 block text-xs text-muted">Name</span>
        <Input
          className="min-w-40"
          defaultValue={stage.name}
          onBlur={(event) =>
            event.target.value !== stage.name &&
            updateStage.mutate({ stageId: stage.id, body: { name: event.target.value } })
          }
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">Default probability</span>
        <Input
          className="w-28"
          type="number"
          min="0"
          max="100"
          defaultValue={stage.default_probability}
          onBlur={(event) =>
            Number(event.target.value) !== stage.default_probability &&
            updateStage.mutate({
              stageId: stage.id,
              body: { default_probability: Number(event.target.value) },
            })
          }
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">Category</span>
        <Select
          className="w-28"
          value={stage.category}
          onChange={(event) =>
            updateStage.mutate({ stageId: stage.id, body: { category: event.target.value } })
          }
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {humanize(category)}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted">Color</span>
        <input
          type="color"
          aria-label={`${stage.name} color`}
          defaultValue={stage.color}
          onBlur={(event) =>
            event.target.value !== stage.color &&
            updateStage.mutate({ stageId: stage.id, body: { color: event.target.value } })
          }
          className="h-8 w-12 cursor-pointer rounded border border-edge bg-surface"
        />
      </label>
      <Button
        variant="danger"
        onClick={() => deleteStage.mutate(stage.id)}
        title="Only stages no deal has ever touched can be deleted"
      >
        Delete
      </Button>
      <ErrorNote error={deleteStage.error} />
    </li>
  )
}

function StageSettings() {
  const { data: stages, isLoading } = useStages()
  const createStage = useCreateStage()
  const [form, setForm] = useState({ name: '', default_probability: '50', category: 'open' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await createStage.mutateAsync({
      name: form.name.trim(),
      default_probability: Number(form.default_probability),
      category: form.category,
    })
    setForm({ name: '', default_probability: '50', category: 'open' })
  }

  return (
    <Card>
      <div className="border-b border-edge px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Pipeline stages</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Order here is the order on the board. Won and lost categories close a deal automatically
          when it lands there.
        </p>
      </div>
      {isLoading && <Spinner />}
      <ul>
        {stages?.map((stage, index) => (
          <StageRow key={stage.id} stage={stage} index={index} count={stages.length} />
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-edge p-3">
        <Field label="New stage" className="w-56">
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="e.g. IC Review"
            required
          />
        </Field>
        <Field label="Default probability" className="w-28">
          <Input
            type="number"
            min="0"
            max="100"
            value={form.default_probability}
            onChange={(event) => setForm({ ...form, default_probability: event.target.value })}
          />
        </Field>
        <Field label="Category" className="w-28">
          <Select
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {humanize(category)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={!form.name.trim()}>
          Add stage
        </Button>
        <ErrorNote error={createStage.error} />
      </form>
    </Card>
  )
}

function UserSettings() {
  const { data: users, isLoading } = useUsers()
  const createUser = useCreateUser()
  const [form, setForm] = useState({ name: '', email: '', title: '' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await createUser.mutateAsync({
      name: form.name.trim(),
      email: form.email.trim(),
      title: form.title.trim() || undefined,
    })
    setForm({ name: '', email: '', title: '' })
  }

  return (
    <Card>
      <div className="border-b border-edge px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Team</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          There is no login yet — pick who you are acting as in the header. Everything you do is
          attributed to that person in the activity log.
        </p>
      </div>
      {isLoading && <Spinner />}
      <ul>
        {users?.map((user) => (
          <li
            key={user.id}
            className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
          >
            <Avatar name={user.name} />
            <div className="flex-1">
              <p className="text-sm text-ink">{user.name}</p>
              <p className="text-xs text-ink-2">{user.title ?? user.email}</p>
            </div>
            <span className="text-xs text-muted">{user.email}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-edge p-3">
        <Field label="Name" className="w-48">
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </Field>
        <Field label="Email" className="w-56">
          <Input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </Field>
        <Field label="Title" className="w-56">
          <Input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={!form.name.trim() || !form.email.trim()}>
          Add teammate
        </Button>
        <ErrorNote error={createUser.error} />
      </form>
    </Card>
  )
}

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">Settings</h1>
      <StageSettings />
      <UserSettings />
    </div>
  )
}
