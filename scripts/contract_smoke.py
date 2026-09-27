#!/usr/bin/env python3
"""Smoke-проверка живого backend (по HTTP, без TestClient) по контрактным фикстурам миссии.

Использование: python scripts/contract_smoke.py [base_url]
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = REPO_ROOT / "services" / "calculator-test-app" / "fixtures"
BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
VOLATILE_KEYS = {"id", "created_at"}


def load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / f"{name}.json").read_text(encoding="utf-8"))


def normalize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: f"<{key}>" if key in VOLATILE_KEYS else normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    return value


def call(method: str, path: str, payload: Any | None = None) -> tuple[int, Any, dict[str, str]]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else None, dict(response.headers)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8")
        return error.code, json.loads(body) if body else None, dict(error.headers)


def check(name: str, actual: Any, expected: Any) -> None:
    if actual != expected:
        raise SystemExit(f"FAIL {name}\n  expected: {json.dumps(expected, ensure_ascii=False)}\n  actual:   {json.dumps(actual, ensure_ascii=False)}")
    print(f"ok   {name}")


def main() -> int:
    health = load_fixture("health")
    status, body, headers = call("GET", "/health")
    check("health: status", status, health["status"])
    check("health: body", body, health["response"])
    check("health: x-api-version", headers.get("x-api-version") or headers.get("X-API-Version"), "1")

    operations = load_fixture("operations")
    status, body, _ = call("GET", "/api/v1/operations")
    check("operations: status", status, operations["status"])
    check("operations: body", body, operations["response"])

    success = load_fixture("calculate-success")
    status, body, _ = call("POST", "/api/v1/calculate", success["request"])
    check("calculate: status", status, success["status"])
    check("calculate: body", body, success["response"])

    division = load_fixture("calculate-division-by-zero")
    status, body, _ = call("POST", "/api/v1/calculate", division["request"])
    check("calculate/division-by-zero: status", status, division["status"])
    check("calculate/division-by-zero: body", body, division["response"])

    invalid = load_fixture("calculate-invalid")
    status, body, _ = call("POST", "/api/v1/calculate", invalid["request"])
    check("calculate/invalid: status", status, invalid["status"])
    check("calculate/invalid: body", body, invalid["response"])

    status, _, _ = call("DELETE", "/api/v1/history")
    check("history: delete status", status, 204)

    history = load_fixture("history")
    for item in reversed(history["response"]["items"]):
        status, body, _ = call(
            "POST",
            "/api/v1/calculate",
            {"operation": item["operation"], "operands": item["operands"], "precision": item["precision"]},
        )
        check(f"history: seed {item['expression']}", (status, body["result_text"]), (200, item["result_text"]))

    status, body, _ = call("GET", "/api/v1/history?limit=20")
    check("history: status", status, history["status"])
    check("history: body", normalize(body), normalize(history["response"]))

    print("SMOKE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
