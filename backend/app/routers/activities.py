from fastapi import APIRouter, Query
from sqlalchemy import select

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.routers.deals import get_deal
from app.services import activity

router = APIRouter(tags=["activities"])


@router.get("/deals/{deal_id}/activities", response_model=list[schemas.ActivityOut])
def list_activities(deal_id: int, db: DbSession, limit: int = Query(200, ge=1, le=1000)):
    get_deal(db, deal_id)
    return db.scalars(
        select(models.Activity)
        .where(models.Activity.deal_id == deal_id)
        .order_by(models.Activity.created_at.desc(), models.Activity.id.desc())
        .limit(limit)
    ).all()


@router.post("/deals/{deal_id}/notes", response_model=schemas.ActivityOut, status_code=201)
def add_note(deal_id: int, payload: schemas.NoteCreate, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    note = activity.log(db, deal, user, models.ActivityType.note, payload.body)
    db.commit()
    db.refresh(note)
    return note
