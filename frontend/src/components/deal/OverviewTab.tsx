import { useEffect, useState } from 'react'
import { useUpdateDeal, useUsers } from '../../api/hooks'
import { DEAL_SOURCES, DEAL_STATUSES, DEAL_TYPES, PROPERTY_TYPES } from '../../lib/constants'
import { humanize, money, rate } from '../../lib/format'
import type { DealDetail } from '../../types'
import { Button, Card, ErrorNote, Field, Input, Select, Textarea } from '../ui'

/** Text inputs hold strings; empty means "clear it". */
type FormState = Record<string, string>

const TEXT_FIELDS = [
  'name',
  'address',
  'city',
  'state',
  'zip',
  'market',
  'submarket',
  'broker_name',
  'broker_firm',
  'seller_name',
  'lost_reason',
] as const

const NUMBER_FIELDS = ['square_feet', 'units', 'year_built', 'probability'] as const

const MONEY_FIELDS = [
  'asking_price',
  'offer_price',
  'purchase_price',
  'noi',
  'loan_amount',
  'equity_required',
] as const

const DECIMAL_FIELDS = [
  'going_in_cap_rate',
  'stabilized_cap_rate',
  'target_irr',
  'target_equity_multiple',
  'ltv',
  'acres',
] as const

const DATE_FIELDS = ['date_sourced', 'expected_close_date', 'actual_close_date'] as const

const ENUM_FIELDS = ['deal_type', 'property_type', 'status', 'source'] as const

const ALL_FIELDS = [
  ...TEXT_FIELDS,
  ...NUMBER_FIELDS,
  ...MONEY_FIELDS,
  ...DECIMAL_FIELDS,
  ...DATE_FIELDS,
  ...ENUM_FIELDS,
  'owner_id',
] as const

function toForm(deal: DealDetail): FormState {
  const form: FormState = {}
  for (const field of ALL_FIELDS) {
    const value = (deal as unknown as Record<string, unknown>)[field]
    form[field] = value === null || value === undefined ? '' : String(value)
  }
  return form
}

export function OverviewTab({ deal }: { deal: DealDetail }) {
  const { data: users } = useUsers()
  const updateDeal = useUpdateDeal(deal.id)
  const [form, setForm] = useState<FormState>(() => toForm(deal))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(toForm(deal))
  }, [deal])

  const original = toForm(deal)
  const dirtyFields = ALL_FIELDS.filter((field) => form[field] !== original[field])

  function set(field: string, value: string) {
    setSaved(false)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const body: Record<string, unknown> = {}
    for (const field of dirtyFields) {
      const raw = form[field]
      if (raw === '') {
        body[field] = null
      } else if ((NUMBER_FIELDS as readonly string[]).includes(field) || field === 'owner_id') {
        body[field] = Number(raw)
      } else {
        body[field] = raw
      }
    }
    await updateDeal.mutateAsync(body)
    setSaved(true)
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Identification</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Deal name">
            <Input value={form.name} onChange={(event) => set('name', event.target.value)} required />
          </Field>
          <Field label="Property type">
            <Select
              value={form.property_type}
              onChange={(event) => set('property_type', event.target.value)}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deal type">
            <Select value={form.deal_type} onChange={(event) => set('deal_type', event.target.value)}>
              {DEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(event) => set('status', event.target.value)}>
              {DEAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={form.owner_id} onChange={(event) => set('owner_id', event.target.value)}>
              <option value="">Unassigned</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Probability override (%)">
            <Input
              type="number"
              min="0"
              max="100"
              placeholder={`${deal.stage.default_probability} (stage default)`}
              value={form.probability}
              onChange={(event) => set('probability', event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Location & physical</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Address">
            <Input value={form.address} onChange={(event) => set('address', event.target.value)} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(event) => set('city', event.target.value)} />
          </Field>
          <Field label="State">
            <Input
              maxLength={2}
              value={form.state}
              onChange={(event) => set('state', event.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Market">
            <Input value={form.market} onChange={(event) => set('market', event.target.value)} />
          </Field>
          <Field label="Submarket">
            <Input value={form.submarket} onChange={(event) => set('submarket', event.target.value)} />
          </Field>
          <Field label="Zip">
            <Input value={form.zip} onChange={(event) => set('zip', event.target.value)} />
          </Field>
          <Field label="Units">
            <Input
              type="number"
              value={form.units}
              onChange={(event) => set('units', event.target.value)}
            />
          </Field>
          <Field label="Square feet">
            <Input
              type="number"
              value={form.square_feet}
              onChange={(event) => set('square_feet', event.target.value)}
            />
          </Field>
          <Field label="Year built">
            <Input
              type="number"
              value={form.year_built}
              onChange={(event) => set('year_built', event.target.value)}
            />
          </Field>
        </div>
        <p className="tabular mt-3 text-xs text-muted">
          {money(deal.price_per_unit, false)} / unit · {money(deal.price_per_sf, false)} / SF
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Economics</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Asking price ($)">
            <Input
              type="number"
              value={form.asking_price}
              onChange={(event) => set('asking_price', event.target.value)}
            />
          </Field>
          <Field label="Offer price ($)">
            <Input
              type="number"
              value={form.offer_price}
              onChange={(event) => set('offer_price', event.target.value)}
            />
          </Field>
          <Field label="Purchase price ($)">
            <Input
              type="number"
              value={form.purchase_price}
              onChange={(event) => set('purchase_price', event.target.value)}
            />
          </Field>
          <Field label="NOI ($)">
            <Input type="number" value={form.noi} onChange={(event) => set('noi', event.target.value)} />
          </Field>
          <Field label={`Going-in cap (decimal — now ${rate(deal.going_in_cap_rate)})`}>
            <Input
              type="number"
              step="0.0001"
              value={form.going_in_cap_rate}
              onChange={(event) => set('going_in_cap_rate', event.target.value)}
            />
          </Field>
          <Field label={`Stabilized cap (decimal — now ${rate(deal.stabilized_cap_rate)})`}>
            <Input
              type="number"
              step="0.0001"
              value={form.stabilized_cap_rate}
              onChange={(event) => set('stabilized_cap_rate', event.target.value)}
            />
          </Field>
          <Field label={`Target IRR (decimal — now ${rate(deal.target_irr, 1)})`}>
            <Input
              type="number"
              step="0.0001"
              value={form.target_irr}
              onChange={(event) => set('target_irr', event.target.value)}
            />
          </Field>
          <Field label="Target equity multiple (x)">
            <Input
              type="number"
              step="0.01"
              value={form.target_equity_multiple}
              onChange={(event) => set('target_equity_multiple', event.target.value)}
            />
          </Field>
          <Field label={`LTV (decimal — now ${rate(deal.ltv, 1)})`}>
            <Input
              type="number"
              step="0.0001"
              value={form.ltv}
              onChange={(event) => set('ltv', event.target.value)}
            />
          </Field>
          <Field label="Loan amount ($)">
            <Input
              type="number"
              value={form.loan_amount}
              onChange={(event) => set('loan_amount', event.target.value)}
            />
          </Field>
          <Field label="Equity required ($)">
            <Input
              type="number"
              value={form.equity_required}
              onChange={(event) => set('equity_required', event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">Process & counterparties</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date sourced">
            <Input
              type="date"
              value={form.date_sourced}
              onChange={(event) => set('date_sourced', event.target.value)}
            />
          </Field>
          <Field label="Expected close">
            <Input
              type="date"
              value={form.expected_close_date}
              onChange={(event) => set('expected_close_date', event.target.value)}
            />
          </Field>
          <Field label="Actual close">
            <Input
              type="date"
              value={form.actual_close_date}
              onChange={(event) => set('actual_close_date', event.target.value)}
            />
          </Field>
          <Field label="Source">
            <Select value={form.source} onChange={(event) => set('source', event.target.value)}>
              <option value="">Unspecified</option>
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
              onChange={(event) => set('broker_name', event.target.value)}
            />
          </Field>
          <Field label="Brokerage">
            <Input
              value={form.broker_firm}
              onChange={(event) => set('broker_firm', event.target.value)}
            />
          </Field>
          <Field label="Seller">
            <Input
              value={form.seller_name}
              onChange={(event) => set('seller_name', event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Lost / passed reason">
            <Textarea
              value={form.lost_reason}
              onChange={(event) => set('lost_reason', event.target.value)}
            />
          </Field>
        </div>
      </Card>

      <ErrorNote error={updateDeal.error} />

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-edge bg-surface py-3">
        {saved && dirtyFields.length === 0 && <span className="text-sm text-good">Saved</span>}
        {dirtyFields.length > 0 && (
          <span className="text-sm text-ink-2">{dirtyFields.length} unsaved change(s)</span>
        )}
        <Button onClick={() => setForm(toForm(deal))} disabled={dirtyFields.length === 0}>
          Revert
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={dirtyFields.length === 0 || updateDeal.isPending}
        >
          {updateDeal.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
