from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app import models

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

    @computed_field
    @property
    def pages(self) -> int:
        return max(1, -(-self.total // self.page_size))


# --------------------------------------------------------------------------- users


class UserBase(BaseModel):
    name: str
    email: str
    title: str | None = None


class UserCreate(UserBase):
    pass


class UserOut(ORMModel, UserBase):
    id: int
    is_active: bool


# -------------------------------------------------------------------------- stages


class StageBase(BaseModel):
    name: str
    default_probability: int = Field(0, ge=0, le=100)
    color: str = "#64748b"
    category: models.StageCategory = models.StageCategory.open


class StageCreate(StageBase):
    order_index: int | None = None


class StageUpdate(BaseModel):
    name: str | None = None
    default_probability: int | None = Field(None, ge=0, le=100)
    color: str | None = None
    category: models.StageCategory | None = None


class StageOut(ORMModel, StageBase):
    id: int
    order_index: int


class StageReorder(BaseModel):
    stage_ids: list[int]


# --------------------------------------------------------------------------- deals


class DealBase(BaseModel):
    name: str
    deal_type: models.DealType = models.DealType.acquisition
    property_type: models.PropertyType = models.PropertyType.multifamily
    status: models.DealStatus = models.DealStatus.active

    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    market: str | None = None
    submarket: str | None = None

    square_feet: int | None = None
    units: int | None = None
    acres: Decimal | None = None
    year_built: int | None = None

    asking_price: Decimal | None = None
    offer_price: Decimal | None = None
    purchase_price: Decimal | None = None
    noi: Decimal | None = None
    going_in_cap_rate: Decimal | None = None
    stabilized_cap_rate: Decimal | None = None
    target_irr: Decimal | None = None
    target_equity_multiple: Decimal | None = None
    loan_amount: Decimal | None = None
    ltv: Decimal | None = None
    equity_required: Decimal | None = None

    probability: int | None = Field(None, ge=0, le=100)
    date_sourced: date | None = None
    expected_close_date: date | None = None
    actual_close_date: date | None = None
    lost_reason: str | None = None

    source: models.DealSource | None = None
    broker_name: str | None = None
    broker_firm: str | None = None
    seller_name: str | None = None
    owner_id: int | None = None


class DealCreate(DealBase):
    stage_id: int | None = None
    seed_default_milestones: bool = True


class DealUpdate(BaseModel):
    """Every field optional — PATCH semantics. ``stage_id`` is deliberately absent;
    stage moves go through ``POST /deals/{id}/stage`` so history is always recorded."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    deal_type: models.DealType | None = None
    property_type: models.PropertyType | None = None
    status: models.DealStatus | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    market: str | None = None
    submarket: str | None = None
    square_feet: int | None = None
    units: int | None = None
    acres: Decimal | None = None
    year_built: int | None = None
    asking_price: Decimal | None = None
    offer_price: Decimal | None = None
    purchase_price: Decimal | None = None
    noi: Decimal | None = None
    going_in_cap_rate: Decimal | None = None
    stabilized_cap_rate: Decimal | None = None
    target_irr: Decimal | None = None
    target_equity_multiple: Decimal | None = None
    loan_amount: Decimal | None = None
    ltv: Decimal | None = None
    equity_required: Decimal | None = None
    probability: int | None = Field(None, ge=0, le=100)
    date_sourced: date | None = None
    expected_close_date: date | None = None
    actual_close_date: date | None = None
    lost_reason: str | None = None
    source: models.DealSource | None = None
    broker_name: str | None = None
    broker_firm: str | None = None
    seller_name: str | None = None
    owner_id: int | None = None


class DealOut(ORMModel, DealBase):
    id: int
    stage_id: int
    stage: StageOut
    owner: UserOut | None = None
    effective_probability: int
    deal_value: Decimal | None = None
    price_per_unit: Decimal | None = None
    price_per_sf: Decimal | None = None
    stage_entered_at: datetime
    created_at: datetime
    updated_at: datetime
    open_task_count: int = 0
    overdue_task_count: int = 0

    @computed_field
    @property
    def days_in_stage(self) -> int:
        entered = self.stage_entered_at
        if entered.tzinfo is None:
            entered = entered.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - entered).days)

    @computed_field
    @property
    def weighted_value(self) -> Decimal:
        if self.deal_value is None:
            return Decimal("0.00")
        return (self.deal_value * self.effective_probability / 100).quantize(Decimal("0.01"))


class DealDetail(DealOut):
    team: list["TeamMemberOut"] = []


class StageMove(BaseModel):
    stage_id: int
    note: str | None = None


class StageHistoryOut(ORMModel):
    id: int
    from_stage: StageOut | None = None
    to_stage: StageOut
    entered_at: datetime
    exited_at: datetime | None = None
    days_in_stage: int | None = None


# ---------------------------------------------------------------------------- team


class TeamMemberCreate(BaseModel):
    user_id: int
    role: models.TeamRole = models.TeamRole.analyst


class TeamMemberOut(ORMModel):
    id: int
    user: UserOut
    role: models.TeamRole


# --------------------------------------------------------------------------- tasks


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    due_date: date | None = None
    assignee_id: int | None = None
    priority: models.TaskPriority = models.TaskPriority.normal


class TaskCreate(TaskBase):
    status: models.TaskStatus = models.TaskStatus.open


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    assignee_id: int | None = None
    priority: models.TaskPriority | None = None
    status: models.TaskStatus | None = None


class TaskOut(ORMModel, TaskBase):
    id: int
    deal_id: int
    status: models.TaskStatus
    assignee: UserOut | None = None
    completed_at: datetime | None = None
    created_at: datetime

    @computed_field
    @property
    def is_overdue(self) -> bool:
        return (
            self.due_date is not None
            and self.status != models.TaskStatus.done
            and self.due_date < date.today()
        )


class TaskWithDeal(TaskOut):
    deal_name: str


# ----------------------------------------------------------------------- milestones


class MilestoneBase(BaseModel):
    name: str
    target_date: date | None = None
    actual_date: date | None = None
    is_critical: bool = False


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    target_date: date | None = None
    actual_date: date | None = None
    is_critical: bool | None = None


class MilestoneOut(ORMModel, MilestoneBase):
    id: int
    deal_id: int
    order_index: int

    @computed_field
    @property
    def is_overdue(self) -> bool:
        return self.actual_date is None and self.target_date is not None and self.target_date < date.today()


# ----------------------------------------------------------------------- documents


class DocumentCreate(BaseModel):
    name: str
    url: str
    category: models.DocumentCategory = models.DocumentCategory.other


class DocumentOut(ORMModel, DocumentCreate):
    id: int
    deal_id: int
    added_by: UserOut | None = None
    created_at: datetime


# ---------------------------------------------------------------------- activities


class NoteCreate(BaseModel):
    body: str


class ActivityOut(ORMModel):
    id: int
    deal_id: int
    type: models.ActivityType
    body: str
    meta: dict | None = None
    user: UserOut | None = None
    created_at: datetime


# ----------------------------------------------------------------------- analytics


class SummaryOut(BaseModel):
    active_deals: int
    total_pipeline_value: Decimal
    weighted_pipeline_value: Decimal
    closing_this_quarter: int
    closing_this_quarter_value: Decimal
    won_deals: int
    lost_deals: int
    win_rate: float
    avg_days_to_close: float | None
    overdue_tasks: int
    stalled_deals: int


class StageBucket(BaseModel):
    stage_id: int
    stage_name: str
    color: str
    order_index: int
    category: models.StageCategory
    deal_count: int
    total_value: Decimal
    weighted_value: Decimal
    avg_days_in_stage: float | None
    stalled_count: int


class FunnelStep(BaseModel):
    stage_id: int
    stage_name: str
    order_index: int
    entered: int
    advanced: int
    conversion_rate: float | None
    avg_days_in_stage: float | None


class MonthPoint(BaseModel):
    month: str
    sourced: int
    closed: int
    closed_value: Decimal


class BreakdownRow(BaseModel):
    label: str
    deal_count: int
    total_value: Decimal


class TrendsOut(BaseModel):
    months: list[MonthPoint]
    by_property_type: list[BreakdownRow]
    by_market: list[BreakdownRow]


DealDetail.model_rebuild()
