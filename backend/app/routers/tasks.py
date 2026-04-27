"""
任务队列路由
说明: 管理AI生成任务（文生图、图生视频）的创建、查询和状态更新
版本: v2.0
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TaskQueue, Scene
from app.schemas import TaskCreate, TaskResponse, ApiResponse
from app.deps import get_current_user
from app.services.ai_service import AIService
from app.utils.media_urls import to_public_media_url

router = APIRouter(prefix="/tasks", tags=["任务队列"])


@router.post("", response_model=ApiResponse, summary="创建AI生成任务")
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    创建AI生成任务（文生图或图生视频）
    
    - **scene_id**: 分镜ID
    - **task_type**: 任务类型（text2img 或 img2video）
    """
    # 验证分镜是否存在
    scene = db.query(Scene).filter(Scene.id == task_data.scene_id, Scene.is_deleted == 0).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    
    # 验证图生视频任务需要有图片
    if task_data.task_type == "img2video" and not scene.image_url:
        raise HTTPException(status_code=400, detail="需要先生成图片才能生成视频")
    
    # 创建任务
    task = TaskQueue(
        scene_id=task_data.scene_id,
        task_type=task_data.task_type,
        status="pending"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # 异步触发AI生成（这里简化处理，实际应该使用Celery等异步任务队列）
    try:
        if task_data.task_type == "text2img":
            # 文生图
            prompt = scene.image_prompt or scene.prompt
            if not prompt:
                raise HTTPException(status_code=400, detail="分镜缺少Prompt")
            
            # 调用AI服务生成图片
            image_url = await AIService.generate_image(prompt)
            
            # 更新分镜和任务状态
            scene.image_url = image_url
            scene.status = "image_ready"
            task.status = "success"
            task.result_url = image_url
            task.progress = 100
            
        elif task_data.task_type == "img2video":
            # 图生视频
            if not scene.image_url:
                raise HTTPException(status_code=400, detail="分镜缺少图片")
            
            # 调用AI服务生成视频
            video_url = await AIService.generate_video(scene.image_url)
            
            # 更新分镜和任务状态
            scene.video_url = video_url
            scene.status = "video_ready"
            task.status = "success"
            task.result_url = video_url
            task.progress = 100
        
        db.commit()
        
        return ApiResponse(
            success=True,
            message="任务创建成功",
            data={"task_id": task.id, "status": task.status}
        )
    
    except Exception as e:
        task.status = "failed"
        task.error_message = str(e)
        db.commit()
        
        raise HTTPException(status_code=500, detail=f"AI生成失败: {str(e)}")


@router.get("", response_model=ApiResponse, summary="获取任务列表")
async def get_tasks(
    scene_id: Optional[int] = Query(None, description="分镜ID"),
    status: Optional[str] = Query(None, description="任务状态"),
    task_type: Optional[str] = Query(None, description="任务类型"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    获取任务列表（支持过滤和分页）
    """
    query = db.query(TaskQueue)
    
    # 过滤条件
    if scene_id:
        query = query.filter(TaskQueue.scene_id == scene_id)
    if status:
        query = query.filter(TaskQueue.status == status)
    if task_type:
        query = query.filter(TaskQueue.task_type == task_type)
    
    # 总数
    total = query.count()
    
    # 分页
    tasks = query.order_by(TaskQueue.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "total": total,
            "page": page,
            "size": size,
            "items": [
                {
                    "id": task.id,
                    "scene_id": task.scene_id,
                    "task_type": task.task_type,
                    "status": task.status,
                    "progress": task.progress,
                    "result_url": to_public_media_url(task.result_url),
                    "error_message": task.error_message,
                    "created_at": task.created_at.isoformat() if task.created_at else None,
                    "updated_at": task.updated_at.isoformat() if task.updated_at else None
                }
                for task in tasks
            ]
        }
    )


@router.get("/{task_id}", response_model=ApiResponse, summary="获取任务详情")
async def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    获取单个任务详情
    """
    task = db.query(TaskQueue).filter(TaskQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "id": task.id,
            "scene_id": task.scene_id,
            "task_type": task.task_type,
            "status": task.status,
            "progress": task.progress,
            "result_url": to_public_media_url(task.result_url),
            "error_message": task.error_message,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        }
    )


@router.delete("/{task_id}", response_model=ApiResponse, summary="删除任务")
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    删除任务（仅限失败或成功的任务）
    """
    task = db.query(TaskQueue).filter(TaskQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status == "processing":
        raise HTTPException(status_code=400, detail="无法删除正在执行的任务")
    
    db.delete(task)
    db.commit()
    
    return ApiResponse(
        success=True,
        message="任务删除成功"
    )


@router.post("/{task_id}/retry", response_model=ApiResponse, summary="重试失败任务")
async def retry_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    重试失败的任务
    """
    task = db.query(TaskQueue).filter(TaskQueue.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status != "failed":
        raise HTTPException(status_code=400, detail="只能重试失败的任务")
    
    # 重置任务状态
    task.status = "pending"
    task.progress = 0
    task.error_message = None
    db.commit()
    
    return ApiResponse(
        success=True,
        message="任务已重置为待执行",
        data={"task_id": task.id}
    )
