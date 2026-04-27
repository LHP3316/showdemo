"""
导出功能路由
说明: 提供项目资源导出功能（图片、视频打包下载）
版本: v2.0
"""
from math import ceil
from pathlib import Path
from time import strftime
from zipfile import ZIP_DEFLATED, ZipFile
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Scene
from app.schemas import ApiResponse
from app.deps import get_current_user
from app.utils.media_urls import to_public_media_url

router = APIRouter(prefix="/export", tags=["导出"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOADS_ROOT = PROJECT_ROOT / "uploads"
EXPORTS_ROOT = UPLOADS_ROOT / "exports"
EXPORTS_ROOT.mkdir(parents=True, exist_ok=True)


def _local_path_from_upload_url(url: str | None) -> Path | None:
    text = str(url or "").strip().replace("\\", "/")
    if not text:
        return None
    marker = "/uploads/"
    idx = text.lower().find(marker)
    if idx < 0:
        if text.lower().startswith("uploads/"):
            text = f"/{text}"
            idx = text.lower().find(marker)
    if idx < 0:
        return None
    rel = text[idx + 1 :]  # strip leading slash
    candidate = PROJECT_ROOT / rel
    return candidate


def _iter_scene_media_urls(scene: Scene) -> list[str]:
    urls: list[str] = []
    if scene.image_url:
        urls.append(str(scene.image_url))
    if isinstance(scene.image_urls, list):
        for u in scene.image_urls:
            if u:
                urls.append(str(u))
    if scene.video_url:
        urls.append(str(scene.video_url))
    # 去重但保持顺序
    seen = set()
    out: list[str] = []
    for u in urls:
        key = str(u).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


@router.get("/project/{project_id}/assets", response_model=ApiResponse, summary="获取项目资产清单")
async def get_project_assets(
    project_id: int,
    episode: Optional[int] = Query(None, description="集数（可选）"),
    page: int = Query(1, ge=1, description="页码（从1开始）"),
    size: int = Query(10, ge=1, le=50, description="每页数量"),
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
    assets_all = []
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
        assets_all.append(asset)

    total = len(assets_all)
    start = (page - 1) * size
    end = start + size
    items = assets_all[start:end] if start < total else []
    total_pages = max(1, ceil(total / size)) if size else 1
    
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
            # 分页信息（前端导出中心使用）
            "page": page,
            "size": size,
            "total": total,
            "total_pages": total_pages,
            # items 为当前页
            "items": items,
            # assets 保持兼容（旧前端使用 a.assets）
            "assets": items,
        }
    )


@router.post("/project/{project_id}/scene/{scene_id}/package", response_model=ApiResponse, summary="打包下载单个分镜")
async def package_scene_export(
    project_id: int,
    scene_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    scene = (
        db.query(Scene)
        .filter(Scene.id == scene_id, Scene.project_id == project_id, Scene.is_deleted == 0)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")

    media_urls = _iter_scene_media_urls(scene)
    if not media_urls:
        raise HTTPException(status_code=400, detail="该分镜暂无可导出的图片/视频")

    ts = strftime("%Y%m%d_%H%M%S")
    zip_name = f"project_{project_id}_scene_{scene_id}_{ts}.zip"
    zip_path = EXPORTS_ROOT / zip_name

    included = 0
    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as zf:
        for url in media_urls:
            local_path = _local_path_from_upload_url(url)
            if not local_path or not local_path.exists() or not local_path.is_file():
                continue
            arcname = f"project_{project_id}/scene_{scene.scene_index:02d}/{local_path.name}"
            try:
                zf.write(local_path, arcname=arcname)
                included += 1
            except Exception:
                continue

    if included <= 0:
        raise HTTPException(status_code=400, detail="未找到可打包的本地资源文件")

    download_url = to_public_media_url(f"/uploads/exports/{zip_name}") or f"/uploads/exports/{zip_name}"
    return ApiResponse(
        success=True,
        message="分镜导出包生成成功",
        data={
            "project_id": project_id,
            "scene_id": scene_id,
            "scene_index": scene.scene_index,
            "download_url": download_url,
            "included_files": included,
        },
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
    
    # 生成 ZIP 文件（仅打包本地 /uploads 下存在的资源）
    ts = strftime("%Y%m%d_%H%M%S")
    zip_name = f"project_{project_id}_export_{ts}.zip"
    zip_path = EXPORTS_ROOT / zip_name

    included = 0
    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as zf:
        for item in export_list:
            for kind in ("image_url", "video_url"):
                url = item.get(kind)
                local_path = _local_path_from_upload_url(url)
                if not local_path or not local_path.exists() or not local_path.is_file():
                    continue
                # 归档路径：exports/project_<id>/images|videos/filename
                sub = "images" if kind == "image_url" else "videos"
                arcname = f"project_{project_id}/{sub}/{local_path.name}"
                try:
                    zf.write(local_path, arcname=arcname)
                    included += 1
                except Exception:
                    continue

    download_url = to_public_media_url(f"/uploads/exports/{zip_name}") or f"/uploads/exports/{zip_name}"
    
    return ApiResponse(
        success=True,
        message="导出包生成成功",
        data={
            "project_id": project_id,
            "project_title": project.title,
            "download_url": download_url,
            "total_items": len(export_list),
            "included_files": included,
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
