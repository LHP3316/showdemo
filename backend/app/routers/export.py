"""
导出功能路由
说明: 提供项目资源导出功能（图片、视频打包下载）
版本: v2.0
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Scene
from app.schemas import ApiResponse
from app.deps import get_current_user
from app.utils.media_urls import to_public_media_url

router = APIRouter(prefix="/export", tags=["导出"])


@router.get("/project/{project_id}/assets", response_model=ApiResponse, summary="获取项目资产清单")
async def get_project_assets(
    project_id: int,
    episode: Optional[int] = Query(None, description="集数（可选）"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    获取项目的所有生成资源（图片和视频）
    
    返回项目中所有分镜的生成结果，用于导出
    """
    # 验证项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 查询分镜
    query = db.query(Scene).filter(Scene.project_id == project_id, Scene.is_deleted == 0)
    if episode:
        query = query.filter(Scene.episode_number == episode)
    
    scenes = query.order_by(Scene.episode_number, Scene.scene_index).all()
    
    # 构建资产清单
    assets = []
    for scene in scenes:
        asset = {
            "scene_id": scene.id,
            "episode_number": scene.episode_number,
            "scene_index": scene.scene_index,
            "scene_description": scene.scene_description,
            "image_url": to_public_media_url(scene.image_url),
            "video_url": to_public_media_url(scene.video_url),
            "status": scene.status
        }
        assets.append(asset)
    
    # 统计
    total_scenes = len(scenes)
    images_count = sum(1 for s in scenes if s.image_url)
    videos_count = sum(1 for s in scenes if s.video_url)
    
    return ApiResponse(
        success=True,
        message="获取资产清单成功",
        data={
            "project_id": project_id,
            "project_title": project.title,
            "episode": episode,
            "total_scenes": total_scenes,
            "images_count": images_count,
            "videos_count": videos_count,
            "assets": assets
        }
    )


@router.post("/project/{project_id}/package", response_model=ApiResponse, summary="打包导出项目")
async def package_export(
    project_id: int,
    episode: Optional[int] = Query(None, description="集数（可选）"),
    include_images: bool = Query(True, description="是否包含图片"),
    include_videos: bool = Query(True, description="是否包含视频"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    打包导出项目资源
    
    - 生成资源清单JSON
    - 打包图片和视频（实际应该生成ZIP文件）
    - 返回下载链接
    """
    # 验证项目
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 查询分镜
    query = db.query(Scene).filter(Scene.project_id == project_id, Scene.is_deleted == 0)
    if episode:
        query = query.filter(Scene.episode_number == episode)
    
    scenes = query.order_by(Scene.episode_number, Scene.scene_index).all()
    
    # 构建导出清单
    export_list = []
    for scene in scenes:
        item = {
            "scene_id": scene.id,
            "episode": scene.episode_number,
            "index": scene.scene_index,
            "description": scene.scene_description,
        }
        
        if include_images and scene.image_url:
            item["image_url"] = to_public_media_url(scene.image_url)
        
        if include_videos and scene.video_url:
            item["video_url"] = to_public_media_url(scene.video_url)
        
        export_list.append(item)
    
    # 这里应该实际生成ZIP文件并上传到对象存储
    # 简化处理：返回导出清单
    download_url = f"/api/export/download/{project_id}"  # 模拟下载链接
    
    return ApiResponse(
        success=True,
        message="导出包生成成功",
        data={
            "project_id": project_id,
            "project_title": project.title,
            "download_url": download_url,
            "total_items": len(export_list),
            "include_images": include_images,
            "include_videos": include_videos,
            "export_list": export_list
        }
    )


@router.get("/download/{project_id}", response_model=ApiResponse, summary="下载导出包")
async def download_export(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    下载项目导出包
    
    实际应该返回ZIP文件的下载链接或文件流
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 这里应该返回实际的文件下载
    # 简化处理：返回提示信息
    return ApiResponse(
        success=True,
        message="下载功能开发中",
        data={
            "project_id": project_id,
            "project_title": project.title,
            "note": "实际实现应该返回ZIP文件流"
        }
    )
