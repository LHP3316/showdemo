#!/bin/bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
ROOT_DIR="$(cd "${SCRIPT_PATH%/*}/.." && pwd)"

BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend/static"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
LOG_DIR="${ROOT_DIR}/logs"
BACKEND_PID_FILE="${RUNTIME_DIR}/backend.pid"
BACKEND_LOG_FILE="${LOG_DIR}/backend.log"
FRONTEND_PID_FILE="${RUNTIME_DIR}/frontend.pid"
FRONTEND_LOG_FILE="${LOG_DIR}/frontend.log"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8001}"
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

  # 检查 Python3 是否可用
  if ! command -v python3 >/dev/null 2>&1; then
    echo "未找到 python3，请先安装 Python"
    return 1
  fi

  # 生成前端运行时配置（从 backend/.env 读取 API_BASE_URL）
  if [ -f "${ROOT_DIR}/scripts/generate_frontend_config.sh" ]; then
    bash "${ROOT_DIR}/scripts/generate_frontend_config.sh" >/dev/null 2>&1 || true
  fi

  # 先清理可能占用 5500 端口的旧进程
  echo "正在检查端口 ${FRONTEND_PORT}..."
  local old_pid
  old_pid=$(lsof -ti:${FRONTEND_PORT} 2>/dev/null || true)
  if [ -n "${old_pid}" ]; then
    echo "发现占用端口 ${FRONTEND_PORT} 的进程，正在清理..."
    kill -9 ${old_pid} 2>/dev/null || true
    sleep 1
  fi

  (
    cd "${FRONTEND_DIR}"
    nohup python3 -m http.server "${FRONTEND_PORT}" >>"${FRONTEND_LOG_FILE}" 2>&1 &
    echo $! >"${FRONTEND_PID_FILE}"
  )

  sleep 2
  if is_pid_running "${FRONTEND_PID_FILE}"; then
    echo "frontend 启动成功，PID: $(cat "${FRONTEND_PID_FILE}")"
    echo "地址: http://localhost:${FRONTEND_PORT}"
    echo "日志: ${FRONTEND_LOG_FILE}"
  else
    echo "frontend 启动失败，请检查日志: ${FRONTEND_LOG_FILE}"
    return 1
  fi
}

stop_frontend() {
  cleanup_stale_pid "${FRONTEND_PID_FILE}"
  
  # 先杀掉保存的 PID
  if is_pid_running "${FRONTEND_PID_FILE}"; then
    local pid
    pid="$(cat "${FRONTEND_PID_FILE}")"
    kill "${pid}" >/dev/null 2>&1 || true
    
    for _ in {1..20}; do
      if ! kill -0 "${pid}" >/dev/null 2>&1; then
        rm -f "${FRONTEND_PID_FILE}"
        break
      fi
      sleep 0.2
    done
    
    # 强制杀掉
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi
  
  # 清理占用端口的前端进程（Vite 子进程）
  local port_pids
  port_pids=$(lsof -ti:${FRONTEND_PORT} 2>/dev/null || true)
  if [ -n "${port_pids}" ]; then
    echo "发现占用端口 ${FRONTEND_PORT} 的进程，正在清理..."
    echo "${port_pids}" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
  
  # 也清理可能存在的 node 进程
  pkill -f "npm run dev" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  
  rm -f "${FRONTEND_PID_FILE}"
  echo "frontend 已停止"
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
