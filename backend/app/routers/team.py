from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.routers.deals import get_deal
from app.services import activity

router = APIRouter(tags=["team"])


@router.get("/deals/{deal_id}/team", response_model=list[schemas.TeamMemberOut])
def list_team(deal_id: int, db: DbSession):
    get_deal(db, deal_id)
    return db.scalars(
        select(models.DealTeamMember).where(models.DealTeamMember.deal_id == deal_id)
    ).all()


@router.post("/deals/{deal_id}/team", response_model=schemas.TeamMemberOut, status_code=201)
def add_team_member(deal_id: int, payload: schemas.TeamMemberCreate, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    member_user = db.get(models.User, payload.user_id)
    if member_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.scalar(
        select(models.DealTeamMember).where(
            models.DealTeamMember.deal_id == deal_id,
            models.DealTeamMember.user_id == payload.user_id,
        )
    )
    if existing is not None:
        existing.role = payload.role
        db.commit()
        db.refresh(existing)
        return existing

    member = models.DealTeamMember(deal_id=deal.id, **payload.model_dump())
    db.add(member)
    db.flush()
    activity.log(
        db,
        deal,
        user,
        models.ActivityType.team,
        f"{member_user.name} added to the deal team as {payload.role.value.replace('_', ' ')}",
    )
    db.commit()
    db.refresh(member)
    return member


@router.delete("/team/{member_id}", status_code=204)
def remove_team_member(member_id: int, db: DbSession):
    member = db.get(models.DealTeamMember, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="Team member not found")
    db.delete(member)
    db.commit()
