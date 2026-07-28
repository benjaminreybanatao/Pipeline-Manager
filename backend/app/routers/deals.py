from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.services import activity, deals as deal_service
from app.services.metrics import DEAL_VALUE

router = APIRouter(prefix="/deals", tags=["deals"])

SORT_COLUMNS = {
    "name": models.Deal.name,
    "created_at": models.Deal.created_at,
    "updated_at": models.Deal.updated_at,
    "expected_close_date": models.Deal.expected_close_date,
    "stage_entered_at": models.Deal.stage_entered_at,
    "value": DEAL_VALUE,
}


def get_deal(db: DbSession, deal_id: int) -> models.Deal:
    deal = db.get(models.Deal, deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _default_stage(db: DbSession) -> models.Stage:
    stage = db.scalars(
        select(models.Stage)
        .where(models.Stage.category == models.StageCategory.open)
        .order_by(models.Stage.order_index)
    ).first()
    if stage is None:
        raise HTTPException(status_code=409, detail="No pipeline stages configured")
    return stage


@router.get("", response_model=schemas.Page[schemas.DealOut])
def list_deals(
    db: DbSession,
    q: str | None = None,
    stage_id: list[int] | None = Query(None),
    status: list[models.DealStatus] | None = Query(None),
    property_type: list[models.PropertyType] | None = Query(None),
    deal_type: list[models.DealType] | None = Query(None),
    market: list[str] | None = Query(None),
    owner_id: list[int] | None = Query(None),
    min_price: float | None = None,
    max_price: float | None = None,
    close_after: date | None = None,
    close_before: date | None = None,
    sort: str = "-updated_at",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    stmt = select(models.Deal)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                models.Deal.name.ilike(like),
                models.Deal.address.ilike(like),
                models.Deal.city.ilike(like),
                models.Deal.market.ilike(like),
                models.Deal.broker_name.ilike(like),
                models.Deal.broker_firm.ilike(like),
                models.Deal.seller_name.ilike(like),
            )
        )
    if stage_id:
        stmt = stmt.where(models.Deal.stage_id.in_(stage_id))
    if status:
        stmt = stmt.where(models.Deal.status.in_(status))
    if property_type:
        stmt = stmt.where(models.Deal.property_type.in_(property_type))
    if deal_type:
        stmt = stmt.where(models.Deal.deal_type.in_(deal_type))
    if market:
        stmt = stmt.where(models.Deal.market.in_(market))
    if owner_id:
        stmt = stmt.where(models.Deal.owner_id.in_(owner_id))
    if min_price is not None:
        stmt = stmt.where(DEAL_VALUE >= min_price)
    if max_price is not None:
        stmt = stmt.where(DEAL_VALUE <= max_price)
    if close_after is not None:
        stmt = stmt.where(models.Deal.expected_close_date >= close_after)
    if close_before is not None:
        stmt = stmt.where(models.Deal.expected_close_date <= close_before)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    descending = sort.startswith("-")
    column = SORT_COLUMNS.get(sort.lstrip("-"))
    if column is None:
        raise HTTPException(
            status_code=400, detail=f"sort must be one of {sorted(SORT_COLUMNS)} (prefix '-' for desc)"
        )
    order = column.desc().nullslast() if descending else column.asc().nullslast()
    stmt = stmt.order_by(order, models.Deal.id.desc()).offset((page - 1) * page_size).limit(page_size)

    items = list(db.scalars(stmt).unique().all())
    deal_service.attach_task_counts(db, items)
    return schemas.Page[schemas.DealOut](
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/markets", response_model=list[str])
def list_markets(db: DbSession):
    """Distinct markets in use — powers the filter dropdown without a lookup table."""
    rows = db.scalars(
        select(models.Deal.market).where(models.Deal.market.is_not(None)).distinct().order_by(models.Deal.market)
    ).all()
    return list(rows)


@router.get("/{deal_id}", response_model=schemas.DealDetail)
def read_deal(deal_id: int, db: DbSession):
    deal = get_deal(db, deal_id)
    deal_service.attach_task_counts(db, [deal])
    return deal


@router.post("", response_model=schemas.DealDetail, status_code=201)
def create_deal(payload: schemas.DealCreate, db: DbSession, user: CurrentUser):
    data = payload.model_dump(exclude={"stage_id", "seed_default_milestones"})
    stage = (
        db.get(models.Stage, payload.stage_id) if payload.stage_id is not None else _default_stage(db)
    )
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")

    if data.get("owner_id") is None:
        data["owner_id"] = user.id
    if data.get("date_sourced") is None:
        data["date_sourced"] = date.today()

    deal = models.Deal(**data, stage_id=stage.id)
    db.add(deal)
    db.flush()

    deal_service.start_history(db, deal, stage.id, user)
    if payload.seed_default_milestones:
        deal_service.seed_milestones(db, deal)
    activity.log(
        db, deal, user, models.ActivityType.created, f"Deal created in {stage.name}"
    )
    db.commit()
    db.refresh(deal)
    deal_service.attach_task_counts(db, [deal])
    return deal


@router.patch("/{deal_id}", response_model=schemas.DealDetail)
def update_deal(deal_id: int, payload: schemas.DealUpdate, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    changes = payload.model_dump(exclude_unset=True)
    if "owner_id" in changes and changes["owner_id"] is not None:
        if db.get(models.User, changes["owner_id"]) is None:
            raise HTTPException(status_code=404, detail="Owner not found")

    before = activity.snapshot(deal, list(changes))
    for field, value in changes.items():
        setattr(deal, field, value)
    activity.log_field_changes(db, deal, user, before, changes)

    db.commit()
    db.refresh(deal)
    deal_service.attach_task_counts(db, [deal])
    return deal


@router.post("/{deal_id}/stage", response_model=schemas.DealDetail)
def move_deal_stage(deal_id: int, payload: schemas.StageMove, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    stage = db.get(models.Stage, payload.stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")
    deal_service.move_stage(db, deal, stage, user, payload.note)
    db.commit()
    db.refresh(deal)
    deal_service.attach_task_counts(db, [deal])
    return deal


@router.get("/{deal_id}/history", response_model=list[schemas.StageHistoryOut])
def deal_history(deal_id: int, db: DbSession):
    get_deal(db, deal_id)
    return db.scalars(
        select(models.DealStageHistory)
        .where(models.DealStageHistory.deal_id == deal_id)
        .order_by(models.DealStageHistory.entered_at)
    ).all()


@router.delete("/{deal_id}", status_code=204)
def delete_deal(deal_id: int, db: DbSession):
    deal = get_deal(db, deal_id)
    db.delete(deal)
    db.commit()
