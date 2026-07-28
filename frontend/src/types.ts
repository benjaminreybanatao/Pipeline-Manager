export type StageCategory = 'open' | 'won' | 'lost'
export type DealStatus = 'active' | 'on_hold' | 'won' | 'lost'
export type DealType = 'acquisition' | 'disposition' | 'development' | 'debt'
export type PropertyType =
  | 'multifamily'
  | 'office'
  | 'industrial'
  | 'retail'
  | 'hospitality'
  | 'land'
  | 'mixed_use'
  | 'self_storage'
  | 'other'
export type DealSource = 'broker' | 'off_market' | 'principal' | 'referral' | 'auction' | 'other'
export type TeamRole = 'lead' | 'analyst' | 'legal' | 'capital_markets' | 'asset_management'
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type DocumentCategory =
  | 'om'
  | 'rent_roll'
  | 't12'
  | 'psa'
  | 'title'
  | 'environmental'
  | 'appraisal'
  | 'survey'
  | 'model'
  | 'other'
export type ActivityType =
  | 'created'
  | 'note'
  | 'stage_change'
  | 'field_change'
  | 'task'
  | 'milestone'
  | 'document'
  | 'team'

export interface User {
  id: number
  name: string
  email: string
  title: string | null
  is_active: boolean
}

export interface Stage {
  id: number
  name: string
  order_index: number
  default_probability: number
  color: string
  category: StageCategory
}

export interface Deal {
  id: number
  name: string
  deal_type: DealType
  property_type: PropertyType
  status: DealStatus
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  market: string | null
  submarket: string | null
  square_feet: number | null
  units: number | null
  acres: string | null
  year_built: number | null
  asking_price: string | null
  offer_price: string | null
  purchase_price: string | null
  noi: string | null
  going_in_cap_rate: string | null
  stabilized_cap_rate: string | null
  target_irr: string | null
  target_equity_multiple: string | null
  loan_amount: string | null
  ltv: string | null
  equity_required: string | null
  probability: number | null
  date_sourced: string | null
  expected_close_date: string | null
  actual_close_date: string | null
  lost_reason: string | null
  source: DealSource | null
  broker_name: string | null
  broker_firm: string | null
  seller_name: string | null
  owner_id: number | null
  stage_id: number
  stage: Stage
  owner: User | null
  effective_probability: number
  deal_value: string | null
  price_per_unit: string | null
  price_per_sf: string | null
  weighted_value: string
  days_in_stage: number
  stage_entered_at: string
  created_at: string
  updated_at: string
  open_task_count: number
  overdue_task_count: number
}

export interface DealDetail extends Deal {
  team: TeamMember[]
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface StageHistory {
  id: number
  from_stage: Stage | null
  to_stage: Stage
  entered_at: string
  exited_at: string | null
  days_in_stage: number | null
}

export interface TeamMember {
  id: number
  user: User
  role: TeamRole
}

export interface Task {
  id: number
  deal_id: number
  title: string
  description: string | null
  due_date: string | null
  assignee_id: number | null
  assignee: User | null
  status: TaskStatus
  priority: TaskPriority
  completed_at: string | null
  created_at: string
  is_overdue: boolean
}

export interface TaskWithDeal extends Task {
  deal_name: string
}

export interface Milestone {
  id: number
  deal_id: number
  name: string
  target_date: string | null
  actual_date: string | null
  is_critical: boolean
  order_index: number
  is_overdue: boolean
}

export interface DealDocument {
  id: number
  deal_id: number
  name: string
  url: string
  category: DocumentCategory
  added_by: User | null
  created_at: string
}

export interface Activity {
  id: number
  deal_id: number
  type: ActivityType
  body: string
  meta: Record<string, unknown> | null
  user: User | null
  created_at: string
}

export interface Summary {
  active_deals: number
  total_pipeline_value: string
  weighted_pipeline_value: string
  closing_this_quarter: number
  closing_this_quarter_value: string
  won_deals: number
  lost_deals: number
  win_rate: number
  avg_days_to_close: number | null
  overdue_tasks: number
  stalled_deals: number
}

export interface StageBucket {
  stage_id: number
  stage_name: string
  color: string
  order_index: number
  category: StageCategory
  deal_count: number
  total_value: string
  weighted_value: string
  avg_days_in_stage: number | null
  stalled_count: number
}

export interface FunnelStep {
  stage_id: number
  stage_name: string
  order_index: number
  entered: number
  advanced: number
  conversion_rate: number | null
  avg_days_in_stage: number | null
}

export interface Trends {
  months: { month: string; sourced: number; closed: number; closed_value: string }[]
  by_property_type: { label: string; deal_count: number; total_value: string }[]
  by_market: { label: string; deal_count: number; total_value: string }[]
}

export interface DealFilters {
  q?: string
  stage_id?: number[]
  status?: DealStatus[]
  property_type?: PropertyType[]
  deal_type?: DealType[]
  market?: string[]
  owner_id?: number[]
  min_price?: number
  max_price?: number
  close_after?: string
  close_before?: string
  sort?: string
  page?: number
  page_size?: number
}
