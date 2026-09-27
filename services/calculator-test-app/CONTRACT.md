# Контракт сервиса: `frontend` (миссия `calculator-test-app`)

> Источник правды по интерфейсам сервиса. Документ публикуется в реестре контрактов
> (`registry/contracts.json`). Чужой код не читается: знание о соседях берётся только из реестра контрактов.

| Поле | Значение |
| --- | --- |
| service id | `frontend` |
| mission | `calculator-test-app` |
| version | `1.0.0` |
| status | `published` |
| contract path | `services/calculator-test-app/CONTRACT.md` |
| implementation path | `frontend/` |
| runtime | Node.js `>=20` (проверено на `22.23.3`), браузеры Chrome/Firefox/Safari (последние 2 версии) |
| стек | React `18.3.1` + TypeScript `5.6` + Vite `5.4`, сборка — статические ассеты (SPA) |
| зависимости-сервисы | `backend` (`calculator-test-app`) — единственная внешняя зависимость |

---

## 1. Назначение и границы

### 1.1. В скоупе (in scope)

- SPA-калькулятор: ввод операндов с клавиатуры и мышью, выбор бинарной операции, получение результата, история операций.
- HTTP-клиент к сервису `backend` (REST/JSON), обработка ошибок и таймаутов.
- Публикация статической сборки (`dist/`) и runtime-эндпоинта `GET /healthz` (файл `healthz.json`) для проб контейнера.
- Контрактные тесты: проверка DTO сервиса `backend` на фикстурах `services/calculator-test-app/fixtures/*.json`.

### 1.2. Вне скоупа (out of scope)

- Арифметика. Любые вычисления выполняет **только** сервис `backend`; сервис `frontend` не выполняет операций `+ - * /` над введёнными числами (кроме форматирования строки ввода).
- Хранение истории операций (владелец данных — `backend`).
- Аутентификация/авторизация (миссия тестовая, но интерфейс клиента готов к добавлению заголовка `Authorization`).
- SSR, офлайн-режим, PWA-кэш.

### 1.3. Границы изменения

Интерфейсы, не описанные в этом контракте, не изменяются. Любое ломающее изменение внешнего
контракта сервиса `backend` требует остановки работ и эскалации (см. §8).

---

## 2. Архитектура и развёртывание

```
┌────────────────────────────┐        HTTP/JSON (REST v1)        ┌────────────────────────────┐
│ frontend (React SPA)       │  POST /api/v1/calculate           │ backend (FastAPI)          │
│ nginx/static, :5173        │  GET  /api/v1/operations          │ :8000                      │
│                            │  GET  /api/v1/history             │                            │
│ - keypad + display         │  DELETE /api/v1/history           │ - Decimal-арифметика       │
│ - history panel            │  GET  /health                     │ - история операций         │
│ - api client + error UI    │ ────────────────────────────────► │ - CORS для origin фронта   │
└────────────────────────────┘                                   └────────────────────────────┘
             │                                                                 │
             │ статика                                                         │ опционально: файловое
             ▼                                                                 ▼ хранилище истории (том)
   shared volume `frontend_dist`  ◄── docker-compose сборка ──►  shared volume `backend_data`
```

- Сервисы запускаются через `docker-compose.yml` (сервисы `backend` и `frontend`).
- Общий том `frontend_dist` используется как канал передачи собранной статики (multi-stage build → nginx).
- Общий том `backend_data` (`HISTORY_FILE=/data/history.json`) обеспечивает сохранение истории между перезапусками backend.
- В dev-режиме фронт поднимается Vite dev-server (`:5173`) и ходит в backend напрямую через `VITE_API_BASE_URL`.

---

## 3. Внешние интерфейсы сервиса `frontend`

### 3.1. UI-интерфейс (пользовательский контракт)

Один маршрут SPA `/` (deep-link на другие маршруты отдаёт тот же `index.html`).

Обязательные элементы и их стабильные контрактные имена (`data-testid` / `data-key` / ARIA):

| Элемент | testid / role / key | Поведение (контракт) |
| --- | --- | --- |
| Дисплей ввода/результата | `data-testid="calc-display"`, `role="status"`, `aria-live="polite"` | Текущий ввод; после успешного `=` — `result_text`; при ошибке ввод сохраняется |
| Выражение/подпись | `data-testid="calc-expression"` | Незавершённое выражение (`a <symbol>` или `a <symbol> b`) либо `expression` последнего результата, иначе пусто |
| Клавиши цифр | `data-key="0".."9"` | Добавляют цифру (лимит `MAX_INPUT_DIGITS=16`) |
| Десятичная точка | `data-key="."` | Разрешает единственную точку на ввод |
| Операции | `data-key="add"\|"subtract"\|"multiply"\|"divide"` | Задают операцию; символ приходит из `GET /api/v1/operations` (fallback — встроенная таблица) |
| Равно | `data-key="equals"` | `POST /api/v1/calculate`; результат → дисплей и история |
| Очистка | `data-key="clear"` | Полный сброс (`AC`): ввод, операнды, операция, ошибка; серверная история не удаляется |
| Удаление символа | `data-key="backspace"` | Удаляет последний символ ввода |
| Смена знака | `data-key="sign"` | Меняет знак текущего ввода |
| Панель истории | `data-testid="history"`, `role="list"` | Список записей `expression = result_text`; клик по записи → значение на дисплей |
| Очистка истории | `data-testid="history-clear"` | `DELETE /api/v1/history` |
| Ошибки | `data-testid="app-error"`, `role="alert"` | Сообщение из `error.message` backend, иначе локальный текст |
| Индикатор загрузки | `data-testid="app-busy"` | Присутствует, пока выполняется HTTP-запрос |

Клавиатурный контракт: `0-9`, `.`, `+`, `-`, `*`, `/`, `Enter` (= `=`), `Escape`/`Delete` (AC),
`Backspace` (⌫), `n` (±).

Нормативная машина состояний ввода:

1. Состояние: `entry: string` — текущий вводимый операнд, `a: string | null` — зафиксированный левый операнд, `op: Operation | null`.
2. Нажатие операции: `a := entry`; если `op` уже задан и новых цифр после него не вводили — меняется только `op`.
   После успешного `=`: `a := null`, `op := null`, `entry := result_text`.
3. Нажатие `=`: запрос не отправляется (no-op), если левый операнд не зафиксирован, операция не выбрана
   или второй операнд ещё не введён (после выбора операции не набрана ни одна цифра).
   При `op = divide` и нулевом втором операнде backend отвечает `DIVISION_BY_ZERO` — UI показывает `error.message`.
4. Ошибка запроса: ввод сохраняется, сообщение попадает в `app-error`, признак `busy` снимается.
5. `AC` очищает всё локальное состояние, включая `app-error`; серверная история не затрагивается.

### 3.2. HTTP-интерфейс сервиса `frontend` (что отдаёт фронт)

| Метод | Путь | Ответ | Назначение |
| --- | --- | --- | --- |
| `GET` | `/` и любой SPA-маршрут | `200 text/html` (`index.html`) | SPA |
| `GET` | `/assets/*` | `200` статика (имя с content-hash), `Cache-Control: public, max-age=31536000, immutable` | JS/CSS/шрифты |
| `GET` | `/healthz` | `200 application/json` `{"status":"ok","service":"frontend","version":"1.0.0"}` | liveness-проба |

Сервис `frontend` не предоставляет иных API и не проксирует `backend` (взаимодействие идёт напрямую по CORS).

---

## 4. Данные

### 4.1. Типы (TypeScript, `frontend/src/api/types.ts`)

```ts
export type OperationId = 'add' | 'subtract' | 'multiply' | 'divide';

export interface OperationInfo {
  id: OperationId;
  symbol: string;            // '+', '-', '×', '÷'
  label: string;             // человекочитаемое имя
  arity: 2;
}

export interface CalculationRequest {
  operation: OperationId;
  operands: [number, number];
  precision?: number;        // по умолчанию 12, диапазон 1..28
}

export interface CalculationResult {
  operation: OperationId;
  operands: [number, number];
  result: number;            // машинный результат (float)
  result_text: string;       // каноничное десятичное представление для отображения
  expression: string;        // '2 + 2'
  precision: number;
}

export interface HistoryEntry extends CalculationResult {
  id: string;                // UUIDv4
  created_at: string;        // ISO-8601 UTC
}

export interface HistoryResponse {
  items: HistoryEntry[];     // новые записи первыми
  total: number;
}

export interface OperationsResponse {
  items: OperationInfo[];
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

export type ApiErrorCode =
  | 'INVALID_REQUEST'        // 422 — схема запроса не прошла валидацию (в т.ч. неизвестная операция, precision вне 1..28)
  | 'UNKNOWN_OPERATION'      // зарезервирован контрактом backend; клиент обрабатывает его как любой конверт ошибки
  | 'DIVISION_BY_ZERO'       // 400 — деление на ноль
  | 'PRECISION_OUT_OF_RANGE' // зарезервирован контрактом backend (текущая версия отдаёт INVALID_REQUEST)
  | 'INTERNAL_ERROR';        // 500 — неожиданная ошибка
```

Операнды в `CalculationRequest` — строго JSON-числа: строки (`"2"`), `true`/`false` и `null`
не коэрцятся в числа и отвергаются конвертом `422 INVALID_REQUEST`; не-конечные значения
(`NaN`, `Infinity`, `1e400`) — тоже `422` (проверено `scripts/qa_contract_review.py`, §5.1).

### 4.2. Внутренняя модель состояния UI (`frontend/src/state/calculatorReducer.ts`)

```ts
interface CalculatorState {
  entry: string;                  // текущий ввод, '0' по умолчанию
  firstOperand: string | null;    // левый операнд
  operation: OperationId | null;  // выбранная операция
  result: CalculationResult | null; // последний успешный результат
  error: string | null;           // текст ошибки для app-error
  busy: boolean;                  // HTTP-запрос в полёте
}
```

Правила валидации ввода: `entry` не длиннее `MAX_INPUT_DIGITS = 16` знаков; положительный ввод
начинается с цифры, ведущие нули отбрасываются (`0` + `5` → `5`); отрицательный ввод — знак `-` не
учитывается в лимите цифр; значение `entry` длиннее 16 значащих цифр не отправляется (кнопка `=` — no-op).

### 4.3. Контрактные фикстуры

Фикстуры — общий источник правды для тестов фронта и бекенда (путь `services/calculator-test-app/fixtures/`):

| Файл | Содержимое |
| --- | --- |
| `calculate-success.json` | Успешный `POST /api/v1/calculate` (`2 + 2 = 4`) |
| `calculate-division-by-zero.json` | Ошибка `400 DIVISION_BY_ZERO` |
| `calculate-invalid.json` | Ошибка `422 INVALID_REQUEST` |
| `history.json` | `GET /api/v1/history` |
| `operations.json` | `GET /api/v1/operations` |
| `health.json` | `GET /health` |

---

## 5. Зависимости

### 5.1. Зависимость-сервис `backend` (контракт потребителя)

Сервис `frontend` требует от сервиса `backend` (`calculator-test-app`) следующий REST-интерфейс.
Это **ожидания потребителя** (consumer-driven contract); они подтверждаются фикстурами §4.3 и
тестами `frontend/src/api/contract.test.ts`. Если фактический контракт `backend` отличается —
изменение считается ломающим, работа останавливается и эскалируется (см. §8).

Base URL: `VITE_API_BASE_URL` (по умолчанию `http://localhost:8000`). Все ответы — `application/json`,
заголовок `X-API-Version: 1`. При несовпадении мажорной версии клиент пишет предупреждение в консоль
(запрос не блокируется).

| Метод | Путь | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | — | `200` `{"status":"ok","service":"backend","version":"1.0.0","api_version":1}` | `500` |
| `GET` | `/api/v1/operations` | — | `200` `{"items":[{"id","symbol","label","arity"}]}` | `500` |
| `POST` | `/api/v1/calculate` | `CalculationRequest` | `200` `CalculationResult` | `400 DIVISION_BY_ZERO`, `422 INVALID_REQUEST`, `500 INTERNAL_ERROR` |
| `GET` | `/api/v1/history?limit=20` | `limit` 1..100, по умолчанию `20` | `200` `HistoryResponse` | `422`, `500` |
| `DELETE` | `/api/v1/history` | — | `204` (тело пустое) | `500` |

Дополнительно backend публикует служебные `GET /docs` и `GET /openapi.json` (FastAPI); сервис `frontend`
их не использует и не зависит от них.

Единый конверт ошибки (все неуспешные ответы):

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "Деление на ноль недопустимо" } }
```

Обязательства стороны `frontend` как потребителя:

- отправляет `operands` как JSON-числа (не строки), `precision` — целое `1..28` или отсутствует;
- не выполняет повторный запрос `POST /api/v1/calculate` при `400/422` (ошибка показывается пользователю);
- считает `history.items` упорядоченным «новые первыми» и не зависит от значения `total` больше, чем для счётчика;
- после `DELETE /api/v1/history` (204) инвалидирует локальный список истории.

### 5.2. Переменные окружения (build-time, Vite)

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Базовый URL сервиса `backend` |
| `VITE_API_TIMEOUT_MS` | `8000` | Таймаут HTTP-запроса (мс), при превышении — `NETWORK_ERROR` |
| `VITE_APP_VERSION` | `1.0.0` | Версия сборки: на сборке подставляется в `dist/healthz.json`, который отдаётся по `GET /healthz` (§3.2) |

### 5.3. Зависимости npm (зафиксированы в `frontend/package.json`)

Runtime: `react@18.3.1`, `react-dom@18.3.1`.

Dev/сборка/тесты: `typescript@5.6.3`, `vite@5.4.11`, `@vitejs/plugin-react@4.3.4`, `vitest@2.1.8`,
`jsdom@25.0.1`, `@testing-library/react@16.1.0`, `@testing-library/user-event@14.5.2`,
`@testing-library/jest-dom@6.6.3`, `@types/react@18.3.12`, `@types/react-dom@18.3.1`.

Логика тестируется без сети: HTTP-клиент принимает инъектируемый `fetch`, UI-тесты подменяют клиент.

---

## 6. Обработка ошибок (локальные коды клиента)

| Код | Условие | Сообщение пользователю |
| --- | --- | --- |
| `NETWORK_ERROR` | `fetch` выбросил исключение / таймаут | «Сервер вычислений недоступен. Проверьте, что backend запущен.» |
| `MALFORMED_RESPONSE` | Ответ не соответствует DTO (проверка типов) | «Сервер вернул некорректный ответ.» |
| `HTTP_<status>` | Неуспешный статус без валидного конверта ошибки | «Ошибка сервера (HTTP <status>).» |

Если тело ошибки соответствует `ApiErrorBody`, показывается `error.message` из backend без изменений.

---

## 7. Тесты и критерии приёмки

Команды (из каталога `frontend/`):

| Команда | Что делает |
| --- | --- |
| `npm ci` / `npm install` | установка зафиксированных зависимостей |
| `npm test` | `vitest run` — юнит-, контрактные и компонентные тесты |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | production-сборка в `dist/` |

Обязательный набор тестов сервиса:

1. `src/lib/input.test.ts` — правила ввода (лимит знаков, точка, ведущие нули, знак, backspace).
2. `src/state/calculatorReducer.test.ts` — машина состояний §3.1 (операции, `=` no-op, AC, ошибка).
3. `src/api/client.test.ts` — успех, конверт ошибки `DIVISION_BY_ZERO`, `NETWORK_ERROR`, `MALFORMED_RESPONSE`, `DELETE` → 204.
4. `src/api/contract.test.ts` — валидация фикстур §4.3 типами/гардами клиента (совместимость с `backend`).
5. `src/components/CalculatorApp.test.tsx` — сквозной пользовательский сценарий: `2 + 2 = 4`, деление на ноль, AC, история, клавиатура.
6. `src/api/liveBackend.test.ts` — интеграционный тест: настоящий клиент фронта против живого `backend`
   (запускается при заданном `LIVE_BACKEND_URL`, команда `make smoke`; в обычном `npm test` — пропуск).
7. `src/registry.test.ts` — сверка версии контракта в `CONTRACT.md`, `registry/contracts.json` и `package.json`.

Критерии приёмки сервиса:

| Критерий | Проверка | Результат |
| --- | --- | --- |
| Контракт опубликован, версия в реестре выросла | `registry/contracts.json` → запись `frontend` `1.0.0`; тест `src/registry.test.ts` | ✅ (запись создана: сервис ранее не был описан в реестре) |
| Интерфейсы описаны | разделы 3–5 этого документа (UI, HTTP потребителя, DTO, env, пакеты) | ✅ |
| Тесты сервиса проходят | `npm test` (frontend) — 7 файлов (6 запускаемых + `src/api/liveBackend.test.ts` пропускается без `LIVE_BACKEND_URL`), 77 тестов зелёные, 5 пропущено; `pytest` (backend) — 44 теста; `./scripts/smoke.sh` — живой HTTP-контур | ✅ |
| Проверка типов и сборка | `npm run typecheck`, `npm run build` | ✅ |
| Diff приложен к отчёту миссии | `git status` / `git diff` рабочей копии | ✅ |
| Независимая проверка контракта | `./scripts/qa_review.sh [--build-check]` — сверка §3.2/§5.1/§5.2 с фактом (живой HTTP + сборка); отчёт `QA-REVIEW.md` | ✅ |


---

## 8. Версионирование и обратная совместимость

- Версия контракта — SemVer. Текущая: **1.0.0**.
- MAJOR — удаление/переименование элемента UI-контракта (`data-key`, `data-testid`), изменение состава
  DTO, смена пути эндпоинта, изменение семантики `result_text`.
- MINOR — новые необязательные элементы UI, новые необязательные поля DTO, новые операции.
- PATCH — тексты, стили, исправления без изменения интерфейсов.
- Ломающее изменение `backend` обнаруживается контрактным тестом (п. 4 набора тестов) и требует
  остановки работ и эскалации.

---

## 9. Публикация в реестре контрактов

Запись публикуется в `registry/contracts.json`:

```json
{
  "service": "frontend",
  "mission": "calculator-test-app",
  "version": "1.0.0",
  "status": "published",
  "contract_path": "services/calculator-test-app/CONTRACT.md",
  "implementation_path": "frontend/",
  "depends_on": [{ "service": "backend", "contract_version": "1.0.0" }]
}
```

---

## 10. Журнал изменений

| Версия | Дата | Изменения |
| --- | --- | --- |
| 1.0.0 | 2026-09-27 | Первая публикация: UI-контракт, DTO, env, зависимости npm, контракт потребителя `backend`, тесты. |
| 1.0.0 (ред.) | 2026-09-27 | По итогам независимой QA-проверки (`QA-REVIEW.md`), без изменения интерфейсов и без инкремента версии: уточнён счётчик тестов §7 (7 файлов, 77 тестов + 5 пропущенных; `pytest` — 44), в набор тестов добавлен `src/registry.test.ts`, уточнена формулировка §5.2 про `VITE_APP_VERSION`, в §4.1 добавлено требование строго числовых `operands`, в фикстуру `health.json` добавлен заголовок `x-api-version` (§5.1 требует его для всех ответов), добавлены регрессионные тесты на конверт ошибки `DELETE /api/v1/history` и на строгость `operands`. |
