"""Request-scoped dependencies.

There is no authentication yet. The acting user arrives as an ``X-User-Id``
header set by the frontend's user picker; if it is missing or unknown we fall
back to the first active user so the activity log always has an author. When
real auth lands, only ``get_current_user`` needs to change.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.db import get_db

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    x_user_id: Annotated[int | None, Header(alias="X-User-Id")] = None,
) -> models.User:
    if x_user_id is not None:
        user = db.get(models.User, x_user_id)
        if user is not None:
            return user
    user = db.scalars(
        select(models.User).where(models.User.is_active.is_(True)).order_by(models.User.id)
    ).first()
    if user is None:
        raise HTTPException(status_code=409, detail="No users exist yet. Seed the database first.")
    return user


CurrentUser = Annotated[models.User, Depends(get_current_user)]
