from decimal import Decimal

from app import models


def test_create_deal_starts_history_and_milestones(client, stages, users):
    response = client.post(
        "/api/deals",
        json={"name": "Cedar Ridge", "asking_price": "10000000", "market": "Dallas"},
        headers={"X-User-Id": str(users[0].id)},
    )
    assert response.status_code == 201, response.text
    deal = response.json()
    assert deal["stage"]["name"] == "Sourcing"
    assert deal["owner"]["id"] == users[0].id

    history = client.get(f"/api/deals/{deal['id']}/history").json()
    assert len(history) == 1
    assert history[0]["to_stage"]["name"] == "Sourcing"
    assert history[0]["exited_at"] is None

    milestones = client.get(f"/api/deals/{deal['id']}/milestones").json()
    assert [m["name"] for m in milestones][:2] == ["LOI Signed", "PSA Executed"]

    activities = client.get(f"/api/deals/{deal['id']}/activities").json()
    assert activities[0]["type"] == "created"


def test_create_deal_can_skip_milestones(client, stages, users):
    deal = client.post(
        "/api/deals", json={"name": "No Milestones", "seed_default_milestones": False}
    ).json()
    assert client.get(f"/api/deals/{deal['id']}/milestones").json() == []


def test_deal_value_falls_back_through_price_fields(client, make_deal):
    make_deal("Ask only", asking_price=Decimal("5000000"))
    make_deal("Offer beats ask", asking_price=Decimal("5000000"), offer_price=Decimal("4800000"))
    make_deal(
        "Purchase wins",
        asking_price=Decimal("5000000"),
        offer_price=Decimal("4800000"),
        purchase_price=Decimal("4700000"),
    )
    by_name = {d["name"]: d for d in client.get("/api/deals").json()["items"]}
    assert by_name["Ask only"]["deal_value"] == "5000000.00"
    assert by_name["Offer beats ask"]["deal_value"] == "4800000.00"
    assert by_name["Purchase wins"]["deal_value"] == "4700000.00"


def test_weighted_value_uses_stage_default_until_overridden(client, make_deal):
    make_deal("Default prob", stage="Underwriting", asking_price=Decimal("1000000"))
    deal = client.get("/api/deals").json()["items"][0]
    assert deal["effective_probability"] == 50
    assert deal["weighted_value"] == "500000.00"

    updated = client.patch(f"/api/deals/{deal['id']}", json={"probability": 75}).json()
    assert updated["effective_probability"] == 75
    assert updated["weighted_value"] == "750000.00"


def test_price_per_unit_and_sf(client, make_deal):
    make_deal("Units", asking_price=Decimal("10000000"), units=100)
    make_deal("SF", asking_price=Decimal("10000000"), square_feet=50_000)
    by_name = {d["name"]: d for d in client.get("/api/deals").json()["items"]}
    assert by_name["Units"]["price_per_unit"] == "100000.00"
    assert by_name["SF"]["price_per_sf"] == "200.00"


def test_filters_and_search(client, make_deal, users, stages):
    make_deal("Cedar Ridge", market="Dallas", asking_price=Decimal("10000000"))
    make_deal(
        "Harborview",
        stage="Underwriting",
        market="Seattle",
        asking_price=Decimal("50000000"),
        property_type=models.PropertyType.office,
    )
    make_deal("Northgate", market="Dallas", asking_price=Decimal("90000000"), broker_name="Maya Cho")

    assert client.get("/api/deals", params={"q": "cedar"}).json()["total"] == 1
    assert client.get("/api/deals", params={"q": "Maya"}).json()["total"] == 1
    assert client.get("/api/deals", params={"market": "Dallas"}).json()["total"] == 2
    assert client.get("/api/deals", params={"stage_id": stages["Underwriting"].id}).json()["total"] == 1
    assert client.get("/api/deals", params={"property_type": "office"}).json()["total"] == 1
    assert client.get("/api/deals", params={"min_price": 20_000_000}).json()["total"] == 2
    assert (
        client.get("/api/deals", params={"min_price": 20_000_000, "max_price": 60_000_000}).json()["total"]
        == 1
    )
    assert client.get("/api/deals/markets").json() == ["Dallas", "Seattle"]


def test_sorting_and_pagination(client, make_deal):
    make_deal("A deal", asking_price=Decimal("3000000"))
    make_deal("B deal", asking_price=Decimal("1000000"))
    make_deal("C deal", asking_price=Decimal("2000000"))

    names = [d["name"] for d in client.get("/api/deals", params={"sort": "name"}).json()["items"]]
    assert names == ["A deal", "B deal", "C deal"]

    by_value = [d["name"] for d in client.get("/api/deals", params={"sort": "-value"}).json()["items"]]
    assert by_value == ["A deal", "C deal", "B deal"]

    page = client.get("/api/deals", params={"sort": "name", "page": 2, "page_size": 2}).json()
    assert page["total"] == 3 and page["pages"] == 2
    assert [d["name"] for d in page["items"]] == ["C deal"]

    assert client.get("/api/deals", params={"sort": "nonsense"}).status_code == 400


def test_patch_logs_only_tracked_changes(client, make_deal, users):
    deal = make_deal("Cedar Ridge", asking_price=Decimal("10000000"))
    client.patch(
        f"/api/deals/{deal.id}",
        json={"asking_price": "9500000", "submarket": "Richardson"},
        headers={"X-User-Id": str(users[1].id)},
    )
    activities = client.get(f"/api/deals/{deal.id}/activities").json()
    changes = [a for a in activities if a["type"] == "field_change"]
    assert len(changes) == 1
    assert changes[0]["meta"]["field"] == "asking_price"
    assert changes[0]["user"]["id"] == users[1].id

    # Writing the same value again is not a change.
    client.patch(f"/api/deals/{deal.id}", json={"asking_price": "9500000"})
    activities = client.get(f"/api/deals/{deal.id}/activities").json()
    assert len([a for a in activities if a["type"] == "field_change"]) == 1


def test_patch_rejects_stage_id(client, make_deal):
    deal = make_deal("Cedar Ridge")
    assert client.patch(f"/api/deals/{deal.id}", json={"stage_id": 2}).status_code == 422


def test_delete_deal_cascades(client, db, make_deal):
    deal = make_deal("Cedar Ridge")
    client.post(f"/api/deals/{deal.id}/tasks", json={"title": "Walk the units"})
    assert client.delete(f"/api/deals/{deal.id}").status_code == 204
    assert client.get(f"/api/deals/{deal.id}").status_code == 404
    assert db.query(models.Task).count() == 0
