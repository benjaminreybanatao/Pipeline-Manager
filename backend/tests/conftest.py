import os
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app import models
from app.db import Base, get_db
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://postgres@127.0.0.1:5432/pipeline_test"
)

engine = create_engine(TEST_DATABASE_URL, future=True)
TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean():
    """Truncate between tests so each one starts from a known pipeline."""
    tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def users(db):
    people = [
        models.User(name="Dana Whitfield", email="dana@example.com"),
        models.User(name="Marcus Lee", email="marcus@example.com"),
    ]
    db.add_all(people)
    db.commit()
    return people


@pytest.fixture
def stages(db):
    """A miniature but complete funnel: three open stages plus won and lost."""
    rows = [
        models.Stage(name="Sourcing", order_index=0, default_probability=10, category=models.StageCategory.open),
        models.Stage(name="Underwriting", order_index=1, default_probability=50, category=models.StageCategory.open),
        models.Stage(name="Closing", order_index=2, default_probability=90, category=models.StageCategory.open),
        models.Stage(name="Closed", order_index=3, default_probability=100, category=models.StageCategory.won),
        models.Stage(name="Lost", order_index=4, default_probability=0, category=models.StageCategory.lost),
    ]
    db.add_all(rows)
    db.commit()
    return {s.name: s for s in rows}


@pytest.fixture
def make_deal(db, stages, users):
    def _make(name: str, stage: str = "Sourcing", **kwargs):
        deal = models.Deal(name=name, stage_id=stages[stage].id, owner_id=users[0].id, **kwargs)
        db.add(deal)
        db.flush()
        db.add(
            models.DealStageHistory(
                deal_id=deal.id,
                to_stage_id=stages[stage].id,
                entered_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        db.refresh(deal)
        return deal

    return _make


@pytest.fixture
def today():
    return date.today()


@pytest.fixture
def yesterday():
    return date.today() - timedelta(days=1)
