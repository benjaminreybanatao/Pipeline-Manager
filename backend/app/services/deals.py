"""Deal lifecycle logic that must not live in a route handler."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app import models
from app.services import activity

DEFAULT_MILESTONES: list[tuple[str, bool]] = [
    ("LOI Signed", True),
    ("PSA Executed", True),
    ("Due Diligence Expiration", True),
    ("Financing Commitment", False),
    ("Closing", True),
]


def seed_milestones(db: Session, deal: models.Deal) -> None:
    for index, (name, critical) in enumerate(DEFAULT_MILESTONES):
        db.add(
            models.Milestone(deal_id=deal.id, name=name, is_critical=critical, order_index=index)
        )


def open_history_row(db: Session, deal_id: int) -> models.DealStageHistory | None:
    return db.scalars(
        select(models.DealStageHistory)
        .where(
            models.DealStageHistory.deal_id == deal_id,
            models.DealStageHistory.exited_at.is_(None),
        )
        .order_by(models.DealStageHistory.entered_at.desc())
    ).first()


def start_history(
    db: Session,
    deal: models.Deal,
    to_stage_id: int,
    user: models.User | None,
    from_stage_id: int | None = None,
    at: datetime | None = None,
) -> models.DealStageHistory:
    row = models.DealStageHistory(
        deal_id=deal.id,
        from_stage_id=from_stage_id,
        to_stage_id=to_stage_id,
        entered_at=at or datetime.now(timezone.utc),
        changed_by_id=user.id if user else None,
    )
    db.add(row)
    return row


def move_stage(
    db: Session,
    deal: models.Deal,
    new_stage: models.Stage,
    user: models.User | None,
    note: str | None = None,
) -> models.Deal:
    """Move a deal to a new stage, closing out its current stage stint.

    Terminal stages also drive the deal's status so the board and the reports
    can never disagree about whether a deal is still live.
    """
    now = datetime.now(timezone.utc)
    old_stage = deal.stage

    if old_stage is not None and old_stage.id == new_stage.id:
        return deal

    current = open_history_row(db, deal.id)
    if current is not None:
        entered = current.entered_at
        if entered.tzinfo is None:
            entered = entered.replace(tzinfo=timezone.utc)
        current.exited_at = now
        current.days_in_stage = max(0, (now - entered).days)

    start_history(
        db, deal, new_stage.id, user, from_stage_id=old_stage.id if old_stage else None, at=now
    )

    deal.stage_id = new_stage.id
    deal.stage = new_stage
    deal.stage_entered_at = now

    if new_stage.category == models.StageCategory.won:
        deal.status = models.DealStatus.won
        deal.probability = 100
        if deal.actual_close_date is None:
            deal.actual_close_date = date.today()
    elif new_stage.category == models.StageCategory.lost:
        deal.status = models.DealStatus.lost
        deal.probability = 0
    elif deal.status in (models.DealStatus.won, models.DealStatus.lost):
        # Reopened deal — clear the terminal bookkeeping.
        deal.status = models.DealStatus.active
        deal.probability = None
        deal.actual_close_date = None

    body = f"Stage moved from {old_stage.name if old_stage else '—'} to {new_stage.name}"
    if note:
        body = f"{body}: {note}"
    activity.log(
        db,
        deal,
        user,
        models.ActivityType.stage_change,
        body,
        {
            "from_stage": old_stage.name if old_stage else None,
            "to_stage": new_stage.name,
            "note": note,
        },
    )
    return deal


def attach_task_counts(db: Session, deals: list[models.Deal]) -> list[models.Deal]:
    """Populate ``open_task_count`` / ``overdue_task_count`` on deals in one query."""
    for deal in deals:
        deal.open_task_count = 0
        deal.overdue_task_count = 0
    if not deals:
        return deals

    ids = [d.id for d in deals]
    today = date.today()
    rows = db.execute(
        select(
            models.Task.deal_id,
            func.count().label("open_count"),
            func.sum(
                case(
                    (
                        models.Task.due_date.is_not(None) & (models.Task.due_date < today),
                        1,
                    ),
                    else_=0,
                )
            ).label("overdue_count"),
        )
        .where(models.Task.deal_id.in_(ids), models.Task.status != models.TaskStatus.done)
        .group_by(models.Task.deal_id)
    ).all()

    by_id = {deal.id: deal for deal in deals}
    for deal_id, open_count, overdue_count in rows:
        deal = by_id[deal_id]
        deal.open_task_count = int(open_count or 0)
        deal.overdue_task_count = int(overdue_count or 0)
    return deals
