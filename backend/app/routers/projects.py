"""
项目路由
说明: 项目管理相关API（创建、查询、更新、分配、拆解等）
版本: v2.0 (重构版)
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Scene, User
from app.schemas import (
    ProjectCreate, 
    ProjectResponse, 
    ProjectUpdate, 
    ProjectDetailResponse,
    SceneResponse,
    ApiResponse
)
from app.services.ai_service import ai_service

router = APIRouter()


class AssignRequest:
    """分配请求模型"""
    assigned_to: int


def _get_project_or_404(project_id: int, db: Session) -> Project:
    """获取项目或返回404"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.post("/", response_model=ApiResponse, status_code=status.HTTP_201_CREATED, summary="创建项目")
async def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建新项目（仅导演权限）
    
    - **title**: 项目标题
    - **description**: 项目描述
    - **script**: 剧本内容
    - **genre**: 项目类型
    - **episode_count**: 总集数
    - **assigned_to**: 分配给工作人员（可选）
    """
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可创建项目")
    
    project = Project(
        title=body.title,
        description=body.description,
        script=body.script,
        genre=body.genre,
        episode_count=body.episode_count,
        current_episode=1,
        status="draft",
        created_by=current_user.id,
        assigned_to=body.assigned_to,
        deadline=body.deadline,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return ApiResponse(
        success=True,
        message="项目创建成功",
        data={
            "id": project.id,
            "title": project.title,
            "status": project.status
        }
    )


@router.get("/", response_model=ApiResponse, summary="获取项目列表")
async def list_projects(
    status_filter: Optional[str] = Query(None, description="状态过滤"),
    genre_filter: Optional[str] = Query(None, description="类型过滤"),
    assigned_to: Optional[int] = Query(None, description="执行人ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取项目列表（支持分页和过滤）
    
    - 导演可以看到所有项目
    - 工作人员只能看到分配给自己的项目
    """
    query = db.query(Project)
    
    # 权限过滤
    if current_user.role != "director":
        query = query.filter(Project.assigned_to == current_user.id)
    
    # 条件过滤
    if status_filter:
        query = query.filter(Project.status == status_filter)
    if genre_filter:
        query = query.filter(Project.genre == genre_filter)
    if assigned_to:
        query = query.filter(Project.assigned_to == assigned_to)
    
    # 总数
    total = query.count()
    
    # 分页查询
    projects = query.order_by(Project.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    # 构建响应
    items = []
    for project in projects:
        # 统计分镜数量
        scene_count = db.query(Scene).filter(Scene.project_id == project.id).count()
        
        items.append({
            "id": project.id,
            "title": project.title,
            "description": project.description,
            "genre": project.genre,
            "episode_count": project.episode_count,
            "current_episode": project.current_episode,
            "status": project.status,
            "created_by": project.created_by,
            "assigned_to": project.assigned_to,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "scene_count": scene_count,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        })
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "total": total,
            "page": page,
            "size": size,
            "items": items
        }
    )


@router.get("/stats", response_model=ApiResponse, summary="获取项目统计")
async def get_project_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取项目统计数据
    
    返回各状态的项目数量、总数等统计信息
    """
    query = db.query(Project)
    if current_user.role != "director":
        query = query.filter(Project.assigned_to == current_user.id)
    
    total = query.count()
    draft_count = query.filter(Project.status == "draft").count()
    processing_count = query.filter(Project.status == "processing").count()
    review_count = query.filter(Project.status == "review").count()
    approved_count = query.filter(Project.status == "approved").count()
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "total": total,
            "draft": draft_count,
            "processing": processing_count,
            "review": review_count,
            "approved": approved_count
        }
    )


@router.get("/{project_id}", response_model=ApiResponse, summary="获取项目详情")
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取项目详细信息（包含分镜列表）"""
    project = _get_project_or_404(project_id, db)
    
    # 权限检查
    if current_user.role != "director" and project.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="无权限访问此项目")
    
    # 查询分镜
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.episode_number, Scene.scene_index).all()
    
    # 构建响应
    project_data = {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "script": project.script,
        "genre": project.genre,
        "episode_count": project.episode_count,
        "current_episode": project.current_episode,
        "status": project.status,
        "created_by": project.created_by,
        "assigned_to": project.assigned_to,
        "deadline": project.deadline.isoformat() if project.deadline else None,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }
    
    scenes_data = [
        {
            "id": scene.id,
            "episode_number": scene.episode_number,
            "scene_index": scene.scene_index,
            "characters": scene.characters,
            "scene_description": scene.scene_description,
            "dialogue": scene.dialogue,
            "camera_angle": scene.camera_angle,
            "emotion": scene.emotion,
            "prompt": scene.prompt,
            "image_url": scene.image_url,
            "video_url": scene.video_url,
            "duration": scene.duration,
            "status": scene.status,
            "created_at": scene.created_at.isoformat() if scene.created_at else None,
        }
        for scene in scenes
    ]
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            **project_data,
            "scenes": scenes_data,
            "scene_count": len(scenes_data)
        }
    )


@router.put("/{project_id}", response_model=ApiResponse, summary="更新项目")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新项目信息"""
    project = _get_project_or_404(project_id, db)
    
    # 权限检查
    if current_user.role != "director" and project.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限更新项目")
    
    # 更新字段
    update_data = body.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    
    return ApiResponse(
        success=True,
        message="项目更新成功",
        data={"id": project.id}
    )


@router.post("/{project_id}/decompose", response_model=ApiResponse, summary="AI拆解剧本")
async def decompose_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    使用AI自动拆解剧本为分镜
    
    - 仅导演可执行
    - 会删除现有分镜并重新生成
    """
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可拆解剧本")
    
    project = _get_project_or_404(project_id, db)
    if not project.script:
        raise HTTPException(status_code=400, detail="项目尚未填写剧本")
    
    # 删除现有分镜
    db.query(Scene).filter(Scene.project_id == project_id).delete()
    
    # AI拆解
    scene_data_list = await ai_service.decompose_script(project.script)
    
    # 创建分镜
    created = []
    for item in scene_data_list:
        scene = Scene(
            project_id=project_id,
            episode_number=1,
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
    
    # 更新项目状态
    project.status = "processing"
    db.commit()
    
    for s in created:
        db.refresh(s)
    
    return ApiResponse(
        success=True,
        message=f"剧本拆解成功，共生成 {len(created)} 个分镜",
        data={
            "scene_count": len(created),
            "scenes": [
                {
                    "id": s.id,
                    "scene_index": s.scene_index,
                    "scene_description": s.scene_description
                }
                for s in created
            ]
        }
    )


@router.put("/{project_id}/assign", response_model=ApiResponse, summary="分配项目")
async def assign_project(
    project_id: int,
    assigned_to: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """分配项目给工作人员（仅导演）"""
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可分配任务")
    
    project = _get_project_or_404(project_id, db)
    target = db.query(User).filter(User.id == assigned_to).first()
    if not target:
        raise HTTPException(status_code=404, detail="目标用户不存在")
    
    project.assigned_to = assigned_to
    db.commit()
    db.refresh(project)
    
    return ApiResponse(
        success=True,
        message="分配成功",
        data={
            "project_id": project.id,
            "assigned_to": assigned_to,
            "assignee_name": target.display_name or target.username
        }
    )


@router.post("/{project_id}/submit-review", response_model=ApiResponse, summary="提交审核")
async def submit_review(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """工作人员提交项目审核"""
    project = _get_project_or_404(project_id, db)
    
    # 权限检查
    if project.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="无权限提交此项目")
    
    project.status = "review"
    db.commit()
    db.refresh(project)
    
    return ApiResponse(
        success=True,
        message="已提交审核",
        data={"project_id": project.id, "status": project.status}
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除项目")
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除项目（仅导演或创建人）"""
    project = _get_project_or_404(project_id, db)
    
    if current_user.role != "director" and project.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="无权限删除项目")
    
    db.delete(project)
    db.commit()
    
    return None
