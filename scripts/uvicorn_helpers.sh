#!/bin/bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
ROOT_DIR="$(cd "${SCRIPT_PATH%/*}/.." && pwd)"

BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
LOG_DIR="${ROOT_DIR}/logs"
BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
BACKEND_LOG_FILE="${LOG_DIR}/backend.log"
FRONTEND_PID_FILE="${RUNTIME_DIR}/frontend.pid"
FRONTEND_LOG_FILE="${LOG_DIR}/frontend.log"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5500}"
CONDA_ENV_NAME="${CONDA_ENV_NAME:-video}"

mkdir -p "${RUNTIME_DIR}" "${LOG_DIR}"

is_pid_running() {
  local pid_file="$1"
  if [ ! -f "${pid_file}" ]; then
    return 1
  fi
  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [ -z "${pid}" ]; then
    return 1
  fi
  if kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

cleanup_stale_pid() {
  local pid_file="$1"
  if [ -f "${pid_file}" ] && ! is_pid_running "${pid_file}"; then
    rm -f "${pid_file}"
  fi
}

start_backend() {
  cleanup_stale_pid "${BACKEND_PID_FILE}"
  if is_pid_running "${BACKEND_PID_FILE}"; then
    echo "backend 已在运行，PID: $(cat "${BACKEND_PID_FILE}")"
    return 0
  fi

  local uvicorn_cmd
  if command -v uvicorn >/dev/null 2>&1; then
    uvicorn_cmd="uvicorn"
  elif command -v conda >/dev/null 2>&1; then
    uvicorn_cmd="conda run -n ${CONDA_ENV_NAME} uvicorn"
  else
    echo "未找到 uvicorn，也未找到 conda。请先安装依赖或激活环境。"
    return 1
  fi

  (
    cd "${BACKEND_DIR}"
    nohup ${uvicorn_cmd} app.main:app --reload --host "${HOST}" --port "${PORT}" >>"${BACKEND_LOG_FILE}" 2>&1 &
    echo $! >"${BACKEND_PID_FILE}"
  )

  sleep 1
  if is_pid_running "${BACKEND_PID_FILE}"; then
    echo "backend 启动成功，PID: $(cat "${BACKEND_PID_FILE}")"
    echo "日志: ${BACKEND_LOG_FILE}"
  else
    echo "backend 启动失败，请检查日志: ${BACKEND_LOG_FILE}"
    return 1
  fi
}

stop_backend() {
  cleanup_stale_pid "${BACKEND_PID_FILE}"
  if ! is_pid_running "${BACKEND_PID_FILE}"; then
    echo "backend 未运行"
    return 0
  fi

  local pid
  pid="$(cat "${BACKEND_PID_FILE}")"
  kill "${pid}" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      rm -f "${BACKEND_PID_FILE}"
      echo "backend 已停止"
      return 0
    fi
    sleep 0.2
  done

  kill -9 "${pid}" >/dev/null 2>&1 || true
  rm -f "${BACKEND_PID_FILE}"
  echo "backend 已强制停止"
}

status_backend() {
  cleanup_stale_pid "${BACKEND_PID_FILE}"
  if is_pid_running "${BACKEND_PID_FILE}"; then
    echo "backend 运行中，PID: $(cat "${BACKEND_PID_FILE}")"
    echo "地址: http://${HOST}:${PORT}"
    echo "日志: ${BACKEND_LOG_FILE}"
  else
    echo "backend 未运行"
  fi
}

start_frontend() {
  cleanup_stale_pid "${FRONTEND_PID_FILE}"
  if is_pid_running "${FRONTEND_PID_FILE}"; then
    echo "frontend 已在运行，PID: $(cat "${FRONTEND_PID_FILE}")"
    return 0
  fi

  local py_cmd
  if command -v python3 >/dev/null 2>&1; then
    py_cmd="python3"
  elif command -v python >/dev/null 2>&1; then
    py_cmd="python"
  else
    echo "未找到 python3/python，无法启动 frontend 静态服务。"
    return 1
  fi

  (
    cd "${FRONTEND_DIR}"
    nohup ${py_cmd} -m http.server "${FRONTEND_PORT}" >>"${FRONTEND_LOG_FILE}" 2>&1 &
    echo $! >"${FRONTEND_PID_FILE}"
  )

  sleep 1
  if is_pid_running "${FRONTEND_PID_FILE}"; then
    echo "frontend 启动成功，PID: $(cat "${FRONTEND_PID_FILE}")"
    echo "地址: http://${HOST}:${FRONTEND_PORT}"
    echo "日志: ${FRONTEND_LOG_FILE}"
  else
    echo "frontend 启动失败，请检查日志: ${FRONTEND_LOG_FILE}"
    return 1
  fi
}

stop_frontend() {
  cleanup_stale_pid "${FRONTEND_PID_FILE}"
  if ! is_pid_running "${FRONTEND_PID_FILE}"; then
    echo "frontend 未运行"
    return 0
  fi

  local pid
  pid="$(cat "${FRONTEND_PID_FILE}")"
  kill "${pid}" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      rm -f "${FRONTEND_PID_FILE}"
      echo "frontend 已停止"
      return 0
    fi
    sleep 0.2
  done

  kill -9 "${pid}" >/dev/null 2>&1 || true
  rm -f "${FRONTEND_PID_FILE}"
  echo "frontend 已强制停止"
}

status_frontend() {
  cleanup_stale_pid "${FRONTEND_PID_FILE}"
  if is_pid_running "${FRONTEND_PID_FILE}"; then
    echo "frontend 运行中，PID: $(cat "${FRONTEND_PID_FILE}")"
    echo "地址: http://${HOST}:${FRONTEND_PORT}"
    echo "日志: ${FRONTEND_LOG_FILE}"
  else
    echo "frontend 未运行"
  fi
}

start_all() {
  start_backend
  start_frontend
}

stop_all() {
  stop_frontend
  stop_backend
}

status_all() {
  status_backend
  status_frontend
}

restart_all() {
  stop_all
  start_all
}
