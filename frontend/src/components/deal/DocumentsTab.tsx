import { useState } from 'react'
import { useCreateDocument, useDeleteDocument, useDocuments } from '../../api/hooks'
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from '../../lib/constants'
import { day } from '../../lib/format'
import { Button, Card, EmptyState, ErrorNote, Input, Select, Spinner } from '../ui'

/** Documents are links (SharePoint, Dropbox, a data room) — nothing is uploaded here. */
export function DocumentsTab({ dealId }: { dealId: number }) {
  const { data: documents, isLoading } = useDocuments(dealId)
  const createDocument = useCreateDocument(dealId)
  const deleteDocument = useDeleteDocument(dealId)
  const [form, setForm] = useState({ name: '', url: '', category: 'om' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await createDocument.mutateAsync({ ...form, name: form.name.trim(), url: form.url.trim() })
    setForm({ name: '', url: '', category: 'om' })
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <Input
            className="w-56"
            placeholder="Document name"
            aria-label="Document name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            className="min-w-64 flex-1"
            type="url"
            placeholder="https://…"
            aria-label="Document link"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            required
          />
          <Select
            className="w-52"
            aria-label="Category"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            {DOCUMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {DOCUMENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" disabled={!form.name.trim() || !form.url.trim()}>
            Link document
          </Button>
        </form>
        <ErrorNote error={createDocument.error} />
      </Card>

      <Card>
        {isLoading && <Spinner />}
        {!isLoading && documents?.length === 0 && <EmptyState>No documents linked yet.</EmptyState>}
        <ul>
          {documents?.map((document) => (
            <li
              key={document.id}
              className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-ink hover:underline"
                >
                  {document.name}
                </a>
                <p className="truncate text-xs text-ink-2">
                  {DOCUMENT_CATEGORY_LABELS[document.category]} ·{' '}
                  {document.added_by?.name ?? 'Unknown'} · {day(document.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label={`Remove ${document.name}`}
                onClick={() => deleteDocument.mutate(document.id)}
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
