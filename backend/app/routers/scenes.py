"""
分镜路由
说明: 分镜的增删改查、AI生成等
版本: v2.0 (重构版)
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Scene, User
from app.schemas import SceneCreate, SceneResponse, SceneUpdate, ApiResponse
from app.services.geeknow_service import geeknow_service
from app.utils.media_urls import to_public_media_url, normalize_media_url_list

router = APIRouter()
def _get_scene_or_404(scene_id: int, db: Session) -> Scene:
    """获取分镜或返回404"""
    scene = db.query(Scene).filter(Scene.id == scene_id, Scene.is_deleted == 0).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    return scene


@router.get("/", response_model=ApiResponse, summary="获取分镜列表")
async def list_scenes(
    project_id: int = Query(..., description="项目ID"),
    episode: Optional[int] = Query(None, description="集数（可选）"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取项目的分镜列表"""
    query = db.query(Scene).filter(Scene.project_id == project_id, Scene.is_deleted == 0)
    
    if episode:
        query = query.filter(Scene.episode_number == episode)
    
    scenes = query.order_by(Scene.episode_number, Scene.scene_index).all()
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data=[
            {
                "id": scene.id,
                "project_id": scene.project_id,
                "episode_number": scene.episode_number,
                "scene_index": scene.scene_index,
                "characters": scene.characters,
                "scene_description": scene.scene_description,
                "dialogue": scene.dialogue,
                "camera_angle": scene.camera_angle,
                "emotion": scene.emotion,
                "prompt": scene.prompt,
                "image_prompt": scene.image_prompt,
                "video_prompt": scene.video_prompt,
                "image_config": scene.image_config,
                "video_config": scene.video_config,
                "image_url": to_public_media_url(scene.image_url),
                "image_urls": normalize_media_url_list(scene.image_urls),
                "video_url": to_public_media_url(scene.video_url),
                "duration": scene.duration,
                "status": scene.status,
                "created_at": scene.created_at.isoformat() if scene.created_at else None,
                "updated_at": scene.updated_at.isoformat() if scene.updated_at else None,
            }
            for scene in scenes
        ]
    )


@router.get("/{scene_id}", response_model=ApiResponse, summary="获取分镜详情")
async def get_scene(
    scene_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取单个分镜详情"""
    scene = _get_scene_or_404(scene_id, db)
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "id": scene.id,
            "project_id": scene.project_id,
            "episode_number": scene.episode_number,
            "scene_index": scene.scene_index,
            "characters": scene.characters,
            "scene_description": scene.scene_description,
            "dialogue": scene.dialogue,
            "camera_angle": scene.camera_angle,
            "emotion": scene.emotion,
            "prompt": scene.prompt,
            "image_prompt": scene.image_prompt,
            "video_prompt": scene.video_prompt,
            "image_config": scene.image_config,
            "video_config": scene.video_config,
            "image_url": to_public_media_url(scene.image_url),
            "image_urls": normalize_media_url_list(scene.image_urls),
            "video_url": to_public_media_url(scene.video_url),
            "duration": scene.duration,
            "status": scene.status,
            "created_at": scene.created_at.isoformat() if scene.created_at else None,
            "updated_at": scene.updated_at.isoformat() if scene.updated_at else None,
        }
    )


@router.post("/", response_model=ApiResponse, status_code=status.HTTP_201_CREATED, summary="创建分镜")
async def create_scene(
    body: SceneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建新分镜"""
    # 验证项目存在
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 创建分镜
    scene = Scene(
        project_id=body.project_id,
        episode_number=body.episode_number or 1,
        scene_index=body.scene_index,
        characters=body.characters,
        scene_description=body.scene_description,
        dialogue=body.dialogue,
        camera_angle=body.camera_angle,
        emotion=body.emotion,
        prompt=body.prompt,
        image_prompt=body.image_prompt,
        video_prompt=body.video_prompt,
        image_config=body.image_config,
        video_config=body.video_config,
        image_urls=body.image_urls,
        status="pending",
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    
    return ApiResponse(
        success=True,
        message="分镜创建成功",
        data={"id": scene.id, "scene_index": scene.scene_index}
    )


@router.put("/{scene_id}", response_model=ApiResponse, summary="更新分镜")
async def update_scene(
    scene_id: int,
    body: SceneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新分镜信息"""
    scene = _get_scene_or_404(scene_id, db)
    
    # 更新字段
    update_data = body.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scene, key, value)
    
    db.commit()
    db.refresh(scene)
    
    return ApiResponse(
        success=True,
        message="分镜更新成功",
        data={"id": scene.id}
    )


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除分镜")
async def delete_scene(
    scene_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除分镜"""
    scene = _get_scene_or_404(scene_id, db)
    scene.is_deleted = 1
    scene.deleted_at = func.now()
    db.commit()
    
    return None


@router.post("/{scene_id}/generate-image", response_model=ApiResponse, summary="生成图片（文生图）")
async def generate_image(
    scene_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    使用AI根据Prompt生成分镜图片
    
    - 需要分镜有 prompt 或 scene_description
    - 生成成功后自动更新 image_url
    """
    scene = _get_scene_or_404(scene_id, db)
    
    # 验证 prompt
    prompt = scene.image_prompt or scene.prompt or scene.scene_description
    if not prompt:
        raise HTTPException(status_code=400, detail="分镜缺少Prompt或场景描述")
    
    try:
        # 调用AI服务生成图片
        image_urls = await geeknow_service.text_to_images(prompt, config=scene.image_config or None)
        image_url = image_urls[0]
        
        # 更新分镜
        scene.image_url = image_url
        scene.image_urls = image_urls
        scene.status = "image_ready"
        db.commit()
        db.refresh(scene)
        
        return ApiResponse(
            success=True,
            message="图片生成成功",
            data={
                "scene_id": scene.id,
                "image_url": to_public_media_url(image_url),
                "image_urls": normalize_media_url_list(image_urls),
                "status": scene.status
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片生成失败: {str(e)}")


@router.post("/{scene_id}/generate-video", response_model=ApiResponse, summary="生成视频（图生视频）")
async def generate_video(
    scene_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    使用AI生成分镜视频
    - 仅支持图生视频
    - 无图时直接报错
    - 生成成功后自动更新 video_url
    """
    scene = _get_scene_or_404(scene_id, db)

    # 优先 image_url，兼容历史数据回退到 image_urls[0]
    source_image = (scene.image_url or "").strip()
    if not source_image and isinstance(scene.image_urls, list) and scene.image_urls:
        source_image = str(scene.image_urls[0] or "").strip()
    if not source_image:
        raise HTTPException(status_code=400, detail="请先为当前分镜生成图片，再生成视频")

    try:
        # 提示词优先级：video_prompt > prompt > scene_description
        vprompt = scene.video_prompt or scene.prompt
        if not vprompt:
            vprompt = scene.scene_description or ""

        video_url = await geeknow_service.image_to_video(source_image, vprompt, config=scene.video_config or None)

        # 更新分镜
        scene.video_url = video_url
        scene.status = "video_ready"
        db.commit()
        db.refresh(scene)
        
        return ApiResponse(
            success=True,
            message="视频生成成功",
            data={
                "scene_id": scene.id,
                "video_url": to_public_media_url(video_url),
                "image_url": to_public_media_url(scene.image_url),
                "image_urls": normalize_media_url_list(scene.image_urls),
                "status": scene.status
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"视频生成失败: {str(e)}")


@router.post("/batch/generate-images", response_model=ApiResponse, summary="批量生成图片")
async def batch_generate_images(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量生成项目所有分镜的图片"""
    scenes = db.query(Scene).filter(
        Scene.project_id == project_id,
        Scene.is_deleted == 0,
        Scene.image_url.is_(None)
    ).all()
    
    success_count = 0
    failed_count = 0
    
    for scene in scenes:
        try:
            prompt = scene.image_prompt or scene.prompt or scene.scene_description
            if prompt:
                image_urls = await geeknow_service.text_to_images(prompt, config=scene.image_config or None)
                scene.image_url = image_urls[0]
                scene.image_urls = image_urls
                scene.status = "image_ready"
                success_count += 1
        except Exception:
            failed_count += 1
    
    db.commit()
    
    return ApiResponse(
        success=True,
        message=f"批量生成完成：成功 {success_count}，失败 {failed_count}",
        data={
            "success": success_count,
            "failed": failed_count
        }
    )


@router.post("/batch/generate-videos", response_model=ApiResponse, summary="批量生成视频")
async def batch_generate_videos(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量生成项目所有分镜的视频（仅图生视频，无图则跳过）"""
    scenes = db.query(Scene).filter(
        Scene.project_id == project_id,
        Scene.is_deleted == 0,
        Scene.video_url.is_(None)
    ).all()
    
    success_count = 0
    failed_count = 0
    
    for scene in scenes:
        try:
            source_image = (scene.image_url or "").strip()
            if not source_image and isinstance(scene.image_urls, list) and scene.image_urls:
                source_image = str(scene.image_urls[0] or "").strip()
            if not source_image:
                failed_count += 1
                continue
            vprompt = scene.video_prompt or scene.prompt or scene.scene_description or ""
            video_url = await geeknow_service.image_to_video(source_image, vprompt, config=scene.video_config or None)
            scene.video_url = video_url
            scene.status = "video_ready"
            success_count += 1
        except Exception:
            failed_count += 1
    
    db.commit()
    
    return ApiResponse(
        success=True,
        message=f"批量生成完成：成功 {success_count}，失败 {failed_count}",
        data={
            "success": success_count,
            "failed": failed_count
        }
    )
