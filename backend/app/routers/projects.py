from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Scene, User
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate, SceneResponse
from app.services.ai_service import ai_service

router = APIRouter()


class AssignRequest(BaseModel):
    assigned_to: int


class ProjectDetailResponse(ProjectResponse):
    scenes: List[SceneResponse] = []

    class Config:
        from_attributes = True


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可创建项目")
    project = Project(
        title=body.title,
        script=body.script,
        status="draft",
        created_by=current_user.id,
        assigned_to=body.assigned_to,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=List[ProjectResponse])
def list_projects(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Project)
    if current_user.role != "director":
        query = query.filter(Project.assigned_to == current_user.id)
    if status_filter:
        query = query.filter(Project.status == status_filter)
    return query.order_by(Project.created_at.desc()).all()


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_project_or_404(project_id, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    if current_user.role != "director" and project.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限更新项目")
    update_data = body.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/decompose", response_model=List[SceneResponse])
async def decompose_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可拆解剧本")
    project = _get_project_or_404(project_id, db)
    if not project.script:
        raise HTTPException(status_code=400, detail="项目尚未填写剧本")
    db.query(Scene).filter(Scene.project_id == project_id).delete()
    scene_data_list = await ai_service.decompose_script(project.script)
    created = []
    for item in scene_data_list:
        scene = Scene(
            project_id=project_id,
            scene_index=item["scene_index"],
            prompt=item.get("prompt"),
            characters=item.get("characters"),
            scene_description=item.get("scene_description"),
            dialogue=item.get("dialogue"),
            camera_angle=item.get("camera_angle"),
            emotion=item.get("emotion"),
            status="pending",
        )
        db.add(scene)
        created.append(scene)
    project.status = "processing"
    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.put("/{project_id}/assign", response_model=ProjectResponse)
def assign_project(
    project_id: int,
    body: AssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可分配任务")
    project = _get_project_or_404(project_id, db)
    target = db.query(User).filter(User.id == body.assigned_to).first()
    if not target:
        raise HTTPException(status_code=404, detail="目标用户不存在")
    project.assigned_to = body.assigned_to
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/submit-review", response_model=ProjectResponse)
def submit_review(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = _get_project_or_404(project_id, db)
    project.status = "review"
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = _get_project_or_404(project_id, db)
    if current_user.role != "director" and project.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限删除项目")
    db.delete(project)
    db.commit()
    return None
