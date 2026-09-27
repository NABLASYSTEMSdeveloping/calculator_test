"""Общие фикстуры тестов backend: контрактные фикстуры миссии и тестовый клиент."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.errors import ApiError  # noqa: F401  (импорт для проверки доступности пакета app)
from app.main import create_app
from app.store import HistoryStore

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "services" / "calculator-test-app" / "fixtures"


def _load_fixture(name: str) -> dict[str, Any]:
    path = FIXTURES_DIR / f"{name}.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture(scope="session")
def fixtures() -> dict[str, dict[str, Any]]:
    """Контрактные фикстуры миссии (общий источник правды с сервисом frontend)."""

    names = [
        "calculate-success",
        "calculate-division-by-zero",
        "calculate-invalid",
        "history",
        "operations",
        "health",
    ]
    return {name: _load_fixture(name) for name in names}


@pytest.fixture()
def store(tmp_path: Path) -> HistoryStore:
    """История с файловой персистентностью в изолированном каталоге."""

    return HistoryStore(limit=5, file_path=tmp_path / "history.json")


@pytest.fixture()
def client(store: HistoryStore) -> Iterator[TestClient]:
    app = create_app(history_store=store, cors_origins=["http://localhost:5173"])
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def normalize_volatile() -> Callable[[Any], Any]:
    """Заменяет изменяемые поля (id, created_at) на плейсхолдеры для сравнения с фикстурами."""

    def _normalize(value: Any) -> Any:
        if isinstance(value, dict):
            result = {}
            for key, item in value.items():
                if key == "id":
                    result[key] = "<id>"
                elif key == "created_at":
                    result[key] = "<created_at>"
                else:
                    result[key] = _normalize(item)
            return result
        if isinstance(value, list):
            return [_normalize(item) for item in value]
        return value

    return _normalize
