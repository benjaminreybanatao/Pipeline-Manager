"""Snapshot the seeded database into the fixture the demo build ships with.

Run after ``python seed.py --reset`` to refresh
``frontend/src/demo/seed.json``. Only raw column values are exported —
everything derived (weighted value, days in stage, the whole dashboard) is
recomputed in the browser by ``frontend/src/demo/store.ts``, so the demo and
the real API cannot drift apart on the interesting parts.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.inspection import inspect

from app import models
from app.db import SessionLocal

OUT = Path(__file__).resolve().parent.parent / "frontend" / "src" / "demo" / "seed.json"

TABLES = {
    "users": models.User,
    "stages": models.Stage,
    "deals": models.Deal,
    "team": models.DealTeamMember,
    "stage_history": models.DealStageHistory,
    "tasks": models.Task,
    "milestones": models.Milestone,
    "documents": models.Document,
    "activities": models.Activity,
}


def encode(value):
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def row_to_dict(row) -> dict:
    return {c.key: encode(getattr(row, c.key)) for c in inspect(type(row)).mapper.column_attrs}


def main() -> None:
    db = SessionLocal()
    try:
        data = {
            # The demo shifts every timestamp by (now - generated_at) so the
            # board never looks stale no matter when someone opens it.
            "generated_at": datetime.now().astimezone().isoformat(),
        }
        for key, model in TABLES.items():
            rows = db.scalars(select(model).order_by(model.id)).all()
            data[key] = [row_to_dict(row) for row in rows]
    finally:
        db.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    counts = ", ".join(f"{len(data[k])} {k}" for k in TABLES)
    print(f"Wrote {OUT.relative_to(Path.cwd().parent)} — {counts}")


if __name__ == "__main__":
    main()
