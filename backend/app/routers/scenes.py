from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Scene, User
from app.schemas import SceneCreate, SceneResponse, SceneUpdate
from app.services.geeknow_service import geeknow_service

router = APIRouter()


class SceneReorder(BaseModel):
    scene_ids: List[int]


@router.get("/", response_model=List[SceneResponse])
async def list_scenes(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_index).all()


@router.get("/{scene_id}", response_model=SceneResponse)
async def get_scene(scene_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    return scene


@router.put("/{scene_id}", response_model=SceneResponse)
async def update_scene(scene_id: int, body: SceneUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(scene, k, v)
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/{scene_id}/generate-image", response_model=SceneResponse)
async def generate_image(scene_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    prompt = scene.prompt or scene.scene_description or "default scene"
    scene.image_url = await geeknow_service.text_to_image(prompt)
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/{scene_id}/generate-video", response_model=SceneResponse)
async def generate_video(scene_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    if not scene.image_url:
        raise HTTPException(status_code=400, detail="请先生成图片")
    scene.video_url = await geeknow_service.image_to_video(scene.image_url, scene.prompt)
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/", response_model=SceneResponse, status_code=status.HTTP_201_CREATED)
async def create_scene(body: SceneCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    scene = Scene(**body.model_dump())
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(scene_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="分镜不存在")
    db.delete(scene)
    db.commit()
    return None


@router.put("/reorder", response_model=List[SceneResponse])
async def reorder_scenes(payload: SceneReorder, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for idx, scene_id in enumerate(payload.scene_ids):
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if scene:
            scene.scene_index = idx + 1
    db.commit()
    if not payload.scene_ids:
        return []
    first = db.query(Scene).filter(Scene.id == payload.scene_ids[0]).first()
    if not first:
        return []
    return db.query(Scene).filter(Scene.project_id == first.project_id).order_by(Scene.scene_index).all()
