"""Every number here is hand-computed from the fixture — these are the figures
people quote in a pipeline meeting, so a silent drift would be expensive."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app import models
from app.config import settings
from app.services import metrics


def _quarter_date(today: date) -> date:
    """A date guaranteed to sit inside the current calendar quarter."""
    return date(today.year, (today.month - 1) // 3 * 3 + 1, 15)


def test_summary(client, db, make_deal, stages, today):
    make_deal("A", stage="Sourcing", asking_price=Decimal("10000000"))
    make_deal(
        "B",
        stage="Underwriting",
        asking_price=Decimal("20000000"),
        expected_close_date=_quarter_date(today),
    )
    make_deal(
        "C",
        stage="Closing",
        offer_price=Decimal("30000000"),
        probability=80,
        expected_close_date=today + timedelta(days=400),
    )
    make_deal(
        "Won",
        stage="Closed",
        status=models.DealStatus.won,
        purchase_price=Decimal("5000000"),
        actual_close_date=today,
    )
    make_deal("Lost", stage="Lost", status=models.DealStatus.lost, asking_price=Decimal("1000000"))

    body = client.get("/api/analytics/summary").json()
    assert body["active_deals"] == 3
    assert body["total_pipeline_value"] == "60000000.00"
    # 10M*10% + 20M*50% + 30M*80% (override beats the 90% stage default)
    assert body["weighted_pipeline_value"] == "35000000.00"
    assert body["closing_this_quarter"] == 1
    assert body["closing_this_quarter_value"] == "20000000.00"
    assert body["won_deals"] == 1 and body["lost_deals"] == 1
    assert body["win_rate"] == 0.5


def test_summary_counts_stalled_and_overdue(client, db, make_deal, stages, yesterday):
    fresh = make_deal("Fresh")
    stale = make_deal("Stale")
    stale.stage_entered_at = datetime.now(timezone.utc) - timedelta(
        days=settings.stage_stale_days + 3
    )
    db.add(models.Task(deal_id=fresh.id, title="Late task", due_date=yesterday))
    db.add(models.Task(deal_id=fresh.id, title="Future task", due_date=yesterday + timedelta(days=30)))
    db.add(
        models.Task(
            deal_id=fresh.id,
            title="Late but done",
            due_date=yesterday,
            status=models.TaskStatus.done,
        )
    )
    db.commit()

    body = client.get("/api/analytics/summary").json()
    assert body["stalled_deals"] == 1
    assert body["overdue_tasks"] == 1


def test_by_stage_buckets(client, make_deal, stages):
    make_deal("A", stage="Sourcing", asking_price=Decimal("10000000"))
    make_deal("B", stage="Sourcing", asking_price=Decimal("30000000"))
    make_deal("C", stage="Underwriting", asking_price=Decimal("20000000"))

    buckets = {b["stage_name"]: b for b in client.get("/api/analytics/by-stage").json()}
    assert buckets["Sourcing"]["deal_count"] == 2
    assert buckets["Sourcing"]["total_value"] == "40000000.00"
    assert buckets["Sourcing"]["weighted_value"] == "4000000.00"
    assert buckets["Underwriting"]["weighted_value"] == "10000000.00"
    assert buckets["Closed"]["deal_count"] == 0
    # Stages come back in funnel order so the board can render straight from this.
    assert [b["stage_name"] for b in client.get("/api/analytics/by-stage").json()][:3] == [
        "Sourcing",
        "Underwriting",
        "Closing",
    ]


def test_funnel_conversion_uses_history_not_current_position(client, db, make_deal, stages):
    advanced = make_deal("Advanced")
    lost = make_deal("Lost early", status=models.DealStatus.lost)
    parked = make_deal("Parked")

    now = datetime.now(timezone.utc)
    # "Advanced" walked Sourcing -> Underwriting -> Closing and is still there.
    db.add_all(
        [
            models.DealStageHistory(
                deal_id=advanced.id,
                from_stage_id=stages["Sourcing"].id,
                to_stage_id=stages["Underwriting"].id,
                entered_at=now - timedelta(days=20),
                exited_at=now - timedelta(days=10),
                days_in_stage=10,
            ),
            models.DealStageHistory(
                deal_id=advanced.id,
                from_stage_id=stages["Underwriting"].id,
                to_stage_id=stages["Closing"].id,
                entered_at=now - timedelta(days=10),
            ),
            # "Lost early" went straight from Sourcing to the Lost stage.
            models.DealStageHistory(
                deal_id=lost.id,
                from_stage_id=stages["Sourcing"].id,
                to_stage_id=stages["Lost"].id,
                entered_at=now - timedelta(days=5),
            ),
        ]
    )
    db.commit()

    steps = {s["stage_name"]: s for s in client.get("/api/analytics/funnel").json()}
    assert steps["Sourcing"]["entered"] == 3
    assert steps["Sourcing"]["advanced"] == 1  # only "Advanced"; a loss is not progress
    assert steps["Sourcing"]["conversion_rate"] == round(1 / 3, 4)
    assert steps["Underwriting"]["entered"] == 1
    assert steps["Underwriting"]["conversion_rate"] == 1.0
    assert steps["Underwriting"]["avg_days_in_stage"] == 10.0
    assert steps["Closing"]["entered"] == 1
    assert steps["Closing"]["advanced"] == 0
    assert steps["Closing"]["conversion_rate"] == 0.0
    # Terminal stages are not funnel steps.
    assert "Lost" not in steps and "Closed" not in steps
    assert parked.id  # sourced but never moved


def test_funnel_counts_a_closed_deal_as_advanced(client, db, make_deal, stages):
    won = make_deal("Won", status=models.DealStatus.won)
    db.add(
        models.DealStageHistory(
            deal_id=won.id,
            from_stage_id=stages["Sourcing"].id,
            to_stage_id=stages["Closed"].id,
            entered_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    steps = {s["stage_name"]: s for s in client.get("/api/analytics/funnel").json()}
    assert steps["Sourcing"]["entered"] == 1
    assert steps["Sourcing"]["advanced"] == 1


def test_trends(client, db, make_deal, stages, today):
    make_deal("Sourced now", date_sourced=today)
    make_deal(
        "Closed now",
        stage="Closed",
        status=models.DealStatus.won,
        purchase_price=Decimal("7000000"),
        actual_close_date=today,
        date_sourced=today,
    )
    body = client.get("/api/analytics/trends", params={"months": 3}).json()
    assert len(body["months"]) == 3
    this_month = body["months"][-1]
    assert this_month["month"] == today.strftime("%Y-%m")
    assert this_month["sourced"] == 2
    assert this_month["closed"] == 1
    assert this_month["closed_value"] == "7000000.00"
    # Breakdowns cover live deals only, so the closed one drops out.
    assert body["by_property_type"] == [
        {"label": "multifamily", "deal_count": 1, "total_value": "0.00"}
    ]


def test_quarter_bounds_wrap_the_year():
    assert metrics._quarter_bounds(date(2026, 11, 20)) == (date(2026, 10, 1), date(2027, 1, 1))
    assert metrics._quarter_bounds(date(2026, 2, 3)) == (date(2026, 1, 1), date(2026, 4, 1))
