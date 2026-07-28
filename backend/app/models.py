"""SQLAlchemy models for the deal pipeline.

Enum columns are stored as VARCHAR (``native_enum=False``) rather than native
Postgres enums so that adding a property type or deal source is a code change
instead of a migration with ``ALTER TYPE``.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class StageCategory(str, enum.Enum):
    open = "open"
    won = "won"
    lost = "lost"


class DealStatus(str, enum.Enum):
    active = "active"
    on_hold = "on_hold"
    won = "won"
    lost = "lost"


class DealType(str, enum.Enum):
    acquisition = "acquisition"
    disposition = "disposition"
    development = "development"
    debt = "debt"


class PropertyType(str, enum.Enum):
    multifamily = "multifamily"
    office = "office"
    industrial = "industrial"
    retail = "retail"
    hospitality = "hospitality"
    land = "land"
    mixed_use = "mixed_use"
    self_storage = "self_storage"
    other = "other"


class DealSource(str, enum.Enum):
    broker = "broker"
    off_market = "off_market"
    principal = "principal"
    referral = "referral"
    auction = "auction"
    other = "other"


class TeamRole(str, enum.Enum):
    lead = "lead"
    analyst = "analyst"
    legal = "legal"
    capital_markets = "capital_markets"
    asset_management = "asset_management"


class TaskStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    done = "done"
    blocked = "blocked"


class TaskPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class DocumentCategory(str, enum.Enum):
    om = "om"
    rent_roll = "rent_roll"
    t12 = "t12"
    psa = "psa"
    title = "title"
    environmental = "environmental"
    appraisal = "appraisal"
    survey = "survey"
    model = "model"
    other = "other"


class ActivityType(str, enum.Enum):
    created = "created"
    note = "note"
    stage_change = "stage_change"
    field_change = "field_change"
    task = "task"
    milestone = "milestone"
    document = "document"
    team = "team"


def _enum(py_enum: type[enum.Enum], name: str) -> Enum:
    return Enum(py_enum, name=name, native_enum=False, values_callable=lambda e: [m.value for m in e])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    title: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Stage(Base):
    __tablename__ = "stages"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    order_index: Mapped[int] = mapped_column(Integer)
    default_probability: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(16), default="#64748b")
    category: Mapped[StageCategory] = mapped_column(
        _enum(StageCategory, "stage_category"), default=StageCategory.open
    )

    deals: Mapped[list[Deal]] = relationship(back_populates="stage")


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    deal_type: Mapped[DealType] = mapped_column(_enum(DealType, "deal_type"), default=DealType.acquisition)
    property_type: Mapped[PropertyType] = mapped_column(
        _enum(PropertyType, "property_type"), default=PropertyType.multifamily
    )
    status: Mapped[DealStatus] = mapped_column(_enum(DealStatus, "deal_status"), default=DealStatus.active)

    # Location
    address: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(2))
    zip: Mapped[str | None] = mapped_column(String(12))
    market: Mapped[str | None] = mapped_column(String(120), index=True)
    submarket: Mapped[str | None] = mapped_column(String(120))

    # Physical
    square_feet: Mapped[int | None] = mapped_column(Integer)
    units: Mapped[int | None] = mapped_column(Integer)
    acres: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    year_built: Mapped[int | None] = mapped_column(Integer)

    # Economics
    asking_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    offer_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    noi: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    going_in_cap_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    stabilized_cap_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    target_irr: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    target_equity_multiple: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    loan_amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    ltv: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    equity_required: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))

    # Process
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id"), index=True)
    probability: Mapped[int | None] = mapped_column(Integer)
    date_sourced: Mapped[date | None] = mapped_column(Date)
    expected_close_date: Mapped[date | None] = mapped_column(Date)
    actual_close_date: Mapped[date | None] = mapped_column(Date)
    lost_reason: Mapped[str | None] = mapped_column(Text)

    # Counterparties
    source: Mapped[DealSource | None] = mapped_column(_enum(DealSource, "deal_source"))
    broker_name: Mapped[str | None] = mapped_column(String(120))
    broker_firm: Mapped[str | None] = mapped_column(String(120))
    seller_name: Mapped[str | None] = mapped_column(String(120))

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    stage_entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    stage: Mapped[Stage] = relationship(back_populates="deals", lazy="joined")
    owner: Mapped[User | None] = relationship(lazy="joined")
    team: Mapped[list[DealTeamMember]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    tasks: Mapped[list[Task]] = relationship(back_populates="deal", cascade="all, delete-orphan")
    milestones: Mapped[list[Milestone]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    activities: Mapped[list[Activity]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    stage_history: Mapped[list[DealStageHistory]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )

    @property
    def effective_probability(self) -> int:
        if self.probability is not None:
            return self.probability
        return self.stage.default_probability if self.stage else 0

    @property
    def deal_value(self) -> Decimal | None:
        """Best available price: what we agreed to, else what we bid, else the ask."""
        return self.purchase_price or self.offer_price or self.asking_price

    @property
    def price_per_unit(self) -> Decimal | None:
        value = self.deal_value
        if value is None or not self.units:
            return None
        return (value / self.units).quantize(Decimal("0.01"))

    @property
    def price_per_sf(self) -> Decimal | None:
        value = self.deal_value
        if value is None or not self.square_feet:
            return None
        return (value / self.square_feet).quantize(Decimal("0.01"))


class DealTeamMember(Base):
    __tablename__ = "deal_team_members"
    __table_args__ = (UniqueConstraint("deal_id", "user_id", name="uq_deal_team_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[TeamRole] = mapped_column(_enum(TeamRole, "team_role"), default=TeamRole.analyst)

    deal: Mapped[Deal] = relationship(back_populates="team")
    user: Mapped[User] = relationship(lazy="joined")


class DealStageHistory(Base):
    """One row per stint a deal spends in a stage. The current stint has ``exited_at`` NULL."""

    __tablename__ = "deal_stage_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    from_stage_id: Mapped[int | None] = mapped_column(ForeignKey("stages.id"))
    to_stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id"), index=True)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    days_in_stage: Mapped[int | None] = mapped_column(Integer)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    deal: Mapped[Deal] = relationship(back_populates="stage_history")
    to_stage: Mapped[Stage] = relationship(foreign_keys=[to_stage_id], lazy="joined")
    from_stage: Mapped[Stage | None] = relationship(foreign_keys=[from_stage_id], lazy="joined")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[TaskStatus] = mapped_column(_enum(TaskStatus, "task_status"), default=TaskStatus.open)
    priority: Mapped[TaskPriority] = mapped_column(
        _enum(TaskPriority, "task_priority"), default=TaskPriority.normal
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    deal: Mapped[Deal] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id], lazy="joined")


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    target_date: Mapped[date | None] = mapped_column(Date)
    actual_date: Mapped[date | None] = mapped_column(Date)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    deal: Mapped[Deal] = relationship(back_populates="milestones")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(Text)
    category: Mapped[DocumentCategory] = mapped_column(
        _enum(DocumentCategory, "document_category"), default=DocumentCategory.other
    )
    added_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    deal: Mapped[Deal] = relationship(back_populates="documents")
    added_by: Mapped[User | None] = relationship(lazy="joined")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    type: Mapped[ActivityType] = mapped_column(_enum(ActivityType, "activity_type"))
    body: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    deal: Mapped[Deal] = relationship(back_populates="activities")
    user: Mapped[User | None] = relationship(lazy="joined")
