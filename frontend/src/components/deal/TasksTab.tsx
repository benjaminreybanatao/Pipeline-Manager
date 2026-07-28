import { useState } from 'react'
import { useCreateTask, useDealTasks, useDeleteTask, useUpdateTask, useUsers } from '../../api/hooks'
import { TASK_PRIORITIES } from '../../lib/constants'
import { day, humanize } from '../../lib/format'
import type { Task } from '../../types'
import { Button, Card, EmptyState, ErrorNote, Input, Select, Spinner, cx } from '../ui'

function TaskRow({ task, dealId }: { task: Task; dealId: number }) {
  const updateTask = useUpdateTask(dealId)
  const deleteTask = useDeleteTask(dealId)
  const done = task.status === 'done'

  return (
    <li className="flex items-start gap-3 border-b border-line px-3 py-2 last:border-0">
      <input
        type="checkbox"
        className="mt-1"
        checked={done}
        aria-label={`Mark "${task.title}" ${done ? 'open' : 'done'}`}
        onChange={() =>
          updateTask.mutate({ taskId: task.id, body: { status: done ? 'open' : 'done' } })
        }
      />
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm', done ? 'text-muted line-through' : 'text-ink')}>{task.title}</p>
        <p className="tabular mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
          {task.due_date && (
            <span className={task.is_overdue ? 'text-critical' : undefined}>
              {task.is_overdue && <span aria-hidden>⚑ </span>}
              Due {day(task.due_date)}
            </span>
          )}
          <span>{task.assignee ? task.assignee.name : 'Unassigned'}</span>
          {task.priority !== 'normal' && <span>{humanize(task.priority)} priority</span>}
        </p>
      </div>
      <Select
        className="w-32"
        aria-label="Status"
        value={task.status}
        onChange={(event) => updateTask.mutate({ taskId: task.id, body: { status: event.target.value } })}
      >
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
      </Select>
      <Button variant="ghost" aria-label="Delete task" onClick={() => deleteTask.mutate(task.id)}>
        ✕
      </Button>
    </li>
  )
}

export function TasksTab({ dealId }: { dealId: number }) {
  const { data: tasks, isLoading } = useDealTasks(dealId)
  const { data: users } = useUsers()
  const createTask = useCreateTask(dealId)
  const [form, setForm] = useState({ title: '', due_date: '', assignee_id: '', priority: 'normal' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await createTask.mutateAsync({
      title: form.title.trim(),
      due_date: form.due_date || null,
      assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      priority: form.priority,
    })
    setForm({ title: '', due_date: '', assignee_id: '', priority: 'normal' })
  }

  const open = tasks?.filter((task) => task.status !== 'done') ?? []
  const done = tasks?.filter((task) => task.status === 'done') ?? []

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Input
            className="min-w-56 flex-1"
            placeholder="Add a task…"
            aria-label="Task title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
          <Input
            className="w-40"
            type="date"
            aria-label="Due date"
            value={form.due_date}
            onChange={(event) => setForm({ ...form, due_date: event.target.value })}
          />
          <Select
            className="w-44"
            aria-label="Assignee"
            value={form.assignee_id}
            onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}
          >
            <option value="">Unassigned</option>
            {users?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-32"
            aria-label="Priority"
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {humanize(priority)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" disabled={!form.title.trim() || createTask.isPending}>
            Add task
          </Button>
        </form>
        <ErrorNote error={createTask.error} />
      </Card>

      <Card>
        {isLoading && <Spinner />}
        {!isLoading && open.length === 0 && <EmptyState>No open tasks.</EmptyState>}
        <ul>
          {open.map((task) => (
            <TaskRow key={task.id} task={task} dealId={dealId} />
          ))}
        </ul>
      </Card>

      {done.length > 0 && (
        <Card>
          <p className="border-b border-edge px-3 py-2 text-xs font-medium text-ink-2">
            Completed ({done.length})
          </p>
          <ul>
            {done.map((task) => (
              <TaskRow key={task.id} task={task} dealId={dealId} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
