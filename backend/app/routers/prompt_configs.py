from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import PromptConfig, User
from app.schemas import PromptConfigCreate, PromptConfigResponse, PromptConfigUpdate

router = APIRouter()


@router.post("/", response_model=PromptConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_config(
    body: PromptConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可创建配置")
    config = PromptConfig(**body.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/", response_model=List[PromptConfigResponse])
async def list_prompt_configs(
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PromptConfig)
    if type:
        query = query.filter(PromptConfig.type == type)
    return query.all()


@router.get("/{config_id}", response_model=PromptConfigResponse)
async def get_prompt_config(config_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    config = db.query(PromptConfig).filter(PromptConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    return config


@router.put("/{config_id}", response_model=PromptConfigResponse)
async def update_prompt_config(
    config_id: int,
    body: PromptConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可更新配置")
    config = db.query(PromptConfig).filter(PromptConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(config, k, v)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_config(config_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可删除配置")
    config = db.query(PromptConfig).filter(PromptConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    db.delete(config)
    db.commit()
    return None
