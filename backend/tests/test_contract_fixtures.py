"""Контрактные тесты: ответы backend сверяются с фикстурами миссии (общими с сервисом frontend)."""

from __future__ import annotations

from typing import Any, Callable

from fastapi.testclient import TestClient

FIXTURE_ROUTES = {
    "health": ("GET", "/health"),
    "operations": ("GET", "/api/v1/operations"),
    "calculate-success": ("POST", "/api/v1/calculate"),
    "calculate-division-by-zero": ("POST", "/api/v1/calculate"),
    "calculate-invalid": ("POST", "/api/v1/calculate"),
    "history": ("GET", "/api/v1/history"),
}


def test_fixture_routes_are_covered() -> None:
    """Каждая контрактная фикстура обязана иметь проверяемый маршрут."""

    assert set(FIXTURE_ROUTES) == {
        "health",
        "operations",
        "calculate-success",
        "calculate-division-by-zero",
        "calculate-invalid",
        "history",
    }


def test_health_fixture(client: TestClient, fixtures: dict[str, Any]) -> None:
    fixture = fixtures["health"]
    response = client.get(fixture["request"]["path"])
    assert response.status_code == fixture["status"]
    assert response.json() == fixture["response"]


def test_operations_fixture(client: TestClient, fixtures: dict[str, Any]) -> None:
    fixture = fixtures["operations"]
    response = client.get(fixture["request"]["path"])
    assert response.status_code == fixture["status"]
    assert response.json() == fixture["response"]


def test_calculate_success_fixture(client: TestClient, fixtures: dict[str, Any]) -> None:
    fixture = fixtures["calculate-success"]
    response = client.post("/api/v1/calculate", json=fixture["request"])
    assert response.status_code == fixture["status"]
    assert response.json() == fixture["response"]


def test_calculate_division_by_zero_fixture(client: TestClient, fixtures: dict[str, Any]) -> None:
    fixture = fixtures["calculate-division-by-zero"]
    response = client.post("/api/v1/calculate", json=fixture["request"])
    assert response.status_code == fixture["status"]
    assert response.json() == fixture["response"]


def test_calculate_invalid_fixture(client: TestClient, fixtures: dict[str, Any]) -> None:
    fixture = fixtures["calculate-invalid"]
    response = client.post("/api/v1/calculate", json=fixture["request"])
    assert response.status_code == fixture["status"]
    assert response.json() == fixture["response"]


def test_history_fixture(client: TestClient, fixtures: dict[str, Any], normalize_volatile: Callable) -> None:
    fixture = fixtures["history"]
    for item in reversed(fixture["response"]["items"]):
        response = client.post(
            "/api/v1/calculate",
            json={
                "operation": item["operation"],
                "operands": item["operands"],
                "precision": item["precision"],
            },
        )
        assert response.status_code == 200
        assert response.json()["result_text"] == item["result_text"]

    response = client.get(fixture["request"]["path"])
    assert response.status_code == fixture["status"]
    assert normalize_volatile(response.json()) == normalize_volatile(fixture["response"])


def test_api_version_header_on_all_fixture_routes(client: TestClient) -> None:
    for method, path in FIXTURE_ROUTES.values():
        response = client.request(method, path, json={"operation": "add", "operands": [1, 1]} if method == "POST" else None)
        assert response.headers.get("x-api-version") == "1", f"{method} {path}"
