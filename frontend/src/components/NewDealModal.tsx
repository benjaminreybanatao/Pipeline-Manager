import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateDeal, useStages, useUsers } from '../api/hooks'
import { DEAL_SOURCES, DEAL_TYPES, PROPERTY_TYPES } from '../lib/constants'
import { humanize } from '../lib/format'
import { Button, ErrorNote, Field, Input, Modal, Select } from './ui'

/** Only the fields worth typing when a deal first lands; the rest are editable
 *  on the deal record once it exists. */
export function NewDealModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { data: stages } = useStages()
  const { data: users } = useUsers()
  const createDeal = useCreateDeal()

  const [form, setForm] = useState({
    name: '',
    property_type: 'multifamily',
    deal_type: 'acquisition',
    market: '',
    state: '',
    asking_price: '',
    units: '',
    square_feet: '',
    source: 'broker',
    broker_name: '',
    owner_id: '',
    stage_id: '',
    expected_close_date: '',
  })

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      property_type: form.property_type,
      deal_type: form.deal_type,
      source: form.source,
    }
    if (form.market) body.market = form.market
    if (form.state) body.state = form.state.toUpperCase().slice(0, 2)
    if (form.asking_price) body.asking_price = form.asking_price
    if (form.units) body.units = Number(form.units)
    if (form.square_feet) body.square_feet = Number(form.square_feet)
    if (form.broker_name) body.broker_name = form.broker_name
    if (form.owner_id) body.owner_id = Number(form.owner_id)
    if (form.stage_id) body.stage_id = Number(form.stage_id)
    if (form.expected_close_date) body.expected_close_date = form.expected_close_date

    const deal = await createDeal.mutateAsync(body)
    onClose()
    navigate(`/deals/${deal.id}`)
  }

  const openStages = stages?.filter((stage) => stage.category === 'open') ?? []

  return (
    <Modal title="New deal" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Deal name">
          <Input
            required
            autoFocus
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Cedar Ridge Apartments"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Property type">
            <Select
              value={form.property_type}
              onChange={(event) => update('property_type', event.target.value)}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deal type">
            <Select value={form.deal_type} onChange={(event) => update('deal_type', event.target.value)}>
              {DEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starting stage">
            <Select value={form.stage_id} onChange={(event) => update('stage_id', event.target.value)}>
              <option value="">{openStages[0]?.name ?? 'First stage'}</option>
              {openStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Market">
            <Input value={form.market} onChange={(event) => update('market', event.target.value)} />
          </Field>
          <Field label="State">
            <Input
              maxLength={2}
              value={form.state}
              onChange={(event) => update('state', event.target.value)}
              placeholder="TX"
            />
          </Field>
          <Field label="Asking price ($)">
            <Input
              type="number"
              min="0"
              step="1000"
              value={form.asking_price}
              onChange={(event) => update('asking_price', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Units">
            <Input
              type="number"
              min="0"
              value={form.units}
              onChange={(event) => update('units', event.target.value)}
            />
          </Field>
          <Field label="Square feet">
            <Input
              type="number"
              min="0"
              value={form.square_feet}
              onChange={(event) => update('square_feet', event.target.value)}
            />
          </Field>
          <Field label="Expected close">
            <Input
              type="date"
              value={form.expected_close_date}
              onChange={(event) => update('expected_close_date', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Source">
            <Select value={form.source} onChange={(event) => update('source', event.target.value)}>
              {DEAL_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {humanize(source)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Broker">
            <Input
              value={form.broker_name}
              onChange={(event) => update('broker_name', event.target.value)}
            />
          </Field>
          <Field label="Owner">
            <Select value={form.owner_id} onChange={(event) => update('owner_id', event.target.value)}>
              <option value="">You</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <ErrorNote error={createDeal.error} />

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={createDeal.isPending || !form.name.trim()}>
            {createDeal.isPending ? 'Creating…' : 'Create deal'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
