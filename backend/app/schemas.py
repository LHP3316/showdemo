"""
Pydantic Schema 定义
说明: 定义所有API请求和响应的数据模型，包含完整的字段验证
版本: v2.0 (重构版)
"""
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ============================================================
# 用户相关 Schema
# ============================================================

class UserBase(BaseModel):
    """用户基础信息"""
    username: str = Field(..., min_length=3, max_length=50, description="登录账号，全平台唯一")

class UserCreate(UserBase):
    """创建用户请求"""
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    display_name: Optional[str] = Field(None, max_length=100, description="用户名/显示名，可重复")
    role: str = Field(default="staff", description="用户角色：director/staff/writer/reviewer")

class UserLogin(BaseModel):
    """用户登录请求"""
    username: str = Field(..., description="登录账号")
    password: str = Field(..., description="密码")

class UserUpdate(BaseModel):
    """更新用户信息请求"""
    display_name: Optional[str] = Field(None, max_length=100, description="显示名称")
    avatar_url: Optional[str] = Field(None, max_length=255, description="头像URL")
    is_active: Optional[int] = Field(None, description="账号状态：1=激活, 0=禁用")

class UserResponse(UserBase):
    """用户响应"""
    id: int
    display_name: Optional[str] = None
    role: str
    avatar_url: Optional[str] = None
    is_active: int
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    """Token响应"""
    access_token: str
    token_type: str = "bearer"

class TokenWithUser(Token):
    """带用户信息的Token响应"""
    user: UserResponse


# ============================================================
# 项目相关 Schema
# ============================================================

class ProjectBase(BaseModel):
    """项目基础信息"""
    title: str = Field(..., min_length=1, max_length=255, description="项目标题")
    description: Optional[str] = Field(None, description="项目描述")
    genre: Optional[str] = Field(None, max_length=50, description="项目类型")
    episode_count: Optional[int] = Field(None, ge=1, description="总集数")

class ProjectCreate(ProjectBase):
    """创建项目请求"""
    script: Optional[str] = Field(None, description="剧本内容")
    assigned_to: Optional[int] = Field(None, description="分配的执行人员ID")
    deadline: Optional[datetime] = Field(None, description="截止日期")

class ProjectUpdate(BaseModel):
    """更新项目请求"""
    title: Optional[str] = Field(None, max_length=255, description="项目标题")
    description: Optional[str] = Field(None, description="项目描述")
    script: Optional[str] = Field(None, description="剧本内容")
    genre: Optional[str] = Field(None, max_length=50, description="项目类型")
    episode_count: Optional[int] = Field(None, ge=1, description="总集数")
    current_episode: Optional[int] = Field(None, ge=1, description="当前处理集数")
    status: Optional[str] = Field(None, description="项目状态")
    assigned_to: Optional[int] = Field(None, description="分配的执行人员ID")
    deadline: Optional[datetime] = Field(None, description="截止日期")

class ProjectResponse(ProjectBase):
    """项目响应"""
    id: int
    script: Optional[str] = None
    current_episode: int = 1
    status: str
    created_by: Optional[int] = None
    assigned_to: Optional[int] = None
    deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProjectDetailResponse(ProjectResponse):
    """项目详情响应（包含关联数据）"""
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None
    scene_count: int = Field(default=0, description="分镜数量")


# ============================================================
# 分镜相关 Schema
# ============================================================

class SceneBase(BaseModel):
    """分镜基础信息"""
    episode_number: int = Field(default=1, ge=1, description="所属集数")
    scene_index: int = Field(..., ge=1, description="分镜序号")
    characters: Optional[str] = Field(None, max_length=500, description="出场角色（逗号分隔）")
    scene_description: Optional[str] = Field(None, description="场景描述")
    dialogue: Optional[str] = Field(None, description="台词内容")
    camera_angle: Optional[str] = Field(None, max_length=100, description="镜头语言")
    emotion: Optional[str] = Field(None, max_length=100, description="情绪描述")
    prompt: Optional[str] = Field(None, description="AI生成提示词")

class SceneCreate(SceneBase):
    """创建分镜请求"""
    project_id: int = Field(..., description="所属项目ID")

class SceneUpdate(BaseModel):
    """更新分镜请求"""
    episode_number: Optional[int] = Field(None, ge=1, description="所属集数")
    scene_index: Optional[int] = Field(None, ge=1, description="分镜序号")
    characters: Optional[str] = Field(None, max_length=500, description="出场角色")
    scene_description: Optional[str] = Field(None, description="场景描述")
    dialogue: Optional[str] = Field(None, description="台词内容")
    camera_angle: Optional[str] = Field(None, max_length=100, description="镜头语言")
    emotion: Optional[str] = Field(None, max_length=100, description="情绪描述")
    prompt: Optional[str] = Field(None, description="AI提示词")
    image_url: Optional[str] = Field(None, description="图片URL")
    video_url: Optional[str] = Field(None, description="视频URL")
    duration: Optional[int] = Field(None, ge=0, description="视频时长（秒）")
    status: Optional[str] = Field(None, description="分镜状态")

class SceneResponse(SceneBase):
    """分镜响应"""
    id: int
    project_id: int
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    duration: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# 审核相关 Schema
# ============================================================

class ReviewCreate(BaseModel):
    """创建审核请求"""
    project_id: int = Field(..., description="项目ID")
    status: str = Field(..., description="审核结果：approved/rejected")
    comment: Optional[str] = Field(None, description="审核意见")
    scene_comments: Optional[List[dict]] = Field(
        None,
        description="分镜审核意见列表：[{scene_id: int, action: str, comment: str}]"
    )

class ReviewResponse(BaseModel):
    """审核响应"""
    id: int
    project_id: int
    reviewer_id: int
    status: str
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReviewDetailResponse(ReviewResponse):
    """审核详情响应（包含分镜意见）"""
    reviewer: Optional[UserResponse] = None
    scene_comments: List[dict] = []


# ============================================================
# 任务队列相关 Schema
# ============================================================

class TaskCreate(BaseModel):
    """创建AI生成任务请求"""
    scene_id: int = Field(..., description="分镜ID")
    task_type: str = Field(..., description="任务类型：text2img/img2video")

class TaskResponse(BaseModel):
    """任务响应"""
    id: int
    scene_id: int
    task_type: str
    status: str
    progress: int = 0
    result_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Prompt配置相关 Schema
# ============================================================

class PromptConfigBase(BaseModel):
    """Prompt配置基础信息"""
    type: str = Field(..., description="配置类型：text2img/img2video/img2img")
    name: Optional[str] = Field(None, max_length=100, description="配置名称")
    config: Optional[Any] = Field(None, description="配置内容（JSON）")

class PromptConfigCreate(PromptConfigBase):
    """创建Prompt配置请求"""
    pass

class PromptConfigUpdate(BaseModel):
    """更新Prompt配置请求"""
    type: Optional[str] = Field(None, description="配置类型")
    name: Optional[str] = Field(None, max_length=100, description="配置名称")
    config: Optional[Any] = Field(None, description="配置内容")

class PromptConfigResponse(PromptConfigBase):
    """Prompt配置响应"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# 通用响应包装
# ============================================================

class ApiResponse(BaseModel):
    """通用API响应"""
    success: bool = True
    message: str = "操作成功"
    data: Optional[Any] = None

class PaginatedResponse(BaseModel):
    """分页响应"""
    total: int
    page: int
    size: int
    items: List[Any]
