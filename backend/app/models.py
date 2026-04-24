from sqlalchemy import JSON, TIMESTAMP, Column, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(100), nullable=False)
    role = Column(Enum("director", "staff", "writer", "reviewer", name="user_role"), default="staff")
    created_at = Column(TIMESTAMP, server_default=func.now())

    created_projects = relationship("Project", foreign_keys="Project.created_by", back_populates="creator")
    assigned_projects = relationship("Project", foreign_keys="Project.assigned_to", back_populates="assignee")
    reviews = relationship("Review", back_populates="reviewer")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    script = Column(Text, nullable=True)
    status = Column(
        Enum("draft", "processing", "review", "approved", "rejected", "exported", name="project_status"),
        default="draft",
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by], back_populates="created_projects")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_projects")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="project")


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    scene_index = Column(Integer, nullable=False)
    prompt = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    video_url = Column(Text, nullable=True)
    status = Column(Enum("pending", "done", name="scene_status"), default="pending")
    characters = Column(JSON, nullable=True)
    scene_description = Column(Text, nullable=True)
    dialogue = Column(Text, nullable=True)
    camera_angle = Column(String(100), nullable=True)
    emotion = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    project = relationship("Project", back_populates="scenes")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum("approved", "rejected", name="review_status"), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    project = relationship("Project", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")


class PromptConfig(Base):
    __tablename__ = "prompt_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(Enum("text2img", "img2video", "img2img", name="prompt_type"), nullable=False)
    name = Column(String(100), nullable=True)
    config = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
