#!/usr/bin/env bash
# Независимая QA-проверка контракта: статика frontend + живой контракт backend.
# Использование: ./scripts/qa_review.sh [--build-check]
#   --build-check — собрать frontend с VITE_APP_VERSION=9.9.9 и проверить, что значение
#                   попало в dist/healthz.json (CONTRACT.md §5.2), затем вернуть штатную сборку.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${QA_PORT:-8020}"
BASE_URL="http://127.0.0.1:${PORT}"
BUILD_CHECK="${1:-}"

if [[ -x "${ROOT}/.venv/bin/python" ]]; then
  PY="${ROOT}/.venv/bin/python"
else
  PY="$(command -v python3)"
fi

if ! "${PY}" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "Нет зависимостей backend: выполните 'make install' или pip install -r backend/requirements-dev.txt" >&2
  exit 1
fi

STATUS=0

echo "=== QA: живой контракт backend ($BASE_URL) ==="
mkdir -p "${ROOT}/.logs"
cd "${ROOT}/backend"
HISTORY_FILE="${ROOT}/.logs/qa-history.json" "${PY}" -m uvicorn app.main:app \
  --host 127.0.0.1 --port "${PORT}" --log-level warning &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "${BASE_URL}/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    echo "backend не запустился" >&2
    exit 1
  fi
  sleep 0.25
done

"${PY}" "${ROOT}/scripts/qa_contract_review.py" "${BASE_URL}" || STATUS=1

if [[ "${BUILD_CHECK}" == "--build-check" ]]; then
  echo "=== QA: сборка frontend уважает VITE_APP_VERSION (CONTRACT.md §5.2) ==="
  if [[ ! -d "${ROOT}/frontend/node_modules" ]]; then
    echo "skip build-check: нет frontend/node_modules (выполните npm install)"
  else
    ( cd "${ROOT}/frontend" && VITE_APP_VERSION=9.9.9 npx vite build --logLevel warn >/dev/null )
    ACTUAL="$(tr -d ' \n' < "${ROOT}/frontend/dist/healthz.json")"
    if [[ "${ACTUAL}" == *'"version":"9.9.9"'* ]]; then
      echo "PASS build-check: dist/healthz.json отдаёт version=9.9.9 из VITE_APP_VERSION"
    else
      echo "FAIL build-check: dist/healthz.json = ${ACTUAL}"
      STATUS=1
    fi
    # Возвращаем штатную сборку (VITE_APP_VERSION по умолчанию).
    ( cd "${ROOT}/frontend" && npm run build >/dev/null )
    echo "info штатная сборка восстановлена: $(tr -d ' \n' < "${ROOT}/frontend/dist/healthz.json")"
  fi
fi

exit "${STATUS}"
