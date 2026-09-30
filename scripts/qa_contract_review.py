#!/usr/bin/env python3
"""Независимая QA-проверка соответствия опубликованного контракта фактическому поведению сервисов.

Проверяет две группы фактов:

1. **Статика сервиса `frontend`** (CONTRACT.md §3.2, §5.2) — по файлам рабочей копии:
   nginx-конфиг, `public/healthz.json`, `dist/` и `package.json`.
2. **Контракт потребителя `backend`** (CONTRACT.md §5.1) — живым HTTP (без TestClient),
   тот же контур, что в `scripts/smoke.sh`.

Использование:
    python scripts/qa_contract_review.py [base_url]        # проверить живой backend
    python scripts/qa_contract_review.py --static-only     # только статика frontend

Коды возврата: 0 — все проверки пройдены, 1 — есть расхождения (печатаются как FAIL).
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
CONTRACT_PATH = REPO_ROOT / "services" / "calculator-test-app" / "CONTRACT.md"
FRONTEND_DIR = REPO_ROOT / "frontend"

RESULTS: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: Any = "") -> None:
    """Фиксирует результат проверки; выводит PASS/FAIL сразу (для читаемого лога)."""

    RESULTS.append((name, bool(ok), str(detail)))
    suffix = "" if detail in ("", None) else f" :: {detail}"
    print(("PASS " if ok else "FAIL ") + name + suffix)


def check(name: str, actual: Any, expected: Any) -> None:
    record(name, actual == expected, "" if actual == expected else f"expected={expected!r} actual={actual!r}")


def load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / f"{name}.json").read_text(encoding="utf-8"))


BASE_URL = "http://127.0.0.1:8000"


def _parse_body(body: str) -> Any:
    """JSON, если тело — JSON (иначе исходный текст: например `OK` от CORS-preflight)."""

    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body


def call(
    method: str,
    path: str,
    payload: Any | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, Any, dict[str, str]]:
    """HTTP-вызов на живом сервисе; возвращает (status, json, headers в нижнем регистре)."""

    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            return response.status, _parse_body(body), {k.lower(): v for k, v in response.headers.items()}
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8")
        return error.code, _parse_body(body), {k.lower(): v for k, v in error.headers.items()}


def review_backend_contract() -> None:
    """CONTRACT.md §5.1 — контракт потребителя backend (проверяется живым HTTP)."""

    # 1. GET /health
    fixture = load_fixture("health")
    status, body, headers = call("GET", "/health")
    check("§5.1 GET /health status", status, fixture["status"])
    check("§5.1 GET /health body", body, fixture["response"])
    check("§5.1 GET /health X-API-Version", headers.get("x-api-version"), "1")
    check("§5.1 GET /health content-type", (headers.get("content-type") or "").split(";")[0], "application/json")

    # 2. GET /api/v1/operations
    fixture = load_fixture("operations")
    status, body, headers = call("GET", "/api/v1/operations")
    check("§5.1 GET /api/v1/operations status", status, fixture["status"])
    check("§5.1 GET /api/v1/operations body", body, fixture["response"])
    check("§5.1 GET /api/v1/operations X-API-Version", headers.get("x-api-version"), "1")

    # 3. POST /api/v1/calculate — успех
    fixture = load_fixture("calculate-success")
    status, body, headers = call("POST", "/api/v1/calculate", fixture["request"])
    check("§5.1 POST /api/v1/calculate (2+2) status", status, fixture["status"])
    check("§5.1 POST /api/v1/calculate (2+2) body", body, fixture["response"])
    check("§5.1 POST /api/v1/calculate X-API-Version", headers.get("x-api-version"), "1")

    # 4. POST /api/v1/calculate — деление на ноль
    fixture = load_fixture("calculate-division-by-zero")
    status, body, headers = call("POST", "/api/v1/calculate", fixture["request"])
    check("§5.1 DIVISION_BY_ZERO status", status, fixture["status"])
    check("§5.1 DIVISION_BY_ZERO body", body, fixture["response"])
    check("§5.1 DIVISION_BY_ZERO X-API-Version (конверт ошибки тоже несёт версию)", headers.get("x-api-version"), "1")

    # 5. POST /api/v1/calculate — неизвестная операция
    fixture = load_fixture("calculate-invalid")
    status, body, headers = call("POST", "/api/v1/calculate", fixture["request"])
    check("§5.1 INVALID_REQUEST status", status, fixture["status"])
    check("§5.1 INVALID_REQUEST body", body, fixture["response"])
    check("§5.1 INVALID_REQUEST X-API-Version", headers.get("x-api-version"), "1")

    # 6. Границы precision: 1 и 28 разрешены, 0 и 29 — нет (CONTRACT.md §4.1, §5.1)
    status, body, _ = call("POST", "/api/v1/calculate", {"operation": "divide", "operands": [1, 3], "precision": 1})
    check("§5.1 precision=1 принят", (status, body["result_text"], body["precision"]), (200, "0.3", 1))
    status, body, _ = call("POST", "/api/v1/calculate", {"operation": "divide", "operands": [1, 3], "precision": 28})
    check("§5.1 precision=28 принят", (status, body["precision"], len(body["result_text"])), (200, 28, 30))
    for bad in (0, 29):
        status, body, _ = call("POST", "/api/v1/calculate", {"operation": "add", "operands": [1, 1], "precision": bad})
        check(f"§5.1 precision={bad} отвергнут 422 INVALID_REQUEST", (status, body["error"]["code"]), (422, "INVALID_REQUEST"))

    # 7. Некорректные операнды (CONTRACT.md §4.1, §5.1)
    status, body, _ = call("POST", "/api/v1/calculate", {"operation": "add", "operands": [1]})
    check("§5.1 один операнд -> 422 INVALID_REQUEST", (status, body["error"]["code"]), (422, "INVALID_REQUEST"))
    status, body, _ = call("POST", "/api/v1/calculate", {"operation": "add", "operands": ["2", "2"]})
    record(
        "§4.1 строковые операнды отвергнуты (контракт объявляет [number, number])",
        status == 422 and body.get("error", {}).get("code") == "INVALID_REQUEST",
        f"status={status} body={body}",
    )
    status, body, _ = call("POST", "/api/v1/calculate", {"operation": "add", "operands": [True, 1]})
    record(
        "§4.1 boolean не коэрцится в число",
        status == 422 and body.get("error", {}).get("code") == "INVALID_REQUEST",
        f"status={status} body={body}",
    )
    status, body, _ = call("POST", "/api/v1/calculate", {"operation": "add", "operands": [None, 1]})
    record(
        "§4.1 null не коэрцится в число",
        status == 422 and body.get("error", {}).get("code") == "INVALID_REQUEST",
        f"status={status} body={body}",
    )

    # 8. result_text каноничен (CONTRACT.md §4.1: без экспоненты и лишних нулей)
    for operation, operands, expected in (
        ("add", [0.1, 0.2], "0.3"),
        ("divide", [1, 3], "0.333333333333"),
        ("subtract", [2, 5], "-3"),
        ("multiply", [1000000, 1000000], "1000000000000"),
    ):
        _status, body, _ = call("POST", "/api/v1/calculate", {"operation": operation, "operands": operands})
        check(f"§4.1 result_text {operation}{operands} ожидается {expected}", body["result_text"], expected)

    # 9. Неуспешные операции не попадают в историю
    call("DELETE", "/api/v1/history")
    call("POST", "/api/v1/calculate", {"operation": "divide", "operands": [8, 0]})
    _status, body, _ = call("GET", "/api/v1/history")
    check("§4.1 ошибка не пишется в историю", body["total"], 0)


    # 10. GET/DELETE /api/v1/history (CONTRACT.md §5.1)
    call("POST", "/api/v1/calculate", {"operation": "add", "operands": [2, 2]})
    call("POST", "/api/v1/calculate", {"operation": "multiply", "operands": [6, 7]})
    status, body, headers = call("GET", "/api/v1/history?limit=20")
    check("§5.1 GET /api/v1/history status", status, 200)
    check("§5.1 история новые-первыми", [item["result_text"] for item in body["items"]], ["42", "4"])
    check("§5.1 history.total", body["total"], 2)
    check("§5.1 GET /api/v1/history X-API-Version", headers.get("x-api-version"), "1")
    for bad_limit in (0, 101):
        status, _body, _ = call("GET", f"/api/v1/history?limit={bad_limit}")
        check(f"§5.1 limit={bad_limit} вне 1..100 -> 422", status, 422)
    for good_limit in (1, 100):
        status, _body, _ = call("GET", f"/api/v1/history?limit={good_limit}")
        check(f"§5.1 limit={good_limit} принят", status, 200)

    status, body, headers = call("DELETE", "/api/v1/history")
    check("§5.1 DELETE /api/v1/history -> 204", status, 204)
    check("§5.1 DELETE /api/v1/history тело пустое", body, None)
    check("§5.1 DELETE X-API-Version", headers.get("x-api-version"), "1")
    _status, body, _ = call("GET", "/api/v1/history")
    check("§5.1 после DELETE история пуста", (body["items"], body["total"]), ([], 0))

    # 11. CORS для origin фронта (CONTRACT.md §2, §5.1)
    origin = "http://localhost:5173"
    status, _body, headers = call(
        "OPTIONS",
        "/api/v1/calculate",
        None,
        {"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
    )
    check("§2 CORS preflight POST разрешён", (status, headers.get("access-control-allow-origin")), (200, origin))
    status, _body, headers = call(
        "OPTIONS",
        "/api/v1/history",
        None,
        {"Origin": origin, "Access-Control-Request-Method": "DELETE"},
    )
    check("§2 CORS preflight DELETE разрешён", (status, headers.get("access-control-allow-origin")), (200, origin))
    status, _body, headers = call("POST", "/api/v1/calculate", {"operation": "add", "operands": [1, 1]}, {"Origin": origin})
    check("§2 CORS фактический ответ с origin", headers.get("access-control-allow-origin"), origin)
    status, _body, headers = call(
        "POST", "/api/v1/calculate", {"operation": "add", "operands": [1, 1]}, {"Origin": "http://evil.test"}
    )
    check("§2 чужой origin не получает allow-origin", headers.get("access-control-allow-origin"), None)

    # 12. Служебные маршруты FastAPI (CONTRACT.md §5.1: публикуются, но не используются фронтом)
    for path in ("/docs", "/openapi.json"):
        status, _body, _ = call("GET", path)
        check(f"§5.1 {path} доступен", status, 200)


def review_frontend_static() -> None:
    """CONTRACT.md §3.2 / §5.2 — статическая поверхность сервиса frontend."""

    import re

    contract = CONTRACT_PATH.read_text(encoding="utf-8")
    package = json.loads((FRONTEND_DIR / "package.json").read_text(encoding="utf-8"))
    nginx = (FRONTEND_DIR / "nginx.conf").read_text(encoding="utf-8")
    healthz = json.loads((FRONTEND_DIR / "public" / "healthz.json").read_text(encoding="utf-8"))

    match = re.search(r"^\| version \| `([^`]+)` \|$", contract, re.MULTILINE)
    contract_version = match.group(1) if match else None
    check("§3.2 версия CONTRACT.md = версия package.json", contract_version, package["version"])
    check(
        "§3.2 /healthz отдаёт контрактный конверт frontend",
        healthz,
        {"status": "ok", "service": "frontend", "version": contract_version},
    )

    record("§3.2 nginx отдаёт index.html на SPA-маршруты", "try_files $uri $uri/ /index.html" in nginx)
    healthz_location = re.search(r"location = /healthz\s*\{[^}]*\}", nginx, re.DOTALL)
    record(
        "§3.2 nginx маппит /healthz на healthz.json",
        bool(healthz_location) and "try_files /healthz.json" in healthz_location.group(0),
    )
    assets_location = re.search(r"location /assets/\s*\{[^}]*\}", nginx, re.DOTALL)
    record(
        "§3.2 nginx кеширует /assets на год immutable",
        bool(assets_location) and "public, max-age=31536000, immutable" in assets_location.group(0),
    )

    # VITE_APP_VERSION (CONTRACT.md §5.2) обязан влиять на version в /healthz:
    # ищем чтение переменной в build-конфиге (vite.config.ts), а не только в декларациях типов.
    ignored = {"frontend/src/vite-env.d.ts", "frontend/.env.example"}
    uses_version: list[str] = []
    for path in sorted(FRONTEND_DIR.rglob("*")):
        if not path.is_file() or "node_modules" in path.parts or "dist" in path.parts:
            continue
        if path.suffix not in {".ts", ".tsx", ".json", ".html", ".js", ".mjs", ".cjs"}:
            continue
        relative = str(path.relative_to(REPO_ROOT))
        if relative in ignored:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if "VITE_APP_VERSION" in text:
            uses_version.append(relative)
    record(
        "§5.2 VITE_APP_VERSION влияет на version в /healthz",
        bool(uses_version),
        f"используется в: {uses_version}" if uses_version else "env-переменная нигде не читается, /healthz статичен",
    )

    dist = FRONTEND_DIR / "dist"
    record("§3.2 dist/index.html собран", (dist / "index.html").is_file())
    assets = sorted((dist / "assets").glob("*")) if (dist / "assets").is_dir() else []
    record("§3.2 dist/assets содержит хешированные бандлы", len(assets) >= 2, f"files={[p.name for p in assets]}")
    dist_healthz_path = dist / "healthz.json"
    if dist_healthz_path.is_file():
        dist_healthz = json.loads(dist_healthz_path.read_text(encoding="utf-8"))
        check("§3.2 dist/healthz.json = public/healthz.json", dist_healthz, healthz)
    else:
        record("§3.2 dist/healthz.json присутствует", False, "нет файла (сборка не выполнялась)")


def main(argv: list[str]) -> int:
    global BASE_URL
    static_only = "--static-only" in argv
    positional = [item for item in argv if not item.startswith("-")]
    if positional:
        BASE_URL = positional[0].rstrip("/")

    review_frontend_static()
    if not static_only:
        try:
            call("GET", "/health")
        except OSError as error:  # pragma: no cover - среда без живого сервиса
            print(f"FAIL  живой backend недоступен по {BASE_URL}: {error}")
            return 1
        review_backend_contract()

    failed = [(name, detail) for name, ok, detail in RESULTS if not ok]
    print("-" * 72)
    print(f"ИТОГО: {len(RESULTS) - len(failed)}/{len(RESULTS)} проверок пройдено")
    if failed:
        print("РАСХОЖДЕНИЯ:")
        for name, detail in failed:
            print(f"  - {name}: {detail}")
        return 1
    print("QA CONTRACT REVIEW OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
