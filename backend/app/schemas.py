from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str
    role: str = "staff"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenWithUser(Token):
    user: UserResponse


class ProjectBase(BaseModel):
    title: str
    script: Optional[str] = None


class ProjectCreate(ProjectBase):
    assigned_to: Optional[int] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    script: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None


class ProjectResponse(ProjectBase):
    id: int
    status: str
    created_by: Optional[int] = None
    assigned_to: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SceneBase(BaseModel):
    project_id: int
    scene_index: int
    prompt: Optional[str] = None
    scene_description: Optional[str] = None
    dialogue: Optional[str] = None
    camera_angle: Optional[str] = None
    emotion: Optional[str] = None
    characters: Optional[Any] = None


class SceneCreate(SceneBase):
    pass


class SceneUpdate(BaseModel):
    scene_index: Optional[int] = None
    prompt: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    status: Optional[str] = None
    characters: Optional[Any] = None
    scene_description: Optional[str] = None
    dialogue: Optional[str] = None
    camera_angle: Optional[str] = None
    emotion: Optional[str] = None


class SceneResponse(SceneBase):
    id: int
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewBase(BaseModel):
    project_id: int
    status: str
    comment: Optional[str] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewResponse(ReviewBase):
    id: int
    reviewer_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PromptConfigBase(BaseModel):
    type: str
    name: Optional[str] = None
    config: Optional[Any] = None


class PromptConfigCreate(PromptConfigBase):
    pass


class PromptConfigUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    config: Optional[Any] = None


class PromptConfigResponse(PromptConfigBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
