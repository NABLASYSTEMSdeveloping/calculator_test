# Сервис `backend` (миссия calculator-test-app)

FastAPI-сервис калькулятора: арифметика на `Decimal`, история операций, REST API v1.
Реализует контракт потребителя сервиса `frontend` (CONTRACT.md, раздел 5.1).

## Запуск

```bash
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements-dev.txt
../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
../.venv/bin/python -m pytest
```

Swagger: `http://localhost:8000/docs`.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `HISTORY_LIMIT` | `100` | Максимум записей истории (кольцевой буфер) |
| `HISTORY_FILE` | — | Путь к JSON-файлу истории (том `backend_data`, `HISTORY_FILE=/data/history.json`) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Разрешённые origin'ы фронта |

## Структура

```
app/
├── main.py          # FastAPI: маршруты, конверт ошибок, CORS, X-API-Version
├── calculations.py  # реестр операций и Decimal-арифметика
├── schemas.py       # Pydantic-схемы DTO
├── store.py         # история операций (+ файловая персистентность)
└── errors.py        # ApiError -> {"error": {"code", "message"}}
tests/               # pytest: юнит-тесты, HTTP API, контрактные фикстуры
```

## Маршруты

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/health` | Проверка живости |
| `GET` | `/api/v1/operations` | Справочник операций (символы для клавиатуры) |
| `POST` | `/api/v1/calculate` | Вычисление бинарной операции |
| `GET` | `/api/v1/history?limit=20` | История операций (новые первыми) |
| `DELETE` | `/api/v1/history` | Очистка истории (204) |
