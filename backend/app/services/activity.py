"""Activity-feed helpers.

Every mutation that a teammate would want to see later funnels through here so
the deal's Activity tab is a complete audit trail rather than just user notes.
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy.orm import Session

from app import models

# Fields whose changes are worth an activity entry. Anything not listed (e.g.
# free-text notes on the record) still saves, it just does not create noise.
TRACKED_FIELDS: dict[str, str] = {
    "name": "Name",
    "status": "Status",
    "deal_type": "Deal type",
    "property_type": "Property type",
    "owner_id": "Owner",
    "asking_price": "Asking price",
    "offer_price": "Offer price",
    "purchase_price": "Purchase price",
    "noi": "NOI",
    "going_in_cap_rate": "Going-in cap rate",
    "stabilized_cap_rate": "Stabilized cap rate",
    "target_irr": "Target IRR",
    "target_equity_multiple": "Target equity multiple",
    "loan_amount": "Loan amount",
    "ltv": "LTV",
    "equity_required": "Equity required",
    "probability": "Probability",
    "expected_close_date": "Expected close",
    "actual_close_date": "Actual close",
    "market": "Market",
    "units": "Units",
    "square_feet": "Square feet",
    "broker_name": "Broker",
    "seller_name": "Seller",
    "lost_reason": "Lost reason",
}


def _display(value: Any) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, Enum):
        return value.value.replace("_", " ")
    if isinstance(value, Decimal):
        normalized = value.normalize()
        return f"{normalized:f}"
    return str(value)


def log(
    db: Session,
    deal: models.Deal,
    user: models.User | None,
    type_: models.ActivityType,
    body: str,
    meta: dict | None = None,
) -> models.Activity:
    activity = models.Activity(
        deal_id=deal.id,
        user_id=user.id if user else None,
        type=type_,
        body=body,
        meta=meta,
    )
    db.add(activity)
    return activity


def log_field_changes(
    db: Session,
    deal: models.Deal,
    user: models.User | None,
    before: dict[str, Any],
    after: dict[str, Any],
) -> list[models.Activity]:
    """Emit one entry per tracked field that actually changed."""
    entries: list[models.Activity] = []
    for field, label in TRACKED_FIELDS.items():
        if field not in after:
            continue
        old, new = before.get(field), after.get(field)
        if old == new:
            continue
        entries.append(
            log(
                db,
                deal,
                user,
                models.ActivityType.field_change,
                f"{label} changed from {_display(old)} to {_display(new)}",
                {"field": field, "from": _display(old), "to": _display(new)},
            )
        )
    return entries


def snapshot(deal: models.Deal, fields: list[str]) -> dict[str, Any]:
    return {field: getattr(deal, field) for field in fields}
