from datetime import datetime, timedelta, timezone

from app import models
from app.services import deals as deal_service


def _history(client, deal_id):
    return client.get(f"/api/deals/{deal_id}/history").json()


def test_move_closes_previous_stint_and_counts_days(client, db, make_deal, stages, users):
    deal = make_deal("Cedar Ridge")
    # Backdate entry so the closed stint has a measurable duration.
    row = deal_service.open_history_row(db, deal.id)
    row.entered_at = datetime.now(timezone.utc) - timedelta(days=12, hours=1)
    db.commit()

    response = client.post(
        f"/api/deals/{deal.id}/stage",
        json={"stage_id": stages["Underwriting"].id, "note": "IC gave the green light"},
        headers={"X-User-Id": str(users[1].id)},
    )
    assert response.status_code == 200
    assert response.json()["stage"]["name"] == "Underwriting"
    assert response.json()["days_in_stage"] == 0

    history = _history(client, deal.id)
    assert len(history) == 2
    closed, current = history
    assert closed["exited_at"] is not None
    assert closed["days_in_stage"] == 12
    assert current["from_stage"]["name"] == "Sourcing"
    assert current["exited_at"] is None

    activities = client.get(f"/api/deals/{deal.id}/activities").json()
    move = next(a for a in activities if a["type"] == "stage_change")
    assert move["body"] == "Stage moved from Sourcing to Underwriting: IC gave the green light"
    assert move["user"]["id"] == users[1].id


def test_moving_to_won_stage_closes_the_deal(client, make_deal, stages):
    deal = make_deal("Cedar Ridge")
    body = client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": stages["Closed"].id}).json()
    assert body["status"] == "won"
    assert body["probability"] == 100
    assert body["actual_close_date"] is not None


def test_moving_to_lost_stage_zeroes_probability(client, make_deal, stages):
    deal = make_deal("Cedar Ridge", probability=60)
    body = client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": stages["Lost"].id}).json()
    assert body["status"] == "lost"
    assert body["probability"] == 0
    assert body["weighted_value"] == "0.00"


def test_reopening_a_closed_deal_clears_terminal_fields(client, make_deal, stages):
    deal = make_deal("Cedar Ridge")
    client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": stages["Closed"].id})
    body = client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": stages["Closing"].id}).json()
    assert body["status"] == "active"
    assert body["actual_close_date"] is None
    assert body["effective_probability"] == 90  # back to the stage default


def test_moving_to_the_same_stage_is_a_no_op(client, make_deal, stages):
    deal = make_deal("Cedar Ridge")
    client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": stages["Sourcing"].id})
    assert len(_history(client, deal.id)) == 1
    activities = client.get(f"/api/deals/{deal.id}/activities").json()
    assert [a for a in activities if a["type"] == "stage_change"] == []


def test_move_to_unknown_stage_404s(client, make_deal):
    deal = make_deal("Cedar Ridge")
    assert client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": 9999}).status_code == 404


def test_unused_stage_can_be_deleted(client, stages):
    assert client.delete(f"/api/stages/{stages['Closing'].id}").status_code == 204


def test_stage_delete_blocked_while_deals_remain(client, make_deal, stages):
    deal = make_deal("Cedar Ridge")
    blocked = client.delete(f"/api/stages/{stages['Sourcing'].id}")
    assert blocked.status_code == 409
    assert "still in this stage" in blocked.json()["detail"]

    # Moving the deal out is not enough — the stage still owns reporting history.
    client.post(f"/api/deals/{deal.id}/stage", json={"stage_id": stages["Underwriting"].id})
    still_blocked = client.delete(f"/api/stages/{stages['Sourcing'].id}")
    assert still_blocked.status_code == 409
    assert "reporting history" in still_blocked.json()["detail"]


def test_stage_reorder(client, stages):
    order = [stages[n].id for n in ["Underwriting", "Sourcing", "Closing", "Closed", "Lost"]]
    body = client.post("/api/stages/reorder", json={"stage_ids": order}).json()
    assert [s["name"] for s in body] == ["Underwriting", "Sourcing", "Closing", "Closed", "Lost"]
    assert [s["order_index"] for s in body] == [0, 1, 2, 3, 4]
