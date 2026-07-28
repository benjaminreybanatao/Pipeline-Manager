"""Pipeline reporting aggregations.

Kept separate from the routers so each number can be unit-tested against a
known fixture — these are the figures people quote in a pipeline meeting.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import Numeric, cast, func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings

# "What the deal is worth" in SQL: what we agreed to, else what we bid, else the ask.
DEAL_VALUE = func.coalesce(
    models.Deal.purchase_price, models.Deal.offer_price, models.Deal.asking_price, 0
)
PROBABILITY = func.coalesce(models.Deal.probability, models.Stage.default_probability, 0)
WEIGHTED_VALUE = DEAL_VALUE * cast(PROBABILITY, Numeric) / 100

LIVE_STATUSES = (models.DealStatus.active, models.DealStatus.on_hold)


def _quarter_bounds(today: date) -> tuple[date, date]:
    quarter = (today.month - 1) // 3
    start = date(today.year, quarter * 3 + 1, 1)
    end_month = start.month + 3
    end = date(start.year + 1, 1, 1) if end_month > 12 else date(start.year, end_month, 1)
    return start, end


def _dec(value) -> Decimal:
    return Decimal(value or 0).quantize(Decimal("0.01"))


def summary(db: Session, today: date | None = None) -> schemas.SummaryOut:
    today = today or date.today()
    q_start, q_end = _quarter_bounds(today)

    live = (
        select(
            func.count(models.Deal.id),
            func.coalesce(func.sum(DEAL_VALUE), 0),
            func.coalesce(func.sum(WEIGHTED_VALUE), 0),
        )
        .join(models.Stage, models.Deal.stage_id == models.Stage.id)
        .where(models.Deal.status.in_(LIVE_STATUSES))
    )
    active_deals, total_value, weighted_value = db.execute(live).one()

    closing = (
        select(func.count(models.Deal.id), func.coalesce(func.sum(DEAL_VALUE), 0))
        .where(
            models.Deal.status.in_(LIVE_STATUSES),
            models.Deal.expected_close_date >= q_start,
            models.Deal.expected_close_date < q_end,
        )
    )
    closing_count, closing_value = db.execute(closing).one()

    won = db.scalar(
        select(func.count(models.Deal.id)).where(models.Deal.status == models.DealStatus.won)
    )
    lost = db.scalar(
        select(func.count(models.Deal.id)).where(models.Deal.status == models.DealStatus.lost)
    )
    decided = (won or 0) + (lost or 0)

    avg_days = db.scalar(
        select(
            func.avg(
                func.extract(
                    "epoch",
                    cast(models.Deal.actual_close_date, models.Deal.created_at.type)
                    - models.Deal.created_at,
                )
                / 86400
            )
        ).where(
            models.Deal.status == models.DealStatus.won,
            models.Deal.actual_close_date.is_not(None),
        )
    )

    overdue_tasks = db.scalar(
        select(func.count(models.Task.id)).where(
            models.Task.status != models.TaskStatus.done,
            models.Task.due_date.is_not(None),
            models.Task.due_date < today,
        )
    )

    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=settings.stage_stale_days)
    stalled = db.scalar(
        select(func.count(models.Deal.id)).where(
            models.Deal.status.in_(LIVE_STATUSES),
            models.Deal.stage_entered_at < stale_cutoff,
        )
    )

    return schemas.SummaryOut(
        active_deals=active_deals or 0,
        total_pipeline_value=_dec(total_value),
        weighted_pipeline_value=_dec(weighted_value),
        closing_this_quarter=closing_count or 0,
        closing_this_quarter_value=_dec(closing_value),
        won_deals=won or 0,
        lost_deals=lost or 0,
        win_rate=round((won or 0) / decided, 4) if decided else 0.0,
        avg_days_to_close=round(float(avg_days), 1) if avg_days is not None else None,
        overdue_tasks=overdue_tasks or 0,
        stalled_deals=stalled or 0,
    )


def by_stage(db: Session) -> list[schemas.StageBucket]:
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=settings.stage_stale_days)

    rows = db.execute(
        select(
            models.Stage.id,
            models.Stage.name,
            models.Stage.color,
            models.Stage.order_index,
            models.Stage.category,
            func.count(models.Deal.id),
            func.coalesce(func.sum(DEAL_VALUE), 0),
            func.coalesce(func.sum(WEIGHTED_VALUE), 0),
            func.count(models.Deal.id).filter(models.Deal.stage_entered_at < stale_cutoff),
        )
        .select_from(models.Stage)
        .outerjoin(
            models.Deal,
            (models.Deal.stage_id == models.Stage.id)
            & (models.Deal.status.in_(LIVE_STATUSES + (models.DealStatus.won, models.DealStatus.lost))),
        )
        .group_by(models.Stage.id)
        .order_by(models.Stage.order_index)
    ).all()

    avg_days = dict(
        db.execute(
            select(
                models.DealStageHistory.to_stage_id,
                func.avg(models.DealStageHistory.days_in_stage),
            )
            .where(models.DealStageHistory.days_in_stage.is_not(None))
            .group_by(models.DealStageHistory.to_stage_id)
        ).all()
    )

    return [
        schemas.StageBucket(
            stage_id=sid,
            stage_name=name,
            color=color,
            order_index=order_index,
            category=category,
            deal_count=count or 0,
            total_value=_dec(total),
            weighted_value=_dec(weighted),
            avg_days_in_stage=round(float(avg_days[sid]), 1) if avg_days.get(sid) is not None else None,
            stalled_count=stalled or 0,
        )
        for sid, name, color, order_index, category, count, total, weighted, stalled in rows
    ]


def funnel(db: Session) -> list[schemas.FunnelStep]:
    """Stage-to-stage conversion measured from stage history, not current position.

    A deal counts as "entered" a stage if it ever sat there, and as "advanced"
    if it ever reached a later stage in the funnel. That way a deal now sitting
    in Closing still counts as a conversion for every stage it passed through.
    """
    stages = db.scalars(
        select(models.Stage)
        .where(models.Stage.category == models.StageCategory.open)
        .order_by(models.Stage.order_index)
    ).all()
    if not stages:
        return []

    order_by_stage = {s.id: s.order_index for s in stages}
    won_stage_ids = set(
        db.scalars(
            select(models.Stage.id).where(models.Stage.category == models.StageCategory.won)
        ).all()
    )
    won_order = max(order_by_stage.values()) + 1

    history = db.execute(
        select(models.DealStageHistory.deal_id, models.DealStageHistory.to_stage_id)
    ).all()

    entered_by_stage: dict[int, set[int]] = defaultdict(set)
    max_order_by_deal: dict[int, int] = {}
    for deal_id, stage_id in history:
        if stage_id in order_by_stage:
            entered_by_stage[stage_id].add(deal_id)
            order = order_by_stage[stage_id]
        elif stage_id in won_stage_ids:
            order = won_order
        else:  # lost / passed — not progress
            continue
        max_order_by_deal[deal_id] = max(max_order_by_deal.get(deal_id, -1), order)

    avg_days = dict(
        db.execute(
            select(
                models.DealStageHistory.to_stage_id,
                func.avg(models.DealStageHistory.days_in_stage),
            )
            .where(models.DealStageHistory.days_in_stage.is_not(None))
            .group_by(models.DealStageHistory.to_stage_id)
        ).all()
    )

    steps: list[schemas.FunnelStep] = []
    for stage in stages:
        deals_here = entered_by_stage.get(stage.id, set())
        entered = len(deals_here)
        advanced = sum(1 for d in deals_here if max_order_by_deal.get(d, -1) > stage.order_index)
        steps.append(
            schemas.FunnelStep(
                stage_id=stage.id,
                stage_name=stage.name,
                order_index=stage.order_index,
                entered=entered,
                advanced=advanced,
                conversion_rate=round(advanced / entered, 4) if entered else None,
                avg_days_in_stage=(
                    round(float(avg_days[stage.id]), 1) if avg_days.get(stage.id) is not None else None
                ),
            )
        )
    return steps


def trends(db: Session, months: int = 12, today: date | None = None) -> schemas.TrendsOut:
    today = today or date.today()
    # Walk back whole months so the last bucket is always the current month.
    total = (today.year * 12 + today.month - 1) - (months - 1)
    year, month = divmod(total, 12)
    month += 1

    buckets: list[str] = []
    for _ in range(months):
        buckets.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1

    sourced_rows = db.execute(
        select(
            func.to_char(
                func.coalesce(models.Deal.date_sourced, cast(models.Deal.created_at, models.Deal.date_sourced.type)),
                "YYYY-MM",
            ).label("m"),
            func.count(models.Deal.id),
        ).group_by("m")
    ).all()
    sourced = {m: c for m, c in sourced_rows if m}

    closed_rows = db.execute(
        select(
            func.to_char(models.Deal.actual_close_date, "YYYY-MM").label("m"),
            func.count(models.Deal.id),
            func.coalesce(func.sum(DEAL_VALUE), 0),
        )
        .where(
            models.Deal.status == models.DealStatus.won,
            models.Deal.actual_close_date.is_not(None),
        )
        .group_by("m")
    ).all()
    closed = {m: (c, v) for m, c, v in closed_rows if m}

    points = [
        schemas.MonthPoint(
            month=m,
            sourced=sourced.get(m, 0),
            closed=closed.get(m, (0, 0))[0],
            closed_value=_dec(closed.get(m, (0, 0))[1]),
        )
        for m in buckets
    ]

    def breakdown(column) -> list[schemas.BreakdownRow]:
        rows = db.execute(
            select(column, func.count(models.Deal.id), func.coalesce(func.sum(DEAL_VALUE), 0))
            .where(models.Deal.status.in_(LIVE_STATUSES))
            .group_by(column)
            .order_by(func.coalesce(func.sum(DEAL_VALUE), 0).desc())
        ).all()
        out = []
        for label, count, total in rows:
            if label is None:
                label = "Unspecified"
            elif hasattr(label, "value"):
                label = label.value
            out.append(schemas.BreakdownRow(label=str(label), deal_count=count, total_value=_dec(total)))
        return out

    return schemas.TrendsOut(
        months=points,
        by_property_type=breakdown(models.Deal.property_type),
        by_market=breakdown(models.Deal.market),
    )
