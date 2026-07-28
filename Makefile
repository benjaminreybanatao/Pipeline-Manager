.PHONY: help up down install migrate seed reseed api web test build lint

PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## start postgres
	docker compose up -d
	@echo "waiting for postgres..." && sleep 3

down: ## stop postgres
	docker compose down

install: ## create the venv and install both toolchains
	python3 -m venv backend/.venv
	$(PIP) install -e "backend[dev]"
	cd frontend && npm install

migrate: ## apply database migrations
	cd backend && .venv/bin/alembic upgrade head

seed: ## load the demo pipeline (no-op if deals already exist)
	cd backend && .venv/bin/python seed.py

reseed: ## wipe and reload the demo pipeline
	cd backend && .venv/bin/python seed.py --reset

api: ## run the API on :8000
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

web: ## run the frontend on :5173
	cd frontend && npm run dev

test: ## run the backend test suite
	cd backend && .venv/bin/python -m pytest -q

build: ## typecheck and build the frontend
	cd frontend && npm run build
