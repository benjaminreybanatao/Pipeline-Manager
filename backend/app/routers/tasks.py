from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app import models, schemas
from app.deps import CurrentUser, DbSession
from app.routers.deals import get_deal
from app.services import activity

router = APIRouter(tags=["tasks"])


def _get_task(db: DbSession, task_id: int) -> models.Task:
    task = db.get(models.Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/deals/{deal_id}/tasks", response_model=list[schemas.TaskOut])
def list_deal_tasks(deal_id: int, db: DbSession):
    get_deal(db, deal_id)
    return db.scalars(
        select(models.Task)
        .where(models.Task.deal_id == deal_id)
        .order_by(models.Task.status, models.Task.due_date.asc().nullslast(), models.Task.id)
    ).all()


@router.post("/deals/{deal_id}/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(deal_id: int, payload: schemas.TaskCreate, db: DbSession, user: CurrentUser):
    deal = get_deal(db, deal_id)
    task = models.Task(deal_id=deal.id, **payload.model_dump())
    db.add(task)
    db.flush()
    activity.log(db, deal, user, models.ActivityType.task, f"Task added: {task.title}")
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: DbSession, user: CurrentUser):
    task = _get_task(db, task_id)
    changes = payload.model_dump(exclude_unset=True)
    was_done = task.status == models.TaskStatus.done

    for field, value in changes.items():
        setattr(task, field, value)

    if task.status == models.TaskStatus.done and not was_done:
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by_id = user.id
        activity.log(db, task.deal, user, models.ActivityType.task, f"Task completed: {task.title}")
    elif task.status != models.TaskStatus.done and was_done:
        task.completed_at = None
        task.completed_by_id = None
        activity.log(db, task.deal, user, models.ActivityType.task, f"Task reopened: {task.title}")

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: DbSession):
    task = _get_task(db, task_id)
    db.delete(task)
    db.commit()


@router.get("/tasks", response_model=list[schemas.TaskWithDeal])
def list_tasks(
    db: DbSession,
    assignee_id: int | None = None,
    overdue: bool = False,
    include_done: bool = False,
    limit: int = Query(200, ge=1, le=1000),
):
    """Cross-deal task list — the 'what do I owe someone this week' view."""
    stmt = select(models.Task, models.Deal.name).join(models.Deal, models.Task.deal_id == models.Deal.id)
    if assignee_id is not None:
        stmt = stmt.where(models.Task.assignee_id == assignee_id)
    if not include_done:
        stmt = stmt.where(models.Task.status != models.TaskStatus.done)
    if overdue:
        stmt = stmt.where(models.Task.due_date.is_not(None), models.Task.due_date < date.today())
    stmt = stmt.order_by(models.Task.due_date.asc().nullslast(), models.Task.id).limit(limit)

    return [
        schemas.TaskWithDeal(**schemas.TaskOut.model_validate(task).model_dump(), deal_name=deal_name)
        for task, deal_name in db.execute(stmt).all()
    ]
