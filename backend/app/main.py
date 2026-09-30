"""FastAPI-приложение сервиса backend (REST v1) для миссии calculator-test-app."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .calculations import DEFAULT_PRECISION, OPERATIONS, calculate
from .errors import INTERNAL_ERROR, ApiError
from .schemas import (
    CalculationRequest,
    CalculationResult,
    HealthResponse,
    HistoryResponse,
    OperationsResponse,
)
from .store import DEFAULT_HISTORY_LIMIT, HistoryStore

API_VERSION = 1
DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _format_validation_message(exc: RequestValidationError) -> str:
    parts: list[str] = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", ()) if part != "body"]
        message = str(error.get("msg", "некорректное значение"))
        for prefix in ("Value error, ", "Assertion failed, "):
            if message.startswith(prefix):
                message = message[len(prefix) :]
        parts.append(f"{'.'.join(location) or 'request'}: {message}")
    return "Некорректный запрос: " + "; ".join(parts)


def _error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def create_app(
    history_store: HistoryStore | None = None,
    cors_origins: list[str] | None = None,
) -> FastAPI:
    """Собирает приложение; в тестах принимает готовое хранилище истории и список origin'ов."""

    app = FastAPI(
        title="calculator-test-app backend",
        version=__version__,
        description="REST API калькулятора: вычисления на Decimal и история операций.",
    )
    store = history_store or HistoryStore(
        limit=_env_int("HISTORY_LIMIT", DEFAULT_HISTORY_LIMIT),
        file_path=os.getenv("HISTORY_FILE"),
    )
    origins = cors_origins if cors_origins is not None else _env_list("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    app.state.history = store

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["X-API-Version"],
    )

    @app.middleware("http")
    async def api_version_header(request: Request, call_next: Any) -> Response:
        response: Response = await call_next(request)
        response.headers["X-API-Version"] = str(API_VERSION)
        return response

    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return _error_response(exc.code, exc.message, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return _error_response("INVALID_REQUEST", _format_validation_message(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
        return _error_response(INTERNAL_ERROR, "Внутренняя ошибка сервера", status.HTTP_500_INTERNAL_SERVER_ERROR)

    @app.get("/health", response_model=HealthResponse, tags=["system"])
    async def health() -> HealthResponse:
        return HealthResponse(version=__version__, api_version=API_VERSION)

    @app.get("/api/v1/operations", response_model=OperationsResponse, tags=["calculator"])
    async def operations() -> OperationsResponse:
        return OperationsResponse(items=[spec.as_dict() for spec in OPERATIONS.values()])

    @app.post("/api/v1/calculate", response_model=CalculationResult, tags=["calculator"])
    async def calc(payload: CalculationRequest) -> CalculationResult:
        result = calculate(payload.operation, payload.operands, payload.precision or DEFAULT_PRECISION)
        entry: dict[str, Any] = {
            **result,
            "id": str(uuid.uuid4()),
            "created_at": _now_iso(),
        }
        store.add(entry)
        return CalculationResult(**result)

    @app.get("/api/v1/history", response_model=HistoryResponse, tags=["calculator"])
    async def history(limit: int = Query(default=20, ge=1, le=100)) -> HistoryResponse:
        items = store.list(limit)
        return HistoryResponse(items=items, total=store.total())

    @app.delete("/api/v1/history", status_code=status.HTTP_204_NO_CONTENT, tags=["calculator"])
    async def clear_history() -> Response:
        store.clear()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
