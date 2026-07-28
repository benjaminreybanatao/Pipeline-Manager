from fastapi import APIRouter, Query

from app import schemas
from app.deps import DbSession
from app.services import metrics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=schemas.SummaryOut)
def summary(db: DbSession):
    return metrics.summary(db)


@router.get("/by-stage", response_model=list[schemas.StageBucket])
def by_stage(db: DbSession):
    return metrics.by_stage(db)


@router.get("/funnel", response_model=list[schemas.FunnelStep])
def funnel(db: DbSession):
    return metrics.funnel(db)


@router.get("/trends", response_model=schemas.TrendsOut)
def trends(db: DbSession, months: int = Query(12, ge=1, le=36)):
    return metrics.trends(db, months=months)
