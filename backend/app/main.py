from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bootstrap import ensure_default_admin
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.prompt_configs import router as prompt_configs_router
from app.routers.reviews import router as reviews_router
from app.routers.scenes import router as scenes_router
from app.routers.tasks import router as tasks_router
from app.routers.export import router as export_router

app = FastAPI(
    title="AI短剧协作平台",
    description="电影工业级AI短剧生产协作平台 - v2.0重构版",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["认证"])
app.include_router(projects_router, prefix="/projects", tags=["项目"])
app.include_router(scenes_router, prefix="/api/scenes", tags=["分镜"])
app.include_router(reviews_router, prefix="/api/reviews", tags=["审核"])
app.include_router(prompt_configs_router, prefix="/api/prompt-configs", tags=["Prompt配置"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["任务队列"])
app.include_router(export_router, prefix="/api/export", tags=["导出"])


@app.on_event("startup")
def startup_event():
    ensure_default_admin()


@app.get("/")
def root():
    return {"message": "AI短剧生产平台 API"}
