# Сервис `frontend` (миссия calculator-test-app)

React SPA калькулятора: ввод операндов, выбор операции, история операций.
Вычисления выполняет сервис `backend` по REST API — во фронте арифметики нет.

## Скрипты

```bash
npm install          # установка зависимостей
npm run dev          # vite dev-server, http://localhost:5173
npm test             # vitest run (все тесты)
npm run test:watch   # vitest в watch-режиме
npm run typecheck    # tsc --noEmit
npm run build        # production-сборка в dist/
npm run preview      # предпросмотр сборки
```

## Конфигурация (build-time)

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Базовый URL сервиса backend |
| `VITE_API_TIMEOUT_MS` | `8000` | Таймаут HTTP-запроса, мс |
| `VITE_APP_VERSION` | `1.0.0` | Версия сборки (отдаётся в `/healthz`) |

Локально: `cp .env.example .env`.

## Структура

```
src/
├── api/            # DTO (types.ts), проверки типов (guards.ts), HTTP-клиент (client.ts)
├── components/     # CalculatorApp, Keypad, Display, HistoryPanel
├── lib/            # правила ввода операнда (input.ts)
├── state/          # машина состояний калькулятора (calculatorReducer.ts)
├── test/           # setup, доступ к контрактным фикстурам, фейковый backend
└── main.tsx        # bootstrap SPA
```

Контракт сервиса: `../services/calculator-test-app/CONTRACT.md`.
