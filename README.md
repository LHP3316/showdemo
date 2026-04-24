# AI短剧生产平台（演示版）

基于 `ai.md` 与 `AI短剧生产平台_e7b88457.md` 落地的演示工程，包含：

- `backend/`：FastAPI + SQLAlchemy + MySQL
- `frontend/`：HTML + TailwindCSS + 原生 JS（Hash 路由 SPA）

## 已实现模块

- 登录/注册与 JWT 鉴权
- 剧本项目创建、列表、AI 拆解
- 分镜工作台（编辑、增删、文生图、图生视频触发）
- 任务管理（导演分配、工作人员查看）
- 审核中心（查看项目分镜、提交通过/驳回）
- Prompt 配置管理（增删查）

## 后端启动

1. 进入 Ubuntu 环境（你的本地方式）：
```powershell
D:\Project\start-ubuntu.ps1
```

2. 激活环境并进入项目目录：
```bash
conda activate video
cd /mnt/d/Project/showdemo/backend
```

3. 安装依赖并配置环境变量：
```bash
pip install -r requirements.txt
cp .env.example .env
```

4. 准备数据库：
- 先在 MySQL 中执行 `init_db.sql`
- 修改 `.env` 中的 `DATABASE_URL`

5. 启动服务：
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

默认管理员（启动时自动创建/修复）：

- 用户名：`admin`
- 密码：`admin123456`
- 可在 `backend/.env` 通过 `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` 覆盖

## 一键启动脚本（推荐）

项目根目录已提供：

- `./start`：启动后端 + 前端静态服务
- `./stop`：停止后端 + 前端静态服务
- `./status`：查看后端 + 前端状态
- `./restart`：重启后端 + 前端静态服务

首次使用（Ubuntu）：

```bash
cd /mnt/d/Project/showdemo
chmod +x start stop status restart scripts/uvicorn_helpers.sh
```

日常使用：

```bash
./start
./status
./stop
./restart
```

默认端口：

- 后端：`8000`
- 前端静态服务：`5500`

## Gradio 网页创作台（推荐）

如果你不想用“后台管理感”的界面，可以直接使用 Gradio 版本：

1. 安装依赖：
```bash
cd /mnt/d/Project/showdemo/backend
pip install -r requirements.txt
```

2. 启动后端 API（新终端）：
```bash
cd /mnt/d/Project/showdemo
./start
```

3. 启动 Gradio 创作台：
```bash
cd /mnt/d/Project/showdemo
./start_gradio
```

4. 浏览器访问：
- `http://localhost:7860`

## 前端启动

可以直接用静态服务器打开 `frontend/` 目录，例如：

```bash
cd /mnt/d/Project/showdemo/frontend
python3 -m http.server 5500
```

浏览器访问：
- `http://localhost:5500`
- 前端默认请求后端 `http://localhost:8000`
