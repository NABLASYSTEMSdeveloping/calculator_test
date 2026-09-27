# Миссия calculator-test-app: dev-хелперы
SHELL := /bin/bash

VENV := .venv
PY := $(VENV)/bin/python

.PHONY: help install test test-backend test-frontend typecheck build dev-backend dev-frontend up down smoke qa qa-build

help:
	@echo "make install        — установить зависимости backend (venv) и frontend (npm)"
	@echo "make test           — все тесты (backend + frontend)"
	@echo "make test-backend   — pytest в backend/"
	@echo "make test-frontend  — vitest run в frontend/"
	@echo "make typecheck      — tsc --noEmit"
	@echo "make build          — production-сборка фронта"
	@echo "make dev-backend    — uvicorn :8000"
	@echo "make dev-frontend   — vite dev :5173"
	@echo "make up / down      — docker compose поднять/остановить"
	@echo "make smoke          — HTTP-проверки живого backend по контрактным фикстурам"
	@echo "make qa             — независимая QA-проверка контракта (статика + живой backend)"
	@echo "make qa-build       — то же + проверка, что сборка уважает VITE_APP_VERSION"

install:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -q -r backend/requirements-dev.txt
	cd frontend && npm install --no-audit --no-fund

test: test-backend test-frontend

test-backend:
	cd backend && ../$(PY) -m pytest

test-frontend:
	cd frontend && npm test

typecheck:
	cd frontend && npm run typecheck

build:
	cd frontend && npm run build

dev-backend:
	cd backend && ../$(PY) -m uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

up:
	docker compose up --build -d

down:
	docker compose down

smoke:
	./scripts/smoke.sh

qa:
	./scripts/qa_review.sh

qa-build:
	./scripts/qa_review.sh --build-check
