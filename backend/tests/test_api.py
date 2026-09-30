"""Тесты HTTP-интерфейса backend: маршруты, конверт ошибок, CORS, история."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import API_VERSION
from app.store import HistoryStore


def test_health_matches_contract(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["x-api-version"] == str(API_VERSION)
    body = response.json()
    assert body == {"status": "ok", "service": "backend", "version": "1.0.0", "api_version": API_VERSION}


def test_operations_matches_contract(client: TestClient) -> None:
    response = client.get("/api/v1/operations")
    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["id"] for item in items] == ["add", "subtract", "multiply", "divide"]
    assert all(item["arity"] == 2 for item in items)


def test_calculate_success_and_history(client: TestClient, store: HistoryStore) -> None:
    response = client.post("/api/v1/calculate", json={"operation": "multiply", "operands": [6, 7]})
    assert response.status_code == 200
    body = response.json()
    assert body["result_text"] == "42"
    assert body["expression"] == "6 × 7"
    assert "id" not in body  # идентификатор записи живёт только в истории

    assert store.total() == 1
    entry = store.list()[0]
    assert entry["id"]
    assert entry["created_at"].endswith("Z")

    history = client.get("/api/v1/history", params={"limit": 20}).json()
    assert history["total"] == 1
    assert history["items"][0]["result_text"] == "42"


def test_history_is_newest_first_and_limited(client: TestClient) -> None:
    for index in range(1, 4):
        client.post("/api/v1/calculate", json={"operation": "add", "operands": [index, index]})

    history = client.get("/api/v1/history").json()
    assert [item["result_text"] for item in history["items"]] == ["6", "4", "2"]
    assert history["total"] == 3

    limited = client.get("/api/v1/history", params={"limit": 2}).json()
    assert len(limited["items"]) == 2
    assert limited["total"] == 3

    assert client.get("/api/v1/history", params={"limit": 0}).status_code == 422
    assert client.get("/api/v1/history", params={"limit": 101}).status_code == 422


def test_history_store_respects_limit(client: TestClient, store: HistoryStore) -> None:
    for index in range(1, 9):  # limit=5
        client.post("/api/v1/calculate", json={"operation": "add", "operands": [index, 0]})
    assert store.total() == 5
    assert [item["result_text"] for item in store.list()] == ["8", "7", "6", "5", "4"]


def test_delete_history_returns_204_and_clears(client: TestClient, store: HistoryStore) -> None:
    client.post("/api/v1/calculate", json={"operation": "add", "operands": [1, 1]})
    response = client.delete("/api/v1/history")
    assert response.status_code == 204
    assert response.content == b""
    assert store.total() == 0
    assert client.get("/api/v1/history").json()["items"] == []


def test_division_by_zero_error_envelope(client: TestClient, store: HistoryStore) -> None:
    response = client.post("/api/v1/calculate", json={"operation": "divide", "operands": [8, 0]})
    assert response.status_code == 400
    assert response.json() == {
        "error": {"code": "DIVISION_BY_ZERO", "message": "Деление на ноль недопустимо"}
    }
    assert store.total() == 0  # неуспешные операции в историю не попадают


def test_invalid_operation_error_envelope(client: TestClient) -> None:
    response = client.post("/api/v1/calculate", json={"operation": "pow", "operands": [2, 3]})
    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "INVALID_REQUEST",
            "message": "Некорректный запрос: operation: операция не поддерживается",
        }
    }


def test_missing_operand_is_invalid_request(client: TestClient) -> None:
    response = client.post("/api/v1/calculate", json={"operation": "add", "operands": [1]})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "INVALID_REQUEST"
    assert "operands" in body["error"]["message"]


def test_non_finite_operand_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/calculate",
        content='{"operation": "add", "operands": [1e400, 1]}',
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


@pytest.mark.parametrize("operands", [["2", "2"], [True, 1], [None, 1], ["2.5", 2]])
def test_non_numeric_operands_are_rejected(client: TestClient, operands: list) -> None:
    """CONTRACT.md §4.1 объявляет `operands: [number, number]`: bool/str/null не коэрцятся в числа."""

    response = client.post("/api/v1/calculate", json={"operation": "add", "operands": operands})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "INVALID_REQUEST"
    assert "операнд должен быть числом" in body["error"]["message"]


def test_cors_allows_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/api/v1/calculate",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_history_persisted_to_file(tmp_path) -> None:
    from app.main import create_app

    file_path = tmp_path / "history.json"
    first_store = HistoryStore(limit=5, file_path=file_path)
    app = create_app(history_store=first_store, cors_origins=["http://localhost:5173"])
    with TestClient(app) as test_client:
        test_client.post("/api/v1/calculate", json={"operation": "add", "operands": [20, 22]})

    assert file_path.exists()
    reloaded = HistoryStore(limit=5, file_path=file_path)
    assert reloaded.total() == 1
    assert reloaded.list()[0]["result_text"] == "42"
