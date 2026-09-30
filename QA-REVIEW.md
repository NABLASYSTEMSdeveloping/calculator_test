# QA-REVIEW — независимая проверка миссии `calculator-test-app`

| Поле | Значение |
| --- | --- |
| Объект проверки | опубликованный контракт `frontend` `1.0.0` (`services/calculator-test-app/CONTRACT.md`), его реализация (`frontend/`), контракт потребителя `backend` (§5.1) и реализация (`backend/`) |
| Рабочая копия | `/data/workspaces/m-cd327d60/repo` (HEAD `10ef825` + рабочее дерево) |
| Дата проверки | 2026-09-27 |
| Окружение | Node.js `22.23.3`, npm `10.9.9`, Python `3.11.2`, `.venv` (`fastapi 0.115.6`, `pytest 8.3.4`); Docker в среде проверки **недоступен** |
| Инструмент проверки | `scripts/qa_review.sh` (`--build-check`), `scripts/qa_contract_review.py`, `scripts/smoke.sh` |
| Итог | **принято с правками**: 56/56 автопроверок контракта, 44 pytest, 77 vitest (+5 пропущенных), typecheck/build/smoke — зелёные; найдено 3 функциональных расхождения (устранены), 2 дефекта документа, 3 наблюдения (не менялись) |

## 1. Как воспроизвести проверку

```bash
# 1. Полный набор тестов и статических проверок
make install                # если окружение чистое
make test                   # pytest (backend) + vitest (frontend)
make typecheck && make build

# 2. Живой HTTP-контур (контрактные фикстуры + интеграционный тест фронта)
make smoke

# 3. Независимая сверка контракта с фактом (живой backend + статика/сборка frontend)
make qa                     # 56 автопроверок
make qa-build               # + сборка с VITE_APP_VERSION=9.9.9 и проверка dist/healthz.json
```

## 2. Тесты и регрессии (факты прогона)

| Команда | Наблюдаемый результат |
| --- | --- |
| `cd frontend && npm test` | `Test Files 6 passed \| 1 skipped (7)`, `Tests 77 passed \| 5 skipped (82)` |
| `src/components/CalculatorApp.test.tsx` | 14 тестов — OK |
| `src/api/client.test.ts` | 15 тестов — OK (+1 регрессионный, добавлен этой проверкой) |
| `src/api/contract.test.ts` | 14 тестов — OK |
| `src/state/calculatorReducer.test.ts` | 15 тестов — OK |
| `src/lib/input.test.ts` | 15 тестов — OK |
| `src/registry.test.ts` | 4 теста — OK (версия в реестре = CONTRACT.md = package.json) |
| `src/api/liveBackend.test.ts` | 5 тестов пропущены без `LIVE_BACKEND_URL` — ожидаемо (§7 п.6) |
| `cd backend && ../.venv/bin/python -m pytest -q` | 44 теста — OK (+4 регрессионных, добавлены этой проверкой) |
| `./scripts/smoke.sh` | 17 проверок фикстур + 5 живых тестов фронта → `SMOKE ALL OK` |
| `make typecheck` | `tsc --noEmit` — без ошибок |
| `make build` | `dist/index.html` + `dist/assets/index-*.js|css` собраны |
| `./scripts/qa_review.sh --build-check` | `ИТОГО: 56/56 проверок пройдено`, `QA CONTRACT REVIEW OK`, `PASS build-check: dist/healthz.json отдаёт version=9.9.9` |

**Регрессий не обнаружено**: полный набор тестов, сборка и живой контур зелёные до и после правок
раздела 5. Единственные изменения числа тестов — добавленные регрессионные тесты
(`77 = 76 + 1`, `44 = 40 + 4`).

## 3. Критерии приёмки задачи

| Критерий | Как проверено | Результат |
| --- | --- | --- |
| Есть отчёт о проверке | этот файл `QA-REVIEW.md` | ✅ |
| Факты воспроизводимы | все утверждения подкреплены командой из §1 и наблюдаемым выводом (§2, §5) | ✅ |
| Тесты | полный прогон pytest/vitest/typecheck/build/smoke, см. §2 | ✅ (44 + 77 зелёных) |
| Acceptance criteria сервиса | таблица критериев §7 `CONTRACT.md` сверена с прогоном, см. §4.1 | ✅ (1 расхождение в цифрах — исправлено, F-05) |
| Регрессии | сравнение прогонов до/после правок, §2 | ✅ регрессий нет |
| Соответствие опубликованного контракта факту | `scripts/qa_contract_review.py` — 56 проверок по живому HTTP и по файлам | ✅ 56/56 |

## 4. Соответствие опубликованных контрактов фактическому поведению

### 4.1. Сервис `frontend` (published `1.0.0`, §3.1 UI / §3.2 HTTP / §5.2 env / §7 тесты)

| Пункт контракта | Проверка | Факт |
| --- | --- | --- |
| §3.2 `GET /` и любой SPA-маршрут → `200 text/html` | `frontend/nginx.conf`: `try_files $uri $uri/ /index.html`; `dist/index.html` собран | ✅ (статика: исполнение через nginx — см. §7 ограничения) |
| §3.2 `GET /assets/*` → `Cache-Control: public, max-age=31536000, immutable` | `location /assets/` содержит заголовок | ✅ |
| §3.2 `GET /healthz` → `{"status":"ok","service":"frontend","version":"1.0.0"}` | `public/healthz.json` (`location = /healthz` → `try_files /healthz.json`), в `dist/` — тот же файл | ✅ |
| §5.2 `VITE_APP_VERSION` влияет на `version` в `/healthz` | сборка с `VITE_APP_VERSION=9.9.9` → `dist/healthz.json` `version=9.9.9` | ✅ (до правки — ❌, F-01) |
| §3.1 UI-элементы (`calc-display`/`role=status`/`aria-live`, `calc-expression`, `data-key` 0-9/`.`/операции/`equals`/`clear`/`backspace`/`sign`, `history`, `history-clear`, `app-error`/`role=alert`, `app-busy`) | сверка `Display.tsx`, `Keypad.tsx`, `HistoryPanel.tsx`, `CalculatorApp.tsx` с таблицей §3.1 + UI-тесты | ✅ (кроме наблюдения F-07) |
| §3.1 клавиатура (`0-9`, `.`, `+ - * /`, `Enter`, `Escape`/`Delete`, `Backspace`, `n`) | обработчик `keydown` в `CalculatorApp.tsx` | ✅ |
| §3.1 машина состояний (операция фиксирует `a`, `=` no-op без второго операнда, AC, ошибка сохраняет ввод) | `calculatorReducer.ts` + 15 тестов | ✅ |
| §7 обязательный набор тестов (7 файлов) | все файлы существуют и запускаются | ✅ (F-05 — неточность счётчиков исправлена) |
| §7 `registry/contracts.json` = `CONTRACT.md` = `package.json` | `src/registry.test.ts`, 4 теста | ✅ `1.0.0` |

### 4.2. Сервис `backend` (контракт потребителя, §5.1; в реестре — `required-not-published`)

Все 56 автопроверок `qa_contract_review.py` пройдены на живом HTTP (`uvicorn`, порт 8020),
включая ранее не покрытые случаи:

- `X-API-Version: 1` присутствует **и на успешных, и на ошибочных** ответах (`400`, `422`, `204`) — §5.1;
- `content-type: application/json` для `/health`; конверт ошибки `{"error":{"code","message"}}`;
- `precision`: `1` и `28` приняты, `0` и `29` → `422 INVALID_REQUEST` (§4.1: диапазон `1..28`);
- `limit`: `1` и `100` приняты, `0` и `101` → `422` (§5.1: `1..100`, по умолчанию `20`);
- история: новые первыми, `total`, неуспешные операции не пишутся, `DELETE` → `204` с пустым телом;
- CORS: preflight `POST`/`DELETE` с `Origin: http://localhost:5173` разрешён, чужой origin — без `allow-origin`;
- `result_text` каноничен: `0.1+0.2 → 0.3`, `1÷3 → 0.333333333333`, `2-5 → -3`, `10^6·10^6 → 1000000000000`;
- служебные `/docs`, `/openapi.json` доступны (§5.1 — «не используются фронтом»);
- `operands` строго числовые: строки, `true`, `null` → `422 INVALID_REQUEST` (после правки F-03).

Замечание о статусе в реестре: опубликованного контракта `backend` нет (`required-not-published`).
Всё, что проверено выше, — это **ожидания потребителя** из §5.1 + общие фикстуры; они подтверждены фактом,
но формально «опубликованным» контрактом `backend` не являются (уточнено в `registry/README.md`, F-06).


## 5. Найденные расхождения

| ID | Severity | Что не совпало | Статус |
| --- | --- | --- | --- |
| F-01 | major | код `frontend` vs §5.2: `VITE_APP_VERSION` не влиял на `version` в `/healthz` | устранено |
| F-02 | major | код `frontend` vs §6: `DELETE /api/v1/history` не разбирал конверт ошибки `ApiErrorBody` | устранено |
| F-03 | major | код `backend` vs §4.1: `operands` коэрцились (`"2"`, `true`, `null` → `200`) | устранено |
| F-04 | minor | фикстура `health.json` vs §5.1: не объявлен заголовок `x-api-version` | устранено |
| F-05 | minor | документация §7: «6 файлов, 76 тестов», «40 тестов» не совпадали с прогоном | устранено |
| F-06 | info | `registry/README.md`: «—» для `backend` vs `depends_on.contract_version = "1.0.0"` | устранено (пояснение) |
| F-07 | low | UI vs §3.1: при пустой истории нет `data-testid="history"`/`role="list"` | не менялось, см. §8 |
| F-08 | low | §3.1 п.3 не перечисляет no-op `=` для `entry` длиннее 16 цифр (есть в §4.2) | не менялось, см. §8 |
| F-09 | info | ограничение среды: Docker недоступен, `/healthz` через nginx не исполнялся | см. §7 |

### F-01 (major, устранено) — `VITE_APP_VERSION` не влиял на `/healthz`

§5.2 объявляет `VITE_APP_VERSION` как build-time переменную, значение которой отдаётся в `/healthz` (§3.2),
`Dockerfile`/`docker-compose.yml` прокидывают её как `ARG`/`ENV`. Фактически `public/healthz.json` — статический
файл, переменная нигде не читалась (кроме декларации типов `src/vite-env.d.ts`).

Воспроизведение (до правки):

```bash
cd frontend && VITE_APP_VERSION=9.9.9 npx vite build
cat dist/healthz.json      # {"status":"ok","service":"frontend","version":"1.0.0"}  ← 1.0.0, а не 9.9.9
```

Устранено: в `frontend/vite.config.ts` добавлен build-плагин, который на `closeBundle` перезаписывает
`dist/healthz.json` версией из `VITE_APP_VERSION` (по умолчанию `1.0.0` — поведение и интерфейс §3.2 не изменились).

Проверка после правки:

```bash
./scripts/qa_review.sh --build-check
# PASS §5.2 VITE_APP_VERSION влияет на version в /healthz :: используется в: ['frontend/vite.config.ts']
# PASS build-check: dist/healthz.json отдаёт version=9.9.9 из VITE_APP_VERSION
```

### F-02 (major, устранено) — `clearHistory()` игнорировал конверт ошибки backend

§6: «Если тело ошибки соответствует `ApiErrorBody`, показывается `error.message` из backend без изменений».
`request()` (§5.1-эндпоинты) это соблюдал, а `clearHistory()` для `DELETE /api/v1/history` (§5.1: ошибки `500`)
сразу бросал локальный `HTTP_<status>`.

Воспроизведение: добавлен тест `src/api/client.test.ts` → «пробрасывает конверт ошибки backend при ошибке
очистки истории». До правки он падал:

```
- Object {  "code": "INTERNAL_ERROR", "message": "Внутренняя ошибка сервера", "status": 500 }
+ ApiClientError { "code": "HTTP_500", "status": 500 }
```

Устранено: разбор тела вынесен в `readPayload()`/`toResponseError()`, `clearHistory()` использует тот же путь.
После правки тест зелёный, поведение остальных веток не изменилось (15/15 тестов файла).

### F-03 (major, устранено) — `operands` коэрцились вопреки `[number, number]`

§4.1 объявляет `operands: [number, number]`. В `backend/app/schemas.py` был пост-валидатор
`isinstance(operand, bool)`, но Pydantic коэрцирует JSON до него, поэтому защита была мёртвым кодом.

Воспроизведение (до правки, живой HTTP):

```
POST /api/v1/calculate {"operation":"add","operands":[true,1]}   → 200 {"operands":[1.0,1],...}
POST /api/v1/calculate {"operation":"add","operands":["2.5",2]} → 200 {"operands":[2.5,2.0],...}
```

Устранено: валидатор переведён в `mode="before"` и проверяет тип до коэрции
(строки, `true`/`false`, `null` → `422 INVALID_REQUEST`, «операнд должен быть числом»);
проверка не-конечных значений (`1e400`) сохранена. Регрессия закрыта 4 тестами
`test_non_numeric_operands_are_rejected`, контрактный инвариант добавлен в §4.1.

После правки:

```
{"operation":"add","operands":[true,1]} → 422 {"error":{"code":"INVALID_REQUEST",
  "message":"Некорректный запрос: operands: операнд должен быть числом"}}
```

Замечание о риске: это единственная правка, меняющая принимаемый ввод (только для значений вне
объявленного типа). Легитимный потребитель (`frontend`) отправляет JSON-числа — регрессий нет,
`liveBackend.test.ts` и `smoke` зелёные.


### F-04 (minor, устранено) — фикстура `health.json` без `x-api-version`

§5.1 требует заголовок `X-API-Version: 1` для всех ответов backend, а фикстуры `calculate-*`, `history`,
`operations` его объявляют, `health.json` — нет (при этом живой backend его отдаёт, а тест
`backend/tests/test_api.py::test_api_version_header_on_all_fixture_routes` это проверяет).
Устранено: заголовок добавлен в фикстуру; тест `contract.test.ts` усилен — теперь требует `x-api-version: 1`
от каждой успешной фикстуры (раньше проверялись только `calculate-success` и `history`).

### F-05 (minor, устранено) — неточные счётчики тестов в §7

§7 утверждал «`npm test` (frontend) — 6 файлов, 76 тестов; `pytest` (backend) — 40 тестов».
Фактический прогон до правок: 7 файлов (6 запускаемых + `liveBackend.test.ts` пропускается), 76 тестов
+ 5 пропущенных, `pytest` — 40. Кроме того, `src/registry.test.ts` (7-й файл) не был перечислен в наборе,
хотя упоминался в таблице критериев. Устранено: набор дополнен пунктом 7, счётчики приведены к прогону
(и обновлены после добавления регрессионных тестов), добавлена строка критерия про `qa_review.sh`.

### F-06 (info, устранено пояснением) — неоднозначность в реестре

`registry/README.md` показывал для `backend` версию «—», тогда как `registry/contracts.json` содержит
`depends_on[0].contract_version = "1.0.0"`. Оба факта верны (опубликованной версии нет; `1.0.0` — версия
ожидания потребителя), но без пояснения читаются как противоречие. Устранено: в `registry/README.md`
добавлено пояснение, что `contract_version` здесь — consumer-driven ожидание из §5.1.

### F-07 (low, не менялось) — панель истории без `data-testid="history"` при пустом списке

§3.1 перечисляет панель истории как `data-testid="history"`, `role="list"`. В `HistoryPanel.tsx` при
`items.length === 0` вместо `<ul data-testid="history" role="list">` рендерится `<p data-testid="history-empty">`,
то есть контрактные атрибуты в пустом состоянии отсутствуют. Правка меняет UI/a11y-контракт
(перенос testid на контейнер) — оставлено на решение владельца, см. §8.

### F-08 (low, не менялось) — `entry` длиннее 16 цифр после выбора записи истории

§4.2: «значение `entry` длиннее 16 значащих цифр не отправляется (кнопка `=` — no-op)».
§3.1 п.3 перечисляет условия no-op, но лимит знаков там не упоминает. `result_text` backend может быть
длиннее 16 цифр (`precision` до 28), а клик по записи истории кладёт его в `entry` без усечения.

Воспроизведено разовым тестом состояния (файл удалён после прогона):

```
digits = 29 | entry = 0.6666666666666666666666666667
selectCalculationRequest(state) === null   # `=` — молчаливый no-op
```

Поведение соответствует §4.2 и не является нарушением, но противоречит перечислению в §3.1 п.3.
Правка требует решения владельца (усекать значение при `load-value` или отправлять как есть) — см. §8.

## 6. Перечень изменённых файлов

| Файл | Изменение |
| --- | --- |
| `frontend/vite.config.ts` | build-плагин: `dist/healthz.json` формируется из `VITE_APP_VERSION` (F-01) |
| `frontend/src/api/client.ts` | общий разбор тела ответа; `clearHistory()` пробрасывает конверт ошибки (F-02) |
| `frontend/src/api/client.test.ts` | +1 регрессионный тест на конверт ошибки `DELETE` (F-02) |
| `frontend/src/api/contract.test.ts` | усилена проверка: `x-api-version` обязателен для всех 2xx-фикстур (F-04) |
| `backend/app/schemas.py` | `operands` проверяются до коэрции Pydantic (F-03) |
| `backend/tests/test_api.py` | +4 регрессионных теста `test_non_numeric_operands_are_rejected` (F-03) |
| `services/calculator-test-app/fixtures/health.json` | +`x-api-version: "1"` (F-04) |
| `services/calculator-test-app/CONTRACT.md` | §4.1 строго числовые `operands`; §5.2 уточнение; §7 счётчики, п.7 набора, строка критерия QA; журнал изменений (F-03, F-05) |
| `registry/README.md` | пояснение про `depends_on.contract_version` (F-06) |
| `scripts/qa_contract_review.py` | **новый**: 56 независимых проверок §3.2/§4.1/§5.1/§5.2 (статика + живой HTTP) |
| `scripts/qa_review.sh` | **новый**: обёртка (поднимает backend, `--build-check` для F-01) |
| `Makefile` | цели `qa`, `qa-build` |
| `README.md` | раздел «QA и приёмка» |
| `QA-REVIEW.md` | **новый**: этот отчёт |

Интерфейсы, описанные в контракте (`POST /api/v1/calculate`, `GET|DELETE /api/v1/history`,
`GET /api/v1/operations`, `GET /health`, UI-`data-key`/`data-testid`, DTO, env), не менялись:
пути, коды, конверт ошибки, состав DTO и значения по умолчанию сохранены. Версия контракта `1.0.0`
не инкрементирована — правки либо приводят реализацию к уже опубликованному тексту, либо редакторские
(§10 `CONTRACT.md`).

## 7. Ограничения проверки (что не удалось исполнить)

1. **Docker недоступен** в среде проверки (`docker info` → ошибка), поэтому контейнерный рантайм
   `frontend` (nginx) не поднимался. Проверки §3.2 для `/`, `/healthz`, `/assets/*` выполнены
   статически: разобраны `frontend/nginx.conf`, наличие `dist/index.html` и `dist/healthz.json`,
   совпадение `dist/healthz.json` с `public/healthz.json`. Инструментальная проверка,
   что nginx действительно отдаёт `/healthz` (а не 404), возможна только там, где есть Docker:
   `make up && curl -sf http://localhost:5173/healthz`.
2. **Dev-сервер Vite не реализует `/healthz`** (отдаёт `public/healthz.json` как `/healthz.json`).
   Это не расхождение: §3.2 описывает опубликованный рантайм (nginx), §2 — dev-режим без этого маршрута.
3. Проверки §5.1 выполнены живым HTTP (`uvicorn` на `127.0.0.1:8020`/`:8010`), а не `TestClient`,
   то есть проверен реальный ASGI-стек с middleware `X-API-Version` и CORS.
4. `scripts/qa_review.sh --build-check` перезаписывает `frontend/dist` (каталог в `.gitignore`)
   сборкой с `VITE_APP_VERSION=9.9.9`, но в конце восстанавливает штатную сборку
   (`{"version":"1.0.0"}`) — состояние рабочей копии после прогона чистое.

## 8. Открытые вопросы к владельцу (не менялись как «ломающие»)

| Вопрос | Почему не изменено | Предложение |
| --- | --- | --- |
| F-07: в пустом состоянии истории нет `data-testid="history"`/`role="list"` | перенос testid/role на контейнер меняет UI-контракт §3.1 и может задеть UI-тесты | либо явно зафиксировать в §3.1 «атрибуты присутствуют при непустом списке», либо отдать `role="list"` контейнеру (MINOR-версия) |
| F-08: `entry` > 16 цифр после клика по записи истории делает `=` no-op | любое решение (усечение при `load-value` или отправка как есть) меняет наблюдаемое поведение, описанное в §3.1/§4.2 | уточнить §3.1 п.3 (перечислить лимит знаков) и §4.2 (что делать при `load-value`) |
| Версия контракта | правки приводят реализацию к уже опубликованному тексту | при следующем содержательном изменении интерфейса — плановая публикация с ростом `version` в `registry/contracts.json` |

## 9. Вывод

Опубликованный контракт `frontend` `1.0.0` **соответствует** фактически предоставляемым интерфейсам после
устранения F-01…F-04: 56/56 независимых проверок контракта, 44 pytest, 77 vitest (+5 пропущенных),
typecheck, production-сборка и живой HTTP-контур (`smoke`) — зелёные. Ожидания потребителя к `backend`
(§5.1) подтверждены на живом сервисе, включая ранее не покрытые ветки (заголовок версии на ошибках,
границы `precision`/`limit`, CORS, строгость типов операндов). Оставшиеся пункты F-07/F-08 — вопросы
уточнения текста контракта, требующие решения владельца и потому не изменённые.

