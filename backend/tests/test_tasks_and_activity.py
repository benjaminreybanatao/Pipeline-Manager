from datetime import timedelta

from app import models


def test_task_completion_stamps_and_logs(client, make_deal, users, yesterday):
    deal = make_deal("Cedar Ridge")
    task = client.post(
        f"/api/deals/{deal.id}/tasks",
        json={"title": "Order Phase I", "due_date": str(yesterday)},
    ).json()
    assert task["is_overdue"] is True
    assert task["completed_at"] is None

    done = client.patch(
        f"/api/tasks/{task['id']}",
        json={"status": "done"},
        headers={"X-User-Id": str(users[1].id)},
    ).json()
    assert done["completed_at"] is not None
    assert done["is_overdue"] is False

    bodies = [a["body"] for a in client.get(f"/api/deals/{deal.id}/activities").json()]
    assert "Task added: Order Phase I" in bodies
    assert "Task completed: Order Phase I" in bodies

    reopened = client.patch(f"/api/tasks/{task['id']}", json={"status": "open"}).json()
    assert reopened["completed_at"] is None
    assert "Task reopened: Order Phase I" in [
        a["body"] for a in client.get(f"/api/deals/{deal.id}/activities").json()
    ]


def test_open_and_overdue_task_counts_ride_along_with_deals(client, make_deal, yesterday):
    deal = make_deal("Cedar Ridge")
    client.post(f"/api/deals/{deal.id}/tasks", json={"title": "Late", "due_date": str(yesterday)})
    client.post(
        f"/api/deals/{deal.id}/tasks",
        json={"title": "Upcoming", "due_date": str(yesterday + timedelta(days=30))},
    )
    finished = client.post(f"/api/deals/{deal.id}/tasks", json={"title": "Finished"}).json()
    client.patch(f"/api/tasks/{finished['id']}", json={"status": "done"})

    listed = client.get("/api/deals").json()["items"][0]
    assert listed["open_task_count"] == 2
    assert listed["overdue_task_count"] == 1


def test_cross_deal_task_list(client, make_deal, users, yesterday):
    a = make_deal("Cedar Ridge")
    b = make_deal("Harborview")
    client.post(
        f"/api/deals/{a.id}/tasks",
        json={"title": "Late for Dana", "due_date": str(yesterday), "assignee_id": users[0].id},
    )
    client.post(
        f"/api/deals/{b.id}/tasks",
        json={"title": "Someday", "assignee_id": users[1].id},
    )

    everything = client.get("/api/tasks").json()
    assert {t["deal_name"] for t in everything} == {"Cedar Ridge", "Harborview"}
    mine = client.get("/api/tasks", params={"assignee_id": users[0].id}).json()
    assert [t["title"] for t in mine] == ["Late for Dana"]
    overdue = client.get("/api/tasks", params={"overdue": True}).json()
    assert [t["title"] for t in overdue] == ["Late for Dana"]


def test_milestone_hit_is_logged_once(client, stages, users, today):
    deal = client.post("/api/deals", json={"name": "Cedar Ridge"}).json()
    milestones = client.get(f"/api/deals/{deal['id']}/milestones").json()
    loi = milestones[0]
    assert loi["is_overdue"] is False

    client.patch(f"/api/milestones/{loi['id']}", json={"actual_date": str(today)})
    client.patch(f"/api/milestones/{loi['id']}", json={"is_critical": True})
    hits = [
        a
        for a in client.get(f"/api/deals/{deal['id']}/activities").json()
        if a["type"] == "milestone"
    ]
    assert len(hits) == 1
    assert hits[0]["body"].startswith("Milestone hit: LOI Signed")


def test_notes_documents_and_team(client, make_deal, users):
    deal = make_deal("Cedar Ridge")

    note = client.post(
        f"/api/deals/{deal.id}/notes",
        json={"body": "Seller wants a 60-day close."},
        headers={"X-User-Id": str(users[1].id)},
    ).json()
    assert note["type"] == "note" and note["user"]["id"] == users[1].id

    doc = client.post(
        f"/api/deals/{deal.id}/documents",
        json={"name": "OM", "url": "https://example.com/om.pdf", "category": "om"},
    ).json()
    assert doc["added_by"]["id"] == users[0].id
    assert len(client.get(f"/api/deals/{deal.id}/documents").json()) == 1

    client.post(f"/api/deals/{deal.id}/team", json={"user_id": users[1].id, "role": "legal"})
    # Adding the same person again updates their role instead of duplicating.
    client.post(f"/api/deals/{deal.id}/team", json={"user_id": users[1].id, "role": "analyst"})
    team = client.get(f"/api/deals/{deal.id}/team").json()
    assert len(team) == 1 and team[0]["role"] == "analyst"

    detail = client.get(f"/api/deals/{deal.id}").json()
    assert detail["team"][0]["user"]["name"] == "Marcus Lee"

    assert client.delete(f"/api/team/{team[0]['id']}").status_code == 204
    assert client.get(f"/api/deals/{deal.id}/team").json() == []


def test_current_user_falls_back_when_header_is_missing(client, make_deal, users):
    deal = make_deal("Cedar Ridge")
    note = client.post(f"/api/deals/{deal.id}/notes", json={"body": "No header"}).json()
    assert note["user"]["id"] == users[0].id
    assert client.get("/api/users/me").json()["id"] == users[0].id
    assert client.get("/api/users/me", headers={"X-User-Id": str(users[1].id)}).json()["id"] == users[1].id


def test_duplicate_user_email_rejected(client, users):
    response = client.post("/api/users", json={"name": "Clone", "email": "dana@example.com"})
    assert response.status_code == 409
