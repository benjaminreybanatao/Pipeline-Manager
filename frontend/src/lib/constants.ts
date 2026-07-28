import type {
  DealSource,
  DealStatus,
  DealType,
  DocumentCategory,
  PropertyType,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from '../types'

export const PROPERTY_TYPES: PropertyType[] = [
  'multifamily',
  'office',
  'industrial',
  'retail',
  'hospitality',
  'land',
  'mixed_use',
  'self_storage',
  'other',
]

export const DEAL_TYPES: DealType[] = ['acquisition', 'disposition', 'development', 'debt']
export const DEAL_STATUSES: DealStatus[] = ['active', 'on_hold', 'won', 'lost']
export const DEAL_SOURCES: DealSource[] = [
  'broker',
  'off_market',
  'principal',
  'referral',
  'auction',
  'other',
]
export const TEAM_ROLES: TeamRole[] = [
  'lead',
  'analyst',
  'legal',
  'capital_markets',
  'asset_management',
]
export const TASK_STATUSES: TaskStatus[] = ['open', 'in_progress', 'blocked', 'done']
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']
export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'om',
  'rent_roll',
  't12',
  'psa',
  'title',
  'environmental',
  'appraisal',
  'survey',
  'model',
  'other',
]

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  om: 'Offering memorandum',
  rent_roll: 'Rent roll',
  t12: 'T-12',
  psa: 'PSA',
  title: 'Title',
  environmental: 'Environmental',
  appraisal: 'Appraisal',
  survey: 'Survey',
  model: 'Model',
  other: 'Other',
}

/** Days in a stage before a card is flagged. Mirrors the API's settings. */
export const STAGE_WARNING_DAYS = 21
export const STAGE_STALE_DAYS = 45
