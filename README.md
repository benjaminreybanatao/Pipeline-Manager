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

## Design system

Colors and typography follow DivcoWest's brand guideline. The literal PMS
values are split by role rather than reused everywhere as-is:

- **Green `#6AA442`** (7737 C) is the brand mark's exact color — used only in
  the logo (`src/components/BrandMark.tsx`). White text on it only clears
  3.0:1 contrast, short of the 4.5:1 normal text needs, so interactive UI
  (buttons, links, active states, `--good`) uses a deepened step, `#4C7A2A`
  (5.1:1), instead.
- **Cool Gray 11 `#54565B`** is the primary ink (7.3:1 on white) — the
  guideline's own "use for headlines and subheads."
- **Navy `#172852`, Blue `#0076AA`, Cool Gray 7 `#979899`, Gold `#EBA900`**
  (the guideline's "use for charts and graphs" set) are stepped per chart role:
  Blue + a deepened gold (`#C98500`) pair for two-series charts (validated with
  the dataviz skill's palette checker — literal `#EBA900` alone is too light
  for a categorical mark, 2.06:1); literal Navy reads as near-black/near-gray
  at that value (fails the categorical chroma floor) so it's reserved for
  single-hue bar charts (property type / market breakdowns) rather than paired
  with another series.
- **Gandhi Serif / Gandhi Sans** aren't licensed as web fonts — PT Serif and
  Nunito Sans are the closest open substitutes, applied per the guideline's
  own pattern: sans bold caps for headlines (`.heading` in `index.css`), serif
  italic for callouts/subtitles (`.callout`).

Per-stage kanban colors stay user-configurable (Settings → stage color picker)
rather than constrained to the brand palette — they're tenant data, not a
fixed design token, since a pipeline may have anywhere from 3 to a dozen
stages.

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

## Live demo build

`make demo` produces a **server-free build** of the frontend in `frontend/dist`:
the same app, but requests are answered by an in-browser store
(`frontend/src/demo/store.ts`) working off a snapshot of the seeded pipeline
instead of the API. Dragging deals, filtering, adding tasks and every dashboard
figure all work with nothing running behind them, and edits persist to
localStorage until you hit "Reset demo data".

It is a build target, not a mode of the real app — `import.meta.env.VITE_DEMO`
is a compile-time constant, so the normal build drops the branch and never
bundles the fixture.

Two details worth knowing:

- The fixture records when it was generated, and the store slides every date
  forward by however long ago that was. The board never looks stale: aging
  badges, "closing this quarter" and overdue tasks stay meaningful whenever
  someone opens it.
- Derived values are **recomputed**, not exported. The snapshot holds raw
  columns only, so weighted value, stage aging, conversion and the dashboard
  are calculated in the browser the same way `app/services/metrics.py`
  calculates them server-side.

Refresh the fixture after changing the seed:

```bash
make reseed && make demo-seed
```

`.github/workflows/pages.yml` builds and publishes this on every push to `main`
— set Settings → Pages → Source to "GitHub Actions" to enable it. The build
also writes `404.html`, since Pages has no SPA rewrite and deep links would
otherwise dead-end.

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
  export_demo.py       snapshots the database into the demo fixture
frontend/
  src/api/             fetch client + React Query hooks
  src/demo/            the server-free demo backend + its fixture
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
