from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app import models, schemas
from app.deps import DbSession

router = APIRouter(prefix="/stages", tags=["stages"])


def _get(db: DbSession, stage_id: int) -> models.Stage:
    stage = db.get(models.Stage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")
    return stage


@router.get("", response_model=list[schemas.StageOut])
def list_stages(db: DbSession):
    return db.scalars(select(models.Stage).order_by(models.Stage.order_index)).all()


@router.post("", response_model=schemas.StageOut, status_code=201)
def create_stage(payload: schemas.StageCreate, db: DbSession):
    if db.scalar(select(models.Stage).where(models.Stage.name == payload.name)):
        raise HTTPException(status_code=409, detail="A stage with that name already exists")
    order_index = payload.order_index
    if order_index is None:
        order_index = (db.scalar(select(func.max(models.Stage.order_index))) or -1) + 1
    stage = models.Stage(**payload.model_dump(exclude={"order_index"}), order_index=order_index)
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch("/{stage_id}", response_model=schemas.StageOut)
def update_stage(stage_id: int, payload: schemas.StageUpdate, db: DbSession):
    stage = _get(db, stage_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    db.commit()
    db.refresh(stage)
    return stage


@router.post("/reorder", response_model=list[schemas.StageOut])
def reorder_stages(payload: schemas.StageReorder, db: DbSession):
    stages = {s.id: s for s in db.scalars(select(models.Stage)).all()}
    missing = [sid for sid in payload.stage_ids if sid not in stages]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown stage ids: {missing}")
    for index, stage_id in enumerate(payload.stage_ids):
        stages[stage_id].order_index = index
    db.commit()
    return db.scalars(select(models.Stage).order_by(models.Stage.order_index)).all()


@router.delete("/{stage_id}", status_code=204)
def delete_stage(stage_id: int, db: DbSession):
    stage = _get(db, stage_id)
    in_use = db.scalar(
        select(func.count(models.Deal.id)).where(models.Deal.stage_id == stage_id)
    )
    if in_use:
        raise HTTPException(
            status_code=409,
            detail=f"{in_use} deal(s) are still in this stage. Move them first.",
        )
    # Stage history is the audit trail behind every velocity and conversion
    # number, so a stage a deal has ever passed through stays on the books.
    has_history = db.scalar(
        select(func.count(models.DealStageHistory.id)).where(
            (models.DealStageHistory.to_stage_id == stage_id)
            | (models.DealStageHistory.from_stage_id == stage_id)
        )
    )
    if has_history:
        raise HTTPException(
            status_code=409,
            detail="Deals have moved through this stage, so it is kept for reporting history. "
            "Rename it instead of deleting it.",
        )
    db.delete(stage)
    db.commit()
