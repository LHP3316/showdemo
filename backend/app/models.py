"""
数据库模型定义
说明: 定义所有数据库表的ORM映射，包含完整的字段注释
版本: v2.0 (重构版)
"""
from sqlalchemy import JSON, TIMESTAMP, Column, Enum, ForeignKey, Integer, String, Text, func, SmallInteger
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """用户表 - 存储平台所有用户的基本信息和权限"""
    __tablename__ = "users"
    __table_args__ = {'comment': '用户表 - 存储平台所有用户的基本信息和权限'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='用户ID，主键，自增')
    username = Column(String(50), unique=True, nullable=False, comment='登录用户名，唯一标识')
    password = Column(String(100), nullable=False, comment='密码哈希值（bcrypt加密）')
    display_name = Column(String(100), comment='显示名称/用户名，可重复；与登录账号独立')
    role = Column(
        Enum("director", "staff", "writer", "reviewer", name="user_role"),
        default="staff",
        comment='用户角色：director=导演, staff=工作人员, writer=编剧, reviewer=审核员'
    )
    avatar_url = Column(String(255), comment='头像图片URL地址')
    is_active = Column(SmallInteger, default=1, comment='账号状态：1=激活, 0=禁用')
    last_login = Column(TIMESTAMP, nullable=True, comment='最后登录时间')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='账号创建时间')

    # 关系定义
    created_projects = relationship("Project", foreign_keys="Project.created_by", back_populates="creator")
    assigned_projects = relationship("Project", foreign_keys="Project.assigned_to", back_populates="assignee")
    reviews = relationship("Review", back_populates="reviewer")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class Project(Base):
    """项目表 - 短剧项目主表，包含剧本内容和项目状态"""
    __tablename__ = "projects"
    __table_args__ = {'comment': '项目表 - 短剧项目主表，包含剧本内容和项目状态'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='项目ID，主键，自增')
    title = Column(String(255), nullable=False, comment='项目标题（短剧名称）')
    description = Column(Text, comment='项目描述（剧情简介、创作背景等）')
    script = Column(Text, comment='完整剧本内容（纯文本或Markdown格式）')
    writer_name = Column(String(100), comment='编剧显示名（可选；无编剧账号体系时使用）')
    episode_title = Column(String(255), comment='当前集标题（可选；用于剧本工位展示）')
    episode_summary = Column(Text, comment='当前集简介（可选；与项目简介分离）')
    genre = Column(String(50), comment='项目类型：古风/科幻/都市/悬疑/爱情等')
    episode_count = Column(Integer, comment='总集数')
    current_episode = Column(Integer, default=1, comment='当前正在处理的集数')
    status = Column(
        Enum("draft", "processing", "review", "approved", "rejected", "exported", name="project_status"),
        default="draft",
        comment='项目状态：draft=草稿, processing=制作中, review=审核中, approved=已通过, rejected=已驳回, exported=已导出'
    )
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, comment='创建人用户ID（通常是导演）')
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, comment='当前分配的执行人员ID（通常是工作人员）')
    deadline = Column(TIMESTAMP, nullable=True, comment='项目截止日期')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='项目创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='最后更新时间（自动更新）')

    # 关系定义
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_projects")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_projects")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="project")

    def __repr__(self):
        return f"<Project(id={self.id}, title='{self.title}', status='{self.status}')>"


class Scene(Base):
    """分镜表 - 存储项目的分镜详细信息和AI生成资源"""
    __tablename__ = "scenes"
    __table_args__ = {'comment': '分镜表 - 存储项目的分镜详细信息和AI生成资源'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='分镜ID，主键，自增')
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, comment='所属项目ID')
    episode_number = Column(Integer, default=1, comment='所属集数（用于多集短剧）')
    scene_index = Column(Integer, nullable=False, comment='分镜序号（项目或集内排序）')
    characters = Column(String(500), comment='出场角色列表（逗号分隔，如：主角,反派,配角）')
    scene_description = Column(Text, comment='场景详细描述（用于AI生成参考）')
    dialogue = Column(Text, comment='角色台词内容')
    camera_angle = Column(String(100), comment='镜头语言/机位描述（如：特写、远景、俯拍、跟拍等）')
    emotion = Column(String(100), comment='情绪氛围描述（如：紧张、温馨、悬疑、悲伤等）')
    # 兼容字段：历史上图片/视频共用一套 prompt；新逻辑使用 image_prompt / video_prompt
    prompt = Column(Text, comment='AI生成提示词（兼容旧字段；新字段见 image_prompt/video_prompt）')
    image_prompt = Column(Text, comment='文生图提示词（image 专用）')
    video_prompt = Column(Text, comment='图生视频提示词（video 专用）')
    image_config = Column(JSON, comment='文生图参数配置（JSON，可选）')
    video_config = Column(JSON, comment='图生视频参数配置（JSON，可选）')
    image_url = Column(Text, comment='AI生成的分镜图片URL')
    video_url = Column(Text, comment='AI生成的分镜视频URL')
    duration = Column(Integer, comment='视频时长（单位：秒）')
    status = Column(
        Enum("pending", "editing", "image_ready", "video_ready", "accepted", name="scene_status"),
        default="pending",
        comment='分镜状态：pending=待编辑, editing=编辑中, image_ready=图片已生成, video_ready=视频已生成, accepted=审核通过'
    )
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='分镜创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='最后更新时间（自动更新）')

    # 关系定义
    project = relationship("Project", back_populates="scenes")

    def __repr__(self):
        return f"<Scene(id={self.id}, project_id={self.project_id}, index={self.scene_index})>"


class Review(Base):
    """审核记录表 - 存储项目的审核历史和结果"""
    __tablename__ = "reviews"
    __table_args__ = {'comment': '审核记录表 - 存储项目的审核历史和结果'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='审核记录ID，主键，自增')
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, comment='被审核的项目ID')
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment='审核人用户ID（通常是导演）')
    status = Column(
        Enum("approved", "rejected", name="review_status"),
        nullable=False,
        comment='审核结果：approved=通过, rejected=驳回'
    )
    comment = Column(Text, comment='审核意见（驳回原因或通过备注）')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='审核提交时间')

    # 关系定义
    project = relationship("Project", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")
    comments = relationship("ReviewComment", back_populates="review", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Review(id={self.id}, project_id={self.project_id}, status='{self.status}')>"


class ReviewComment(Base):
    """审核意见明细表 - 存储审核时每个分镜的具体通过/驳回意见"""
    __tablename__ = "review_comments"
    __table_args__ = {'comment': '审核意见明细表 - 存储审核时每个分镜的具体通过/驳回意见'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='审核意见ID，主键，自增')
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, comment='所属审核记录ID')
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, comment='被审核的分镜ID')
    action = Column(
        Enum("approved", "rejected", name="review_action"),
        nullable=False,
        comment='对该分镜的操作：approved=通过, rejected=驳回'
    )
    comment = Column(Text, comment='针对该分镜的具体审核意见')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='意见创建时间')

    # 关系定义
    review = relationship("Review", back_populates="comments")
    scene = relationship("Scene")

    def __repr__(self):
        return f"<ReviewComment(id={self.id}, scene_id={self.scene_id}, action='{self.action}')>"


class TaskQueue(Base):
    """AI生成任务队列表 - 异步跟踪文生图和图生视频任务的执行状态"""
    __tablename__ = "task_queue"
    __table_args__ = {'comment': 'AI生成任务队列表 - 异步跟踪AI生成任务的执行状态'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='任务ID，主键，自增')
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, comment='关联的分镜ID')
    task_type = Column(
        Enum("text2img", "img2video", name="task_type"),
        nullable=False,
        comment='任务类型：text2img=文生图, img2video=图生视频'
    )
    status = Column(
        Enum("pending", "processing", "success", "failed", name="task_status"),
        default="pending",
        comment='任务状态：pending=排队中, processing=生成中, success=成功, failed=失败'
    )
    progress = Column(Integer, default=0, comment='任务进度百分比（0-100）')
    result_url = Column(Text, comment='生成结果文件的URL（图片或视频）')
    error_message = Column(Text, comment='失败时的错误信息')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='任务创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='最后更新时间（自动更新）')

    # 关系定义
    scene = relationship("Scene")

    def __repr__(self):
        return f"<TaskQueue(id={self.id}, scene_id={self.scene_id}, type='{self.task_type}', status='{self.status}')>"


class PromptConfig(Base):
    """Prompt配置表 - 存储AI生成的Prompt模板和参数配置"""
    __tablename__ = "prompt_configs"
    __table_args__ = {'comment': 'Prompt配置表 - 存储AI生成的Prompt模板和参数配置'}

    id = Column(Integer, primary_key=True, autoincrement=True, comment='配置ID，主键，自增')
    type = Column(
        Enum("text2img", "img2video", "img2img", name="prompt_type"),
        nullable=False,
        comment='配置类型：text2img=文生图, img2video=图生视频, img2img=图生图'
    )
    name = Column(String(100), comment='配置名称（如：古风场景模板、科幻风格模板）')
    config = Column(JSON, comment='配置内容（JSON格式，包含模型参数、风格设置等）')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='配置创建时间')

    def __repr__(self):
        return f"<PromptConfig(id={self.id}, type='{self.type}', name='{self.name}')>"
