#!/usr/bin/env bash
# Поднимает backend на свободном порту и проверяет живой HTTP-контур по контрактным фикстурам.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SMOKE_PORT:-8010}"
BASE_URL="http://127.0.0.1:${PORT}"

if [[ -x "${ROOT}/.venv/bin/python" ]]; then
  PY="${ROOT}/.venv/bin/python"
else
  PY="$(command -v python3)"
fi

if ! "${PY}" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "Нет зависимостей backend: выполните 'make install' или pip install -r backend/requirements-dev.txt" >&2
  exit 1
fi

cd "${ROOT}/backend"
HISTORY_FILE="$(mktemp -d)/history.json" "${PY}" -m uvicorn app.main:app \
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

"${PY}" "${ROOT}/scripts/contract_smoke.py" "${BASE_URL}"

# Контрактный тест фронта против этого же живого backend (если установлены npm-зависимости)
if [[ -d "${ROOT}/frontend/node_modules" ]]; then
  cd "${ROOT}/frontend"
  LIVE_BACKEND_URL="${BASE_URL}" npx vitest run src/api/liveBackend.test.ts
else
  echo "skip frontend live test: нет frontend/node_modules (выполните npm install)"
fi

echo "SMOKE ALL OK"
