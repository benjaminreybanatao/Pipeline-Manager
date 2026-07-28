from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.routers.deals import get_deal
from app.services import activity

router = APIRouter(tags=["documents"])


@router.get("/deals/{deal_id}/documents", response_model=list[schemas.DocumentOut])
def list_documents(deal_id: int, db: DbSession):
    get_deal(db, deal_id)
    return db.scalars(
        select(models.Document)
        .where(models.Document.deal_id == deal_id)
        .order_by(models.Document.created_at.desc())
    ).all()


@router.post("/deals/{deal_id}/documents", response_model=schemas.DocumentOut, status_code=201)
def create_document(deal_id: int, payload: schemas.DocumentCreate, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    document = models.Document(deal_id=deal.id, added_by_id=user.id, **payload.model_dump())
    db.add(document)
    db.flush()
    activity.log(db, deal, user, models.ActivityType.document, f"Document linked: {document.name}")
    db.commit()
    db.refresh(document)
    return document


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: int, db: DbSession):
    document = db.get(models.Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
