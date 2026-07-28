/**
 * The demo backend.
 *
 * In the demo build there is no server, so this module answers the same routes
 * the FastAPI app does, against an in-memory copy of the seeded pipeline. It is
 * deliberately a *reimplementation* of the derived values rather than a dump of
 * them: the fixture carries raw columns only, so weighted value, stage aging,
 * conversion and every dashboard figure are computed here the same way
 * `app/services/metrics.py` computes them server-side.
 *
 * Mutations persist to localStorage so a drag survives a refresh.
 */

import seed from './seed.json'
import type {
  Activity,
  Deal,
  DealDocument,
  Milestone,
  Stage,
  StageCategory,
  Task,
  User,
} from '../types'

const STORAGE_KEY = 'pipeline.demo.state'
const DAY = 86_400_000
const STALE_DAYS = 45

type Row = Record<string, unknown>

interface State {
  users: Row[]
  stages: Row[]
  deals: Row[]
  team: Row[]
  stage_history: Row[]
  tasks: Row[]
  milestones: Row[]
  documents: Row[]
  activities: Row[]
}

const TABLES: (keyof State)[] = [
  'users',
  'stages',
  'deals',
  'team',
  'stage_history',
  'tasks',
  'milestones',
  'documents',
  'activities',
]

/** Which columns hold a timestamp, and which hold a plain calendar date. */
const DATETIME_FIELDS: Record<string, string[]> = {
  users: ['created_at'],
  deals: ['stage_entered_at', 'created_at', 'updated_at'],
  stage_history: ['entered_at', 'exited_at'],
  tasks: ['completed_at', 'created_at'],
  documents: ['created_at'],
  activities: ['created_at'],
}

const DATE_FIELDS: Record<string, string[]> = {
  deals: ['date_sourced', 'expected_close_date', 'actual_close_date'],
  tasks: ['due_date'],
  milestones: ['target_date', 'actual_date'],
}

// ---------------------------------------------------------------- date shifting

/**
 * Slide the whole fixture forward by however long ago it was generated, so the
 * board reads as "today" whenever someone opens the demo — aging badges, the
 * closing-this-quarter tile and overdue tasks all stay meaningful.
 */
function shiftFixture(raw: State & { generated_at: string }): State {
  const deltaMs = Date.now() - new Date(raw.generated_at).getTime()
  const deltaDays = Math.round(deltaMs / DAY)
  const state = {} as State

  for (const table of TABLES) {
    state[table] = (raw[table] ?? []).map((row) => {
      const next: Row = { ...row }
      for (const field of DATETIME_FIELDS[table] ?? []) {
        const value = next[field]
        if (typeof value === 'string') {
          next[field] = new Date(new Date(value).getTime() + deltaMs).toISOString()
        }
      }
      for (const field of DATE_FIELDS[table] ?? []) {
        const value = next[field]
        if (typeof value === 'string') next[field] = addDays(value, deltaDays)
      }
      return next
    })
  }
  return state
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// -------------------------------------------------------------------- the state

let state: State = load()

function load(): State {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as State
    } catch {
      /* fall through to a fresh fixture */
    }
  }
  return shiftFixture(seed as unknown as State & { generated_at: string })
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing or a full quota — the demo still works in memory.
  }
}

export function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY)
  state = shiftFixture(seed as unknown as State & { generated_at: string })
}

function nextId(table: keyof State): number {
  return state[table].reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function find(table: keyof State, id: number): Row | undefined {
  return state[table].find((row) => Number(row.id) === id)
}

class DemoError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function must(row: Row | undefined, what: string): Row {
  if (!row) throw new DemoError(`${what} not found`, 404)
  return row
}

// --------------------------------------------------------------- derived values

function money(value: number): string {
  return value.toFixed(2)
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function dealValue(deal: Row): number | null {
  return num(deal.purchase_price) ?? num(deal.offer_price) ?? num(deal.asking_price)
}

function stageOf(deal: Row): Row {
  return must(find('stages', Number(deal.stage_id)), 'Stage')
}

function effectiveProbability(deal: Row): number {
  const override = num(deal.probability)
  if (override !== null) return override
  return Number(stageOf(deal).default_probability) || 0
}

function daysSince(iso: unknown): number {
  if (typeof iso !== 'string') return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY))
}

function taskCounts(dealId: number): { open: number; overdue: number } {
  const open = state.tasks.filter(
    (task) => Number(task.deal_id) === dealId && task.status !== 'done',
  )
  return {
    open: open.length,
    overdue: open.filter((task) => typeof task.due_date === 'string' && task.due_date < today())
      .length,
  }
}

function serializeUser(row: Row | undefined): User | null {
  return row ? (row as unknown as User) : null
}

function serializeStage(row: Row): Stage {
  return row as unknown as Stage
}

function serializeDeal(deal: Row): Deal {
  const value = dealValue(deal)
  const probability = effectiveProbability(deal)
  const counts = taskCounts(Number(deal.id))
  const units = num(deal.units)
  const sf = num(deal.square_feet)

  return {
    ...(deal as unknown as Deal),
    stage: serializeStage(stageOf(deal)),
    owner: serializeUser(find('users', Number(deal.owner_id))),
    effective_probability: probability,
    deal_value: value === null ? null : money(value),
    weighted_value: money(((value ?? 0) * probability) / 100),
    price_per_unit: value !== null && units ? money(value / units) : null,
    price_per_sf: value !== null && sf ? money(value / sf) : null,
    days_in_stage: daysSince(deal.stage_entered_at),
    open_task_count: counts.open,
    overdue_task_count: counts.overdue,
  }
}

function serializeTask(task: Row): Task {
  return {
    ...(task as unknown as Task),
    assignee: serializeUser(find('users', Number(task.assignee_id))),
    is_overdue:
      typeof task.due_date === 'string' && task.status !== 'done' && task.due_date < today(),
  }
}

function serializeMilestone(milestone: Row): Milestone {
  return {
    ...(milestone as unknown as Milestone),
    is_overdue:
      !milestone.actual_date &&
      typeof milestone.target_date === 'string' &&
      milestone.target_date < today(),
  }
}

function serializeDocument(doc: Row): DealDocument {
  return { ...(doc as unknown as DealDocument), added_by: serializeUser(find('users', Number(doc.added_by_id))) }
}

function serializeActivity(activity: Row): Activity {
  return {
    ...(activity as unknown as Activity),
    user: serializeUser(find('users', Number(activity.user_id))),
  }
}

// ------------------------------------------------------------------- mutations

function logActivity(dealId: number, userId: number | null, type: string, body: string, meta?: unknown) {
  state.activities.push({
    id: nextId('activities'),
    deal_id: dealId,
    user_id: userId,
    type,
    body,
    meta: meta ?? null,
    created_at: new Date().toISOString(),
  })
}

/** Mirrors the field-diffing in `app/services/activity.py`. */
const TRACKED_FIELDS: Record<string, string> = {
  name: 'Name',
  status: 'Status',
  deal_type: 'Deal type',
  property_type: 'Property type',
  owner_id: 'Owner',
  asking_price: 'Asking price',
  offer_price: 'Offer price',
  purchase_price: 'Purchase price',
  noi: 'NOI',
  going_in_cap_rate: 'Going-in cap rate',
  stabilized_cap_rate: 'Stabilized cap rate',
  target_irr: 'Target IRR',
  target_equity_multiple: 'Target equity multiple',
  loan_amount: 'Loan amount',
  ltv: 'LTV',
  equity_required: 'Equity required',
  probability: 'Probability',
  expected_close_date: 'Expected close',
  actual_close_date: 'Actual close',
  market: 'Market',
  units: 'Units',
  square_feet: 'Square feet',
  broker_name: 'Broker',
  seller_name: 'Seller',
  lost_reason: 'Lost reason',
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value).replace(/_/g, ' ')
}

function moveStage(deal: Row, stage: Row, userId: number, note?: string) {
  const previous = stageOf(deal)
  if (Number(previous.id) === Number(stage.id)) return

  const now = new Date().toISOString()
  const open = state.stage_history
    .filter((row) => Number(row.deal_id) === Number(deal.id) && !row.exited_at)
    .sort((a, b) => String(a.entered_at).localeCompare(String(b.entered_at)))
    .pop()
  if (open) {
    open.exited_at = now
    open.days_in_stage = daysSince(open.entered_at)
  }
  state.stage_history.push({
    id: nextId('stage_history'),
    deal_id: Number(deal.id),
    from_stage_id: Number(previous.id),
    to_stage_id: Number(stage.id),
    entered_at: now,
    exited_at: null,
    days_in_stage: null,
    changed_by_id: userId,
  })

  deal.stage_id = Number(stage.id)
  deal.stage_entered_at = now
  deal.updated_at = now

  if (stage.category === 'won') {
    deal.status = 'won'
    deal.probability = 100
    if (!deal.actual_close_date) deal.actual_close_date = today()
  } else if (stage.category === 'lost') {
    deal.status = 'lost'
    deal.probability = 0
  } else if (deal.status === 'won' || deal.status === 'lost') {
    deal.status = 'active'
    deal.probability = null
    deal.actual_close_date = null
  }

  logActivity(
    Number(deal.id),
    userId,
    'stage_change',
    `Stage moved from ${previous.name} to ${stage.name}${note ? `: ${note}` : ''}`,
    { from_stage: previous.name, to_stage: stage.name, note: note ?? null },
  )
}

const DEFAULT_MILESTONES: [string, boolean][] = [
  ['LOI Signed', true],
  ['PSA Executed', true],
  ['Due Diligence Expiration', true],
  ['Financing Commitment', false],
  ['Closing', true],
]

// -------------------------------------------------------------------- analytics

const LIVE = ['active', 'on_hold']

function liveDeals(): Row[] {
  return state.deals.filter((deal) => LIVE.includes(String(deal.status)))
}

function weightedOf(deal: Row): number {
  return ((dealValue(deal) ?? 0) * effectiveProbability(deal)) / 100
}

function quarterBounds(now: Date): [string, string] {
  const q = Math.floor(now.getMonth() / 3)
  const start = new Date(Date.UTC(now.getFullYear(), q * 3, 1))
  const end = new Date(Date.UTC(now.getFullYear(), q * 3 + 3, 1))
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}

function avgDaysInStage(): Map<number, number> {
  const sums = new Map<number, number[]>()
  for (const row of state.stage_history) {
    if (row.days_in_stage === null || row.days_in_stage === undefined) continue
    const key = Number(row.to_stage_id)
    if (!sums.has(key)) sums.set(key, [])
    sums.get(key)!.push(Number(row.days_in_stage))
  }
  const out = new Map<number, number>()
  for (const [key, values] of sums) {
    out.set(key, Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10)
  }
  return out
}

function summary() {
  const live = liveDeals()
  const [qStart, qEnd] = quarterBounds(new Date())
  const closing = live.filter(
    (deal) =>
      typeof deal.expected_close_date === 'string' &&
      deal.expected_close_date >= qStart &&
      deal.expected_close_date < qEnd,
  )
  const won = state.deals.filter((deal) => deal.status === 'won')
  const lost = state.deals.filter((deal) => deal.status === 'lost')
  const decided = won.length + lost.length

  const closedDurations = won
    .filter((deal) => typeof deal.actual_close_date === 'string')
    .map(
      (deal) =>
        (new Date(`${deal.actual_close_date}T00:00:00Z`).getTime() -
          new Date(String(deal.created_at)).getTime()) /
        DAY,
    )

  return {
    active_deals: live.length,
    total_pipeline_value: money(live.reduce((sum, deal) => sum + (dealValue(deal) ?? 0), 0)),
    weighted_pipeline_value: money(live.reduce((sum, deal) => sum + weightedOf(deal), 0)),
    closing_this_quarter: closing.length,
    closing_this_quarter_value: money(
      closing.reduce((sum, deal) => sum + (dealValue(deal) ?? 0), 0),
    ),
    won_deals: won.length,
    lost_deals: lost.length,
    win_rate: decided ? Math.round((won.length / decided) * 10000) / 10000 : 0,
    avg_days_to_close: closedDurations.length
      ? Math.round((closedDurations.reduce((a, b) => a + b, 0) / closedDurations.length) * 10) / 10
      : null,
    overdue_tasks: state.tasks.filter(
      (task) => task.status !== 'done' && typeof task.due_date === 'string' && task.due_date < today(),
    ).length,
    stalled_deals: live.filter((deal) => daysSince(deal.stage_entered_at) >= STALE_DAYS).length,
  }
}

function byStage() {
  const averages = avgDaysInStage()
  return [...state.stages]
    .sort((a, b) => Number(a.order_index) - Number(b.order_index))
    .map((stage) => {
      const deals = state.deals.filter((deal) => Number(deal.stage_id) === Number(stage.id))
      return {
        stage_id: Number(stage.id),
        stage_name: String(stage.name),
        color: String(stage.color),
        order_index: Number(stage.order_index),
        category: stage.category as StageCategory,
        deal_count: deals.length,
        total_value: money(deals.reduce((sum, deal) => sum + (dealValue(deal) ?? 0), 0)),
        weighted_value: money(deals.reduce((sum, deal) => sum + weightedOf(deal), 0)),
        avg_days_in_stage: averages.get(Number(stage.id)) ?? null,
        stalled_count: deals.filter((deal) => daysSince(deal.stage_entered_at) >= STALE_DAYS).length,
      }
    })
}

function funnel() {
  const open = [...state.stages]
    .filter((stage) => stage.category === 'open')
    .sort((a, b) => Number(a.order_index) - Number(b.order_index))
  if (!open.length) return []

  const orderByStage = new Map(open.map((stage) => [Number(stage.id), Number(stage.order_index)]))
  const wonIds = new Set(
    state.stages.filter((stage) => stage.category === 'won').map((stage) => Number(stage.id)),
  )
  const wonOrder = Math.max(...orderByStage.values()) + 1

  const enteredBy = new Map<number, Set<number>>()
  const maxOrder = new Map<number, number>()
  for (const row of state.stage_history) {
    const stageId = Number(row.to_stage_id)
    const dealId = Number(row.deal_id)
    let order: number
    if (orderByStage.has(stageId)) {
      if (!enteredBy.has(stageId)) enteredBy.set(stageId, new Set())
      enteredBy.get(stageId)!.add(dealId)
      order = orderByStage.get(stageId)!
    } else if (wonIds.has(stageId)) {
      order = wonOrder
    } else {
      continue // a loss is not progress
    }
    maxOrder.set(dealId, Math.max(maxOrder.get(dealId) ?? -1, order))
  }

  const averages = avgDaysInStage()
  return open.map((stage) => {
    const deals = enteredBy.get(Number(stage.id)) ?? new Set<number>()
    const advanced = [...deals].filter(
      (dealId) => (maxOrder.get(dealId) ?? -1) > Number(stage.order_index),
    ).length
    return {
      stage_id: Number(stage.id),
      stage_name: String(stage.name),
      order_index: Number(stage.order_index),
      entered: deals.size,
      advanced,
      conversion_rate: deals.size ? Math.round((advanced / deals.size) * 10000) / 10000 : null,
      avg_days_in_stage: averages.get(Number(stage.id)) ?? null,
    }
  })
}

function trends(months: number) {
  const now = new Date()
  const buckets: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1))
    buckets.push(d.toISOString().slice(0, 7))
  }

  const sourced = new Map<string, number>()
  for (const deal of state.deals) {
    const key =
      typeof deal.date_sourced === 'string'
        ? deal.date_sourced.slice(0, 7)
        : String(deal.created_at).slice(0, 7)
    sourced.set(key, (sourced.get(key) ?? 0) + 1)
  }

  const closed = new Map<string, { count: number; value: number }>()
  for (const deal of state.deals) {
    if (deal.status !== 'won' || typeof deal.actual_close_date !== 'string') continue
    const key = deal.actual_close_date.slice(0, 7)
    const entry = closed.get(key) ?? { count: 0, value: 0 }
    entry.count += 1
    entry.value += dealValue(deal) ?? 0
    closed.set(key, entry)
  }

  const breakdown = (field: string) => {
    const groups = new Map<string, { count: number; value: number }>()
    for (const deal of liveDeals()) {
      const label = (deal[field] as string | null) ?? 'Unspecified'
      const entry = groups.get(label) ?? { count: 0, value: 0 }
      entry.count += 1
      entry.value += dealValue(deal) ?? 0
      groups.set(label, entry)
    }
    return [...groups.entries()]
      .map(([label, entry]) => ({
        label,
        deal_count: entry.count,
        total_value: money(entry.value),
      }))
      .sort((a, b) => Number(b.total_value) - Number(a.total_value))
  }

  return {
    months: buckets.map((month) => ({
      month,
      sourced: sourced.get(month) ?? 0,
      closed: closed.get(month)?.count ?? 0,
      closed_value: money(closed.get(month)?.value ?? 0),
    })),
    by_property_type: breakdown('property_type'),
    by_market: breakdown('market'),
  }
}

// ---------------------------------------------------------------------- routing

type Params = Record<string, unknown>

function list(params: Params, key: string): string[] {
  const value = params[key]
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

const SORTERS: Record<string, (deal: Row) => number | string> = {
  name: (deal) => String(deal.name).toLowerCase(),
  created_at: (deal) => String(deal.created_at),
  updated_at: (deal) => String(deal.updated_at),
  expected_close_date: (deal) => String(deal.expected_close_date ?? ''),
  stage_entered_at: (deal) => String(deal.stage_entered_at),
  value: (deal) => dealValue(deal) ?? 0,
}

function listDeals(params: Params) {
  let deals = [...state.deals]

  const q = params.q ? String(params.q).toLowerCase() : ''
  if (q) {
    deals = deals.filter((deal) =>
      ['name', 'address', 'city', 'market', 'broker_name', 'broker_firm', 'seller_name'].some(
        (field) => String(deal[field] ?? '').toLowerCase().includes(q),
      ),
    )
  }
  const inList = (key: string, field: string) => {
    const values = list(params, key)
    if (values.length) deals = deals.filter((deal) => values.includes(String(deal[field])))
  }
  inList('stage_id', 'stage_id')
  inList('status', 'status')
  inList('property_type', 'property_type')
  inList('deal_type', 'deal_type')
  inList('market', 'market')
  inList('owner_id', 'owner_id')

  const min = num(params.min_price)
  const max = num(params.max_price)
  if (min !== null) deals = deals.filter((deal) => (dealValue(deal) ?? 0) >= min)
  if (max !== null) deals = deals.filter((deal) => (dealValue(deal) ?? 0) <= max)
  if (params.close_after)
    deals = deals.filter((deal) => String(deal.expected_close_date ?? '') >= String(params.close_after))
  if (params.close_before)
    deals = deals.filter(
      (deal) => deal.expected_close_date && String(deal.expected_close_date) <= String(params.close_before),
    )

  const sort = String(params.sort ?? '-updated_at')
  const descending = sort.startsWith('-')
  const sorter = SORTERS[sort.replace(/^-/, '')]
  if (!sorter) throw new DemoError(`Unknown sort: ${sort}`, 400)
  deals.sort((a, b) => {
    const av = sorter(a)
    const bv = sorter(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : Number(b.id) - Number(a.id)
    return descending ? -cmp : cmp
  })

  const page = Number(params.page ?? 1)
  const pageSize = Number(params.page_size ?? 50)
  const start = (page - 1) * pageSize
  return {
    items: deals.slice(start, start + pageSize).map(serializeDeal),
    total: deals.length,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(deals.length / pageSize)),
  }
}

function currentUser(userId: number | null): Row {
  return (userId !== null && find('users', userId)) || state.users[0]
}

/** Answers a request the way the API would. Throws `DemoError` on 4xx. */
export function handle(method: string, path: string, params: Params, body: Row, userId: number | null) {
  const user = currentUser(userId)
  const id = (index: number) => Number(path.split('/')[index])
  const match = (pattern: RegExp) => pattern.test(path)

  // ------------------------------------------------------------------- users
  if (path === '/users' && method === 'GET')
    return [...state.users].sort((a, b) => String(a.name).localeCompare(String(b.name)))
  if (path === '/users/me') return user
  if (path === '/users' && method === 'POST') {
    if (state.users.some((u) => u.email === body.email))
      throw new DemoError('A user with that email already exists', 409)
    const row: Row = { id: nextId('users'), is_active: true, title: null, ...body }
    state.users.push(row)
    persist()
    return row
  }

  // ------------------------------------------------------------------ stages
  if (path === '/stages' && method === 'GET')
    return [...state.stages].sort((a, b) => Number(a.order_index) - Number(b.order_index))
  if (path === '/stages' && method === 'POST') {
    const row: Row = {
      id: nextId('stages'),
      color: '#64748b',
      category: 'open',
      default_probability: 0,
      ...body,
      order_index:
        body.order_index ??
        state.stages.reduce((max, s) => Math.max(max, Number(s.order_index)), -1) + 1,
    }
    state.stages.push(row)
    persist()
    return row
  }
  if (path === '/stages/reorder') {
    const ids = (body.stage_ids as number[]) ?? []
    ids.forEach((stageId, index) => {
      const stage = find('stages', stageId)
      if (stage) stage.order_index = index
    })
    persist()
    return [...state.stages].sort((a, b) => Number(a.order_index) - Number(b.order_index))
  }
  if (match(/^\/stages\/\d+$/)) {
    const stage = must(find('stages', id(2)), 'Stage')
    if (method === 'PATCH') {
      Object.assign(stage, body)
      persist()
      return stage
    }
    if (method === 'DELETE') {
      const inUse = state.deals.filter((deal) => Number(deal.stage_id) === id(2)).length
      if (inUse) throw new DemoError(`${inUse} deal(s) are still in this stage. Move them first.`, 409)
      if (
        state.stage_history.some(
          (row) => Number(row.to_stage_id) === id(2) || Number(row.from_stage_id) === id(2),
        )
      )
        throw new DemoError(
          'Deals have moved through this stage, so it is kept for reporting history. Rename it instead of deleting it.',
          409,
        )
      state.stages = state.stages.filter((s) => Number(s.id) !== id(2))
      persist()
      return undefined
    }
  }

  // --------------------------------------------------------------- analytics
  if (path === '/analytics/summary') return summary()
  if (path === '/analytics/by-stage') return byStage()
  if (path === '/analytics/funnel') return funnel()
  if (path === '/analytics/trends') return trends(Number(params.months ?? 12))

  // ------------------------------------------------------------- cross-deal
  if (path === '/deals/markets')
    return [...new Set(state.deals.map((deal) => deal.market).filter(Boolean))]
      .map(String)
      .sort()

  if (path === '/tasks' && method === 'GET') {
    let tasks = [...state.tasks]
    if (params.assignee_id !== undefined)
      tasks = tasks.filter((task) => Number(task.assignee_id) === Number(params.assignee_id))
    if (!params.include_done) tasks = tasks.filter((task) => task.status !== 'done')
    if (params.overdue)
      tasks = tasks.filter((task) => typeof task.due_date === 'string' && task.due_date < today())
    tasks.sort((a, b) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')))
    return tasks.map((task) => ({
      ...serializeTask(task),
      deal_name: String(must(find('deals', Number(task.deal_id)), 'Deal').name),
    }))
  }

  // ------------------------------------------------------------------- deals
  if (path === '/deals' && method === 'GET') return listDeals(params)
  if (path === '/deals' && method === 'POST') {
    const stages = [...state.stages]
      .filter((s) => s.category === 'open')
      .sort((a, b) => Number(a.order_index) - Number(b.order_index))
    const stage = body.stage_id ? must(find('stages', Number(body.stage_id)), 'Stage') : stages[0]
    const now = new Date().toISOString()
    const { seed_default_milestones = true, stage_id: _ignored, ...fields } = body
    const deal: Row = {
      id: nextId('deals'),
      status: 'active',
      deal_type: 'acquisition',
      property_type: 'multifamily',
      probability: null,
      date_sourced: today(),
      ...fields,
      owner_id: fields.owner_id ?? user.id,
      stage_id: Number(stage.id),
      stage_entered_at: now,
      created_at: now,
      updated_at: now,
    }
    state.deals.push(deal)
    state.stage_history.push({
      id: nextId('stage_history'),
      deal_id: Number(deal.id),
      from_stage_id: null,
      to_stage_id: Number(stage.id),
      entered_at: now,
      exited_at: null,
      days_in_stage: null,
      changed_by_id: Number(user.id),
    })
    if (seed_default_milestones) {
      DEFAULT_MILESTONES.forEach(([name, critical], index) => {
        state.milestones.push({
          id: nextId('milestones'),
          deal_id: Number(deal.id),
          name,
          is_critical: critical,
          order_index: index,
          target_date: null,
          actual_date: null,
        })
      })
    }
    logActivity(Number(deal.id), Number(user.id), 'created', `Deal created in ${stage.name}`)
    persist()
    return { ...serializeDeal(deal), team: [] }
  }

  const dealChild = path.match(/^\/deals\/(\d+)(\/[a-z]+)?$/)
  if (dealChild) {
    const dealId = Number(dealChild[1])
    const deal = must(find('deals', dealId), 'Deal')
    const child = dealChild[2]

    if (!child) {
      if (method === 'GET')
        return { ...serializeDeal(deal), team: teamOf(dealId) }
      if (method === 'PATCH') {
        for (const [field, value] of Object.entries(body)) {
          const previous = deal[field]
          if (previous === value) continue
          deal[field] = value
          if (TRACKED_FIELDS[field])
            logActivity(
              dealId,
              Number(user.id),
              'field_change',
              `${TRACKED_FIELDS[field]} changed from ${display(previous)} to ${display(value)}`,
              { field, from: display(previous), to: display(value) },
            )
        }
        deal.updated_at = new Date().toISOString()
        persist()
        return { ...serializeDeal(deal), team: teamOf(dealId) }
      }
      if (method === 'DELETE') {
        state.deals = state.deals.filter((d) => Number(d.id) !== dealId)
        for (const table of ['team', 'stage_history', 'tasks', 'milestones', 'documents', 'activities'] as const) {
          state[table] = state[table].filter((row) => Number(row.deal_id) !== dealId)
        }
        persist()
        return undefined
      }
    }

    if (child === '/stage') {
      moveStage(deal, must(find('stages', Number(body.stage_id)), 'Stage'), Number(user.id), body.note as string)
      persist()
      return { ...serializeDeal(deal), team: teamOf(dealId) }
    }

    if (child === '/history')
      return state.stage_history
        .filter((row) => Number(row.deal_id) === dealId)
        .sort((a, b) => String(a.entered_at).localeCompare(String(b.entered_at)))
        .map((row) => ({
          ...row,
          to_stage: find('stages', Number(row.to_stage_id)),
          from_stage: find('stages', Number(row.from_stage_id)) ?? null,
        }))

    if (child === '/tasks') {
      if (method === 'GET')
        return state.tasks
          .filter((task) => Number(task.deal_id) === dealId)
          .sort((a, b) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')))
          .map(serializeTask)
      const task: Row = {
        id: nextId('tasks'),
        deal_id: dealId,
        status: 'open',
        priority: 'normal',
        description: null,
        due_date: null,
        assignee_id: null,
        completed_at: null,
        completed_by_id: null,
        created_at: new Date().toISOString(),
        ...body,
      }
      state.tasks.push(task)
      logActivity(dealId, Number(user.id), 'task', `Task added: ${task.title}`)
      persist()
      return serializeTask(task)
    }

    if (child === '/milestones') {
      if (method === 'GET')
        return state.milestones
          .filter((m) => Number(m.deal_id) === dealId)
          .sort((a, b) => Number(a.order_index) - Number(b.order_index))
          .map(serializeMilestone)
      const milestone: Row = {
        id: nextId('milestones'),
        deal_id: dealId,
        is_critical: false,
        actual_date: null,
        target_date: null,
        order_index: state.milestones.filter((m) => Number(m.deal_id) === dealId).length,
        ...body,
      }
      state.milestones.push(milestone)
      logActivity(dealId, Number(user.id), 'milestone', `Milestone added: ${milestone.name}`)
      persist()
      return serializeMilestone(milestone)
    }

    if (child === '/documents') {
      if (method === 'GET')
        return state.documents
          .filter((doc) => Number(doc.deal_id) === dealId)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map(serializeDocument)
      const doc: Row = {
        id: nextId('documents'),
        deal_id: dealId,
        category: 'other',
        added_by_id: Number(user.id),
        created_at: new Date().toISOString(),
        ...body,
      }
      state.documents.push(doc)
      logActivity(dealId, Number(user.id), 'document', `Document linked: ${doc.name}`)
      persist()
      return serializeDocument(doc)
    }

    if (child === '/activities')
      return state.activities
        .filter((a) => Number(a.deal_id) === dealId)
        .sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)) || Number(b.id) - Number(a.id),
        )
        .map(serializeActivity)

    if (child === '/notes') {
      logActivity(dealId, Number(user.id), 'note', String(body.body))
      persist()
      return serializeActivity(state.activities[state.activities.length - 1])
    }

    if (child === '/team') {
      if (method === 'GET') return teamOf(dealId)
      const existing = state.team.find(
        (m) => Number(m.deal_id) === dealId && Number(m.user_id) === Number(body.user_id),
      )
      if (existing) {
        existing.role = body.role
        persist()
        return serializeTeam(existing)
      }
      const member: Row = { id: nextId('team'), deal_id: dealId, ...body }
      state.team.push(member)
      const added = must(find('users', Number(body.user_id)), 'User')
      logActivity(
        dealId,
        Number(user.id),
        'team',
        `${added.name} added to the deal team as ${String(body.role).replace(/_/g, ' ')}`,
      )
      persist()
      return serializeTeam(member)
    }
  }

  // --------------------------------------------------- single-item mutations
  if (match(/^\/tasks\/\d+$/)) {
    const task = must(find('tasks', id(2)), 'Task')
    if (method === 'DELETE') {
      state.tasks = state.tasks.filter((t) => Number(t.id) !== id(2))
      persist()
      return undefined
    }
    const wasDone = task.status === 'done'
    Object.assign(task, body)
    if (task.status === 'done' && !wasDone) {
      task.completed_at = new Date().toISOString()
      task.completed_by_id = Number(user.id)
      logActivity(Number(task.deal_id), Number(user.id), 'task', `Task completed: ${task.title}`)
    } else if (task.status !== 'done' && wasDone) {
      task.completed_at = null
      task.completed_by_id = null
      logActivity(Number(task.deal_id), Number(user.id), 'task', `Task reopened: ${task.title}`)
    }
    persist()
    return serializeTask(task)
  }

  if (match(/^\/milestones\/\d+$/)) {
    const milestone = must(find('milestones', id(2)), 'Milestone')
    if (method === 'DELETE') {
      state.milestones = state.milestones.filter((m) => Number(m.id) !== id(2))
      persist()
      return undefined
    }
    const wasHit = Boolean(milestone.actual_date)
    Object.assign(milestone, body)
    if (milestone.actual_date && !wasHit)
      logActivity(
        Number(milestone.deal_id),
        Number(user.id),
        'milestone',
        `Milestone hit: ${milestone.name} on ${milestone.actual_date}`,
      )
    persist()
    return serializeMilestone(milestone)
  }

  if (match(/^\/documents\/\d+$/) && method === 'DELETE') {
    state.documents = state.documents.filter((doc) => Number(doc.id) !== id(2))
    persist()
    return undefined
  }

  if (match(/^\/team\/\d+$/) && method === 'DELETE') {
    state.team = state.team.filter((m) => Number(m.id) !== id(2))
    persist()
    return undefined
  }

  throw new DemoError(`The demo backend has no route for ${method} ${path}`, 404)
}

function teamOf(dealId: number) {
  return state.team.filter((m) => Number(m.deal_id) === dealId).map(serializeTeam)
}

function serializeTeam(member: Row) {
  return {
    id: Number(member.id),
    role: member.role,
    user: serializeUser(find('users', Number(member.user_id))),
  }
}
