from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.routers.deals import get_deal
from app.services import activity

router = APIRouter(tags=["milestones"])


@router.get("/deals/{deal_id}/milestones", response_model=list[schemas.MilestoneOut])
def list_milestones(deal_id: int, db: DbSession):
    get_deal(db, deal_id)
    return db.scalars(
        select(models.Milestone)
        .where(models.Milestone.deal_id == deal_id)
        .order_by(models.Milestone.order_index, models.Milestone.id)
    ).all()


@router.post("/deals/{deal_id}/milestones", response_model=schemas.MilestoneOut, status_code=201)
def create_milestone(deal_id: int, payload: schemas.MilestoneCreate, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    next_index = (
        db.scalar(
            select(func.max(models.Milestone.order_index)).where(models.Milestone.deal_id == deal_id)
        )
        or 0
    ) + 1
    milestone = models.Milestone(deal_id=deal.id, order_index=next_index, **payload.model_dump())
    db.add(milestone)
    db.flush()
    activity.log(db, deal, user, models.ActivityType.milestone, f"Milestone added: {milestone.name}")
    db.commit()
    db.refresh(milestone)
    return milestone


@router.patch("/milestones/{milestone_id}", response_model=schemas.MilestoneOut)
def update_milestone(
    milestone_id: int, payload: schemas.MilestoneUpdate, db: DbSession, user: CurrentUser
):
    milestone = db.get(models.Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    changes = payload.model_dump(exclude_unset=True)
    previously_hit = milestone.actual_date is not None
    for field, value in changes.items():
        setattr(milestone, field, value)
    if milestone.actual_date is not None and not previously_hit:
        activity.log(
            db,
            milestone.deal,
            user,
            models.ActivityType.milestone,
            f"Milestone hit: {milestone.name} on {milestone.actual_date}",
        )
    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, db: DbSession):
    milestone = db.get(models.Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(milestone)
    db.commit()
