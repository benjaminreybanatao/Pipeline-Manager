"""Load a realistic demo pipeline.

Run with ``python seed.py`` (add ``--reset`` to wipe existing data first).

Deals are not just dropped into a stage — each one is walked forward through
the funnel with backdated history rows so that velocity, conversion and aging
metrics have something real to chew on.
"""

from __future__ import annotations

import argparse
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select

from app import models
from app.db import SessionLocal
from app.services.deals import DEFAULT_MILESTONES

random.seed(20260728)
NOW = datetime.now(timezone.utc)

STAGES = [
    # name, default probability, color, category
    ("Sourcing", 5, "#94a3b8", models.StageCategory.open),
    ("Screening", 10, "#38bdf8", models.StageCategory.open),
    ("Underwriting", 25, "#818cf8", models.StageCategory.open),
    ("LOI Submitted", 40, "#a78bfa", models.StageCategory.open),
    ("LOI Executed", 60, "#f472b6", models.StageCategory.open),
    ("Due Diligence", 75, "#fb923c", models.StageCategory.open),
    ("Closing", 90, "#facc15", models.StageCategory.open),
    ("Closed", 100, "#22c55e", models.StageCategory.won),
    ("Passed", 0, "#64748b", models.StageCategory.lost),
    ("Lost", 0, "#ef4444", models.StageCategory.lost),
]

USERS = [
    ("Dana Whitfield", "dana@example.com", "Managing Director, Acquisitions"),
    ("Marcus Lee", "marcus@example.com", "VP, Acquisitions"),
    ("Priya Raman", "priya@example.com", "Senior Analyst"),
    ("Tom Okafor", "tom@example.com", "Analyst"),
    ("Sofia Ibarra", "sofia@example.com", "Director, Capital Markets"),
]

PT = models.PropertyType
DT = models.DealType
SRC = models.DealSource

# name, property type, market, submarket, state, units, sf, year, ask, cap, irr, source
DEALS = [
    ("Cedar Ridge Apartments", PT.multifamily, "Dallas", "Richardson", "TX", 248, None, 2006, 62_000_000, 0.0510, 0.155, SRC.broker),
    ("Harborview Lofts", PT.multifamily, "Seattle", "Ballard", "WA", 130, None, 2015, 58_500_000, 0.0465, 0.142, SRC.broker),
    ("Northgate Industrial Park", PT.industrial, "Phoenix", "Deer Valley", "AZ", None, 412_000, 2019, 74_000_000, 0.0525, 0.148, SRC.broker),
    ("Maple Street Retail Center", PT.retail, "Charlotte", "South End", "NC", None, 88_500, 2004, 21_400_000, 0.0680, 0.131, SRC.off_market),
    ("Beacon Tower", PT.office, "Denver", "LoDo", "CO", None, 265_000, 1998, 96_000_000, 0.0730, 0.165, SRC.broker),
    ("Sunset Gardens", PT.multifamily, "Phoenix", "Tempe", "AZ", 312, None, 1988, 51_750_000, 0.0545, 0.171, SRC.off_market),
    ("Riverbend Logistics", PT.industrial, "Atlanta", "Fulton Industrial", "GA", None, 640_000, 2021, 112_000_000, 0.0490, 0.139, SRC.broker),
    ("Fifth & Vine Mixed-Use", PT.mixed_use, "Nashville", "Gulch", "TN", 96, 42_000, 2018, 68_900_000, 0.0505, 0.152, SRC.principal),
    ("Palm Court Self Storage", PT.self_storage, "Tampa", "Brandon", "FL", None, 96_000, 2016, 18_200_000, 0.0595, 0.144, SRC.broker),
    ("Ironworks Flats", PT.multifamily, "Austin", "East Austin", "TX", 184, None, 2020, 71_300_000, 0.0455, 0.136, SRC.broker),
    ("Del Mar Business Center", PT.office, "San Diego", "UTC", "CA", None, 148_000, 2008, 63_500_000, 0.0640, 0.158, SRC.referral),
    ("Grandview Crossing", PT.retail, "Columbus", "Grandview", "OH", None, 122_000, 1999, 27_800_000, 0.0715, 0.149, SRC.broker),
    ("Willow Creek Land Assemblage", PT.land, "Raleigh", "Cary", "NC", None, None, None, 9_600_000, None, 0.210, SRC.off_market),
    ("Lakeshore Commons", PT.multifamily, "Chicago", "Evanston", "IL", 206, None, 2012, 59_400_000, 0.0560, 0.147, SRC.broker),
    ("Piedmont Distribution", PT.industrial, "Charlotte", "Concord", "NC", None, 288_000, 2017, 47_500_000, 0.0535, 0.141, SRC.broker),
    ("The Winslow Hotel", PT.hospitality, "Savannah", "Historic District", "GA", 142, None, 1926, 43_000_000, 0.0810, 0.183, SRC.auction),
    ("Copper Mesa Apartments", PT.multifamily, "Salt Lake City", "Sugar House", "UT", 168, None, 2014, 48_900_000, 0.0500, 0.150, SRC.broker),
    ("Trailhead Commerce Center", PT.industrial, "Reno", "Sparks", "NV", None, 355_000, 2022, 66_400_000, 0.0515, 0.137, SRC.broker),
    ("Union Square Retail", PT.retail, "Portland", "Pearl District", "OR", None, 64_000, 2001, 19_750_000, 0.0690, 0.128, SRC.off_market),
    ("Brookfield Office Campus", PT.office, "Minneapolis", "Golden Valley", "MN", None, 312_000, 1995, 52_000_000, 0.0850, 0.192, SRC.broker),
    ("Alder Point Townhomes", PT.multifamily, "Boise", "Meridian", "ID", 88, None, 2019, 29_600_000, 0.0525, 0.146, SRC.referral),
    ("Gateway Freight Terminal", PT.industrial, "Memphis", "Southeast", "TN", None, 520_000, 2013, 58_000_000, 0.0620, 0.156, SRC.broker),
    ("Rosewood Senior Living", PT.multifamily, "Sarasota", "Lakewood Ranch", "FL", 124, None, 2017, 41_200_000, 0.0580, 0.163, SRC.principal),
    ("Canal District Redevelopment", PT.mixed_use, "Providence", "Downtown", "RI", 140, 55_000, 1912, 37_500_000, 0.0640, 0.201, SRC.off_market),
    ("Silverado Ranch Pads", PT.land, "Las Vegas", "Henderson", "NV", None, None, None, 12_400_000, None, 0.225, SRC.auction),
    ("Quarry Bend Apartments", PT.multifamily, "Kansas City", "Overland Park", "KS", 232, None, 2009, 54_800_000, 0.0555, 0.152, SRC.broker),
    ("Pier 9 Cold Storage", PT.industrial, "Newark", "Port Newark", "NJ", None, 210_000, 2020, 88_000_000, 0.0475, 0.134, SRC.broker),
    ("Foxglove Shopping Plaza", PT.retail, "Boise", "Boise Bench", "ID", None, 74_500, 1994, 15_900_000, 0.0745, 0.155, SRC.off_market),
]

BROKERS = [
    ("Alicia Nunez", "CBRE"),
    ("Grant Feldman", "JLL"),
    ("Maya Cho", "Cushman & Wakefield"),
    ("Rick Salvatore", "Newmark"),
    ("Elena Petrova", "Marcus & Millichap"),
    ("Devon Pierce", "Eastdil Secured"),
]

SELLERS = [
    "Northbridge Capital",
    "Ridgeline Partners",
    "Harper Family Trust",
    "Vantage REIT",
    "Coastline Holdings",
    "Blue Aspen Group",
]

TASK_TEMPLATES = {
    "Screening": ["Pull comps and submarket rent survey", "Confirm flood zone and insurance estimate"],
    "Underwriting": ["Build base-case model", "Normalize T-12 and reforecast opex", "Review rent roll for MTM upside"],
    "LOI Submitted": ["Circulate LOI redline to legal", "Confirm deposit schedule with seller"],
    "LOI Executed": ["Open escrow", "Kick off third-party reports"],
    "Due Diligence": ["Order PCA and Phase I", "Complete unit walk (100%)", "Finalize lender term sheet", "Review title and survey exceptions"],
    "Closing": ["Lock rate with lender", "Circulate closing statement", "Confirm insurance binder"],
}

DOC_TEMPLATES = [
    ("Offering Memorandum", models.DocumentCategory.om),
    ("Rent Roll", models.DocumentCategory.rent_roll),
    ("T-12 Operating Statement", models.DocumentCategory.t12),
    ("Underwriting Model", models.DocumentCategory.model),
]

NOTES = [
    "Broker indicated seller wants a 60-day close with a hard deposit at day 15.",
    "Submarket absorption held up through last quarter — concessions burning off.",
    "Insurance quote came back 18% above our underwriting; revisiting the expense line.",
    "Seller countered on price but is flexible on the DD period.",
    "Lender quoted SOFR + 235 at 60% LTV, IO for two years.",
    "Passed to IC for preliminary read before we spend on third parties.",
]


def reset(db) -> None:
    for model in (
        models.Activity,
        models.Document,
        models.Milestone,
        models.Task,
        models.DealTeamMember,
        models.DealStageHistory,
        models.Deal,
        models.Stage,
        models.User,
    ):
        db.execute(delete(model))
    db.commit()


def main(do_reset: bool) -> None:
    db = SessionLocal()
    try:
        if do_reset:
            reset(db)
        if db.scalar(select(models.Deal.id).limit(1)) is not None:
            print("Database already has deals — pass --reset to reload the demo pipeline.")
            return

        users = [models.User(name=n, email=e, title=t) for n, e, t in USERS]
        db.add_all(users)

        stages = [
            models.Stage(
                name=name,
                order_index=index,
                default_probability=probability,
                color=color,
                category=category,
            )
            for index, (name, probability, color, category) in enumerate(STAGES)
        ]
        db.add_all(stages)
        db.flush()

        by_name = {s.name: s for s in stages}
        open_stages = [s for s in stages if s.category == models.StageCategory.open]

        for index, (
            name,
            property_type,
            market,
            submarket,
            state,
            units,
            sf,
            year,
            ask,
            cap,
            irr,
            source,
        ) in enumerate(DEALS):
            # Where in the funnel does this deal end up, and how did it get there?
            outcome = random.random()
            if outcome < 0.14:
                path = open_stages + [by_name["Closed"]]
            elif outcome < 0.32:
                stop = random.randint(1, len(open_stages) - 1)
                path = open_stages[:stop] + [by_name["Passed" if random.random() < 0.6 else "Lost"]]
            else:
                path = open_stages[: random.randint(1, len(open_stages))]

            final_stage = path[-1]
            total_days = sum(random.randint(4, 30) for _ in path)
            created = NOW - timedelta(days=total_days + random.randint(0, 45))

            broker, firm = random.choice(BROKERS)
            ask_dec = Decimal(ask)
            offer = (ask_dec * Decimal(str(round(random.uniform(0.93, 1.01), 4)))).quantize(Decimal("1"))
            noi = (ask_dec * Decimal(str(cap))).quantize(Decimal("0.01")) if cap else None
            ltv = Decimal(str(round(random.uniform(0.55, 0.68), 4)))

            deal = models.Deal(
                name=name,
                deal_type=DT.acquisition,
                property_type=property_type,
                market=market,
                submarket=submarket,
                city=market,
                state=state,
                address=f"{random.randint(100, 9800)} {random.choice(['Main', 'Oak', 'Commerce', 'Willow', 'Harbor'])} St",
                units=units,
                square_feet=sf,
                year_built=year,
                asking_price=ask_dec,
                noi=noi,
                going_in_cap_rate=Decimal(str(cap)) if cap else None,
                stabilized_cap_rate=Decimal(str(round(cap + 0.004, 4))) if cap else None,
                target_irr=Decimal(str(irr)),
                target_equity_multiple=Decimal(str(round(random.uniform(1.6, 2.2), 2))),
                ltv=ltv,
                source=source,
                broker_name=broker if source == SRC.broker else None,
                broker_firm=firm if source == SRC.broker else None,
                seller_name=random.choice(SELLERS),
                owner_id=users[index % len(users)].id,
                stage_id=path[0].id,
                date_sourced=created.date(),
                created_at=created,
                updated_at=created,
                stage_entered_at=created,
            )

            # Deals that got an offer out carry pricing; earlier ones do not yet.
            if final_stage.order_index >= by_name["LOI Submitted"].order_index:
                deal.offer_price = offer
                deal.loan_amount = (offer * ltv).quantize(Decimal("1"))
                deal.equity_required = offer - deal.loan_amount
            db.add(deal)
            db.flush()

            # Walk the funnel, writing backdated history.
            cursor = created
            previous = None
            final_entered = created
            for stage in path:
                stint = random.randint(4, 30)
                exited = cursor + timedelta(days=stint)
                is_current = stage is final_stage
                if is_current:
                    final_entered = cursor
                db.add(
                    models.DealStageHistory(
                        deal_id=deal.id,
                        from_stage_id=previous.id if previous else None,
                        to_stage_id=stage.id,
                        entered_at=cursor,
                        exited_at=None if is_current else exited,
                        days_in_stage=None if is_current else stint,
                        changed_by_id=deal.owner_id,
                    )
                )
                if previous is not None:
                    db.add(
                        models.Activity(
                            deal_id=deal.id,
                            user_id=deal.owner_id,
                            type=models.ActivityType.stage_change,
                            body=f"Stage moved from {previous.name} to {stage.name}",
                            meta={"from_stage": previous.name, "to_stage": stage.name},
                            created_at=cursor,
                        )
                    )
                else:
                    db.add(
                        models.Activity(
                            deal_id=deal.id,
                            user_id=deal.owner_id,
                            type=models.ActivityType.created,
                            body=f"Deal created in {stage.name}",
                            created_at=cursor,
                        )
                    )
                previous = stage
                cursor = exited

            deal.stage_id = final_stage.id
            deal.stage_entered_at = final_entered
            deal.updated_at = final_entered

            if final_stage.category == models.StageCategory.won:
                deal.status = models.DealStatus.won
                deal.probability = 100
                deal.purchase_price = offer
                deal.actual_close_date = deal.stage_entered_at.date()
                deal.expected_close_date = deal.actual_close_date
            elif final_stage.category == models.StageCategory.lost:
                deal.status = models.DealStatus.lost
                deal.probability = 0
                deal.lost_reason = random.choice(
                    [
                        "Outbid — seller took a higher price with no financing contingency.",
                        "Retrade rejected after DD findings on the roof and HVAC.",
                        "Basis did not clear our return hurdle at current debt costs.",
                        "Seller pulled the asset from market.",
                    ]
                )
            else:
                deal.expected_close_date = (NOW + timedelta(days=random.randint(20, 210))).date()

            # The last stint runs past today for live deals; clamp so nothing
            # gets a "completed" timestamp in the future.
            ref = min(cursor, NOW)

            # Milestones: hit the ones the deal has passed.
            reached = final_stage.order_index
            for order, (milestone_name, critical) in enumerate(DEFAULT_MILESTONES):
                threshold = by_name["LOI Executed"].order_index + order - 1
                actual = None
                if final_stage.category != models.StageCategory.lost and reached > threshold:
                    actual = (ref - timedelta(days=random.randint(1, 40))).date()
                db.add(
                    models.Milestone(
                        deal_id=deal.id,
                        name=milestone_name,
                        is_critical=critical,
                        order_index=order,
                        target_date=(cursor + timedelta(days=order * 12 - 20)).date(),
                        actual_date=actual,
                    )
                )

            # Tasks for the current stage, plus a couple of stragglers from the last one.
            for stage in path[-2:]:
                for title in TASK_TEMPLATES.get(stage.name, []):
                    done = stage is not final_stage or random.random() < 0.45
                    due = (NOW + timedelta(days=random.randint(-12, 25))).date()
                    db.add(
                        models.Task(
                            deal_id=deal.id,
                            title=title,
                            due_date=due,
                            assignee_id=random.choice(users).id,
                            status=models.TaskStatus.done if done else random.choice(
                                [models.TaskStatus.open, models.TaskStatus.in_progress]
                            ),
                            priority=random.choice(
                                [models.TaskPriority.normal, models.TaskPriority.high, models.TaskPriority.low]
                            ),
                            completed_at=ref if done else None,
                            completed_by_id=deal.owner_id if done else None,
                            created_at=ref - timedelta(days=5),
                        )
                    )

            for doc_name, category in DOC_TEMPLATES[: random.randint(1, 4)]:
                db.add(
                    models.Document(
                        deal_id=deal.id,
                        name=f"{name} — {doc_name}",
                        url=f"https://files.example.com/deals/{deal.id}/{category.value}.pdf",
                        category=category,
                        added_by_id=deal.owner_id,
                        created_at=ref,
                    )
                )

            for teammate in random.sample(users, k=random.randint(2, 3)):
                db.add(
                    models.DealTeamMember(
                        deal_id=deal.id,
                        user_id=teammate.id,
                        role=random.choice(list(models.TeamRole)),
                    )
                )

            for body in random.sample(NOTES, k=random.randint(1, 3)):
                db.add(
                    models.Activity(
                        deal_id=deal.id,
                        user_id=random.choice(users).id,
                        type=models.ActivityType.note,
                        body=body,
                        created_at=ref - timedelta(days=random.randint(0, 20)),
                    )
                )

        db.commit()
        print(f"Seeded {len(USERS)} users, {len(STAGES)} stages, {len(DEALS)} deals.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="delete existing data first")
    main(parser.parse_args().reset)
