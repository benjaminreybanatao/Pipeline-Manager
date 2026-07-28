# Pipeline Manager

A commercial real estate deal pipeline manager — deals move through configurable
stages on a kanban board, carry the underwriting fields an acquisitions team
actually filters on, and every move is recorded so the reporting reflects what
happened rather than where a deal happens to sit today.

- **Pipeline board** — drag deals between stages; cards show value, owner,
  days-in-stage aging and overdue-task flags.
- **Deals table** — sortable, filterable, CSV export. Filters live in the URL and
  are shared with the board.
- **Deal record** — overview (identification, location, physical, economics,
  process, counterparties), tasks, milestones, deal team, document links, and an
  activity feed that auto-logs stage moves and tracked field changes.
- **Dashboard** — pipeline value by stage, conversion funnel measured from stage
  history, deal flow and closed volume by month, breakdowns by property type and
  market, plus stalled-deal and stage-detail tables.
- **Settings** — add, rename, recolor, reorder and re-weight stages; manage the
  team roster.

Stack: React + TypeScript (Vite) · FastAPI + SQLAlchemy 2 · PostgreSQL.

## Quick start

```bash
make up        # postgres 16 via docker compose, on :5432
make install   # python venv + npm install
make migrate   # alembic upgrade head
make seed      # ~28 demo deals walked through the funnel with backdated history
make api       # http://127.0.0.1:8000  (docs at /docs)
make web       # http://localhost:5173
```

`make web` proxies `/api` to the backend, so the app runs on a single origin in
development. `make help` lists every target.

Not using Docker? Point `DATABASE_URL` at any Postgres 16 instance — see
`backend/.env.example` for the settings the API reads.

## Testing

```bash
make test      # pytest against the pipeline_test database
make build     # frontend typecheck + production build
```

The backend suite covers the logic that is expensive to get wrong: stage-move
history bookkeeping, terminal-stage side effects, deal filtering and sorting,
activity auto-logging, and every dashboard aggregation asserted against
hand-computed numbers.

## How it is put together

```
backend/
  app/models.py        SQLAlchemy models
  app/routers/         one router per resource, all mounted under /api
  app/services/
    deals.py           stage moves, history bookkeeping, task-count fan-in
    activity.py        the audit trail (field diffing lives here)
    metrics.py         dashboard aggregations, kept out of the routers so they
                       can be unit-tested directly
  seed.py              demo pipeline
frontend/
  src/api/             fetch client + React Query hooks
  src/components/      shared UI, kanban, charts, deal tabs
  src/pages/           Pipeline · Deals · DealDetail · Dashboard · Settings
```

A few decisions worth knowing:

- **Stage moves have their own endpoint** (`POST /api/deals/{id}/stage`) rather
  than being a field on `PATCH`. It closes out the previous
  `deal_stage_history` row, opens a new one, sets status and close date for
  terminal stages, and logs the move — none of which should be skippable.
- **Conversion is measured from history**, not current position: a deal now in
  Closing still counts as a conversion for every stage it passed through, and a
  loss never counts as progress.
- **A stage that deals have moved through cannot be deleted**, since it owns the
  reporting history. Rename it instead.
- **Deal value** is the first of purchase price, offer price, asking price that
  is set. Weighted value multiplies it by the deal's probability override, or the
  stage default when there is no override.

## Authentication

There is none yet. The frontend has an "Acting as" picker in the header and
sends the chosen user as an `X-User-Id` header; the API resolves it in
`app/deps.py:get_current_user` and falls back to the first active user so the
activity log always has an author. Adding real auth means changing that one
dependency and the header the client sends — the rest of the app already models
users, owners, assignees and deal teams.
