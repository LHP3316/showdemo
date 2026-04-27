#!/bin/bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
ROOT_DIR="$(cd "${SCRIPT_PATH%/*}/.." && pwd)"

BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-${ROOT_DIR}/backend/.env}"
OUT_FILE="${OUT_FILE:-${ROOT_DIR}/frontend/static/config.js}"

DEFAULT_API_BASE_URL="${DEFAULT_API_BASE_URL:-http://localhost:8001}"

api_base_url=""

if [ -f "${BACKEND_ENV_FILE}" ]; then
  # Prefer a dedicated key for frontend api base.
  api_base_url="$(grep -E '^[[:space:]]*FRONTEND_API_BASE_URL=' "${BACKEND_ENV_FILE}" | tail -n 1 | cut -d '=' -f2- | tr -d '\r' || true)"
  if [ -z "${api_base_url}" ]; then
    # Fallback: derive from MEDIA_PUBLIC_BASE_URL (usually https://domain.com/)
    media_base="$(grep -E '^[[:space:]]*MEDIA_PUBLIC_BASE_URL=' "${BACKEND_ENV_FILE}" | tail -n 1 | cut -d '=' -f2- | tr -d '\r' || true)"
    if [ -n "${media_base}" ]; then
      api_base_url="$(echo "${media_base}" | sed -E 's#/*$##')"
    fi
  fi
fi

if [ -z "${api_base_url}" ]; then
  api_base_url="${DEFAULT_API_BASE_URL}"
fi

mkdir -p "$(dirname "${OUT_FILE}")"
cat > "${OUT_FILE}" <<EOF
// Generated at runtime. Do not edit by hand.
// Source: ${BACKEND_ENV_FILE}
window.__SHOWDEMO_CONFIG__ = window.__SHOWDEMO_CONFIG__ || {};
window.__SHOWDEMO_CONFIG__.API_BASE_URL = "${api_base_url}";
EOF

echo "[config] wrote ${OUT_FILE} (API_BASE_URL=${api_base_url})"

