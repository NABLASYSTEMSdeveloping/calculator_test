# calculator_test — миссия `calculator-test-app`

Тестовый проект «фабрики»: каноничный калькулятор с архитектурой frontend ↔ backend.
Фронт — React SPA, вычисления выполняет backend по REST API. Документация и контракты — часть результата.

## Сервисы и структура

| Путь | Сервис | Назначение |
| --- | --- | --- |
| `services/calculator-test-app/CONTRACT.md` | контракт | Источник правды по интерфейсам сервиса `frontend` |
| `services/calculator-test-app/fixtures/*.json` | контракт | Контрактные фикстуры запросов/ответов (общие для frontend и backend) |
| `registry/contracts.json` | реестр | Реестр контрактов: опубликованные версии сервисов |
| `frontend/` | `frontend` | React 18 + TypeScript + Vite, SPA-калькулятор, HTTP-клиент backend |
| `backend/` | `backend` | FastAPI-сервис: Decimal-арифметика, история операций |
| `docker-compose.yml` | инфраструктура | Запуск обоих сервисов, общий том со сборкой фронта |

Взаимодействие: `frontend` → `POST /api/v1/calculate`, `GET /api/v1/operations`, `GET|DELETE /api/v1/history`,
`GET /health`. Арифметики во фронте нет — только ввод, формат и отображение.

## Требования

- Node.js ≥ 20 (проверено на 22.23.3), npm ≥ 10
- Python ≥ 3.11
- (опционально) Docker + docker compose

## Быстрый старт (dev)

```bash
make install          # venv backend + npm install frontend
make dev-backend      # http://localhost:8000 (Swagger: /docs)
make dev-frontend     # http://localhost:5173 (VITE_API_BASE_URL по умолчанию :8000)
```

## Запуск в контейнерах

```bash
make up               # backend :8000 + frontend :5173 (nginx, общий том frontend_dist)
make down
```

## Тесты и проверки

```bash
make test             # backend (pytest) + frontend (vitest)
make test-backend     # арифметика, HTTP API, контрактные фикстуры
make test-frontend    # ввод, машина состояний, HTTP-клиент, UI, реестр контрактов
make typecheck        # tsc --noEmit
make build            # production-сборка SPA
make smoke            # живой HTTP-контур backend против контрактных фикстур
make qa               # независимая QA-проверка: статика frontend + живой контракт backend
make qa-build         # то же + проверка, что сборка уважает VITE_APP_VERSION
```

## QA и приёмка

Независимая проверка соответствия опубликованного контракта фактическому поведению сервисов:

- отчёт: `QA-REVIEW.md` (факты, воспроизводимые команды, найденные расхождения, статус устранения);
- инструмент: `./scripts/qa_review.sh [--build-check]` — поднимает живой backend и сверяет §5.1
  (HTTP-контракт потребителя), §3.2 и §5.2 (статика и сборка frontend) с фактическими ответами;
- машинный чек без сети: `python scripts/qa_contract_review.py --static-only`.

## Контракты

- Контракт сервиса `frontend`: `services/calculator-test-app/CONTRACT.md` (версия `1.0.0`).
- Опубликованная версия: `registry/contracts.json` (запись `frontend`).
- Зависимость `backend` описана как контракт потребителя (раздел 5.1 CONTRACT.md) и подтверждена
  тестами `frontend/src/api/contract.test.ts` + `backend/tests/test_contract_fixtures.py` на общих фикстурах.
- Ломающее изменение интерфейса `backend` обнаруживается контрактными тестами: работа останавливается
  и эскалируется владельцу (порядок описан в CONTRACT.md, раздел 8).
