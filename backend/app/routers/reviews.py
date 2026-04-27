"""
审核路由
说明: 审核的创建、查询、统计等
版本: v2.0 (重构版)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Review, ReviewComment, Scene, User
from app.schemas import ReviewCreate, ReviewResponse, ApiResponse

router = APIRouter()


@router.post("/", response_model=ApiResponse, summary="创建审核")
async def create_review(
    body: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    创建审核记录（导演审核项目）
    
    - **project_id**: 项目ID
    - **status**: 审核结果（approved/rejected）
    - **comment**: 审核意见
    - **scene_comments**: 每个分镜的审核意见（可选）
    """
    # 仅导演可审核
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可审核")
    
    # 验证项目
    project = db.query(Project).filter(Project.id == body.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 创建审核记录
    review = Review(
        project_id=body.project_id,
        reviewer_id=current_user.id,
        status=body.status,
        comment=body.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # 创建分镜审核意见
    if body.scene_comments:
        for scene_comment in body.scene_comments:
            comment = ReviewComment(
                review_id=review.id,
                scene_id=scene_comment["scene_id"],
                action=scene_comment["action"],
                comment=scene_comment.get("comment"),
            )
            db.add(comment)
        db.commit()
    
    # 更新项目状态
    if body.status == "approved":
        project.status = "approved"
    else:
        project.status = "rejected"
    db.commit()
    
    return ApiResponse(
        success=True,
        message="审核完成",
        data={
            "review_id": review.id,
            "project_status": project.status
        }
    )


@router.get("/", response_model=ApiResponse, summary="获取审核列表")
async def list_reviews(
    project_id: Optional[int] = Query(None, description="项目ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取审核列表"""
    query = db.query(Review)
    
    if project_id:
        query = query.filter(Review.project_id == project_id)
    
    total = query.count()
    reviews = query.order_by(Review.created_at.desc()).offset((page - 1) * size).limit(size).all()
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "total": total,
            "page": page,
            "size": size,
            "items": [
                {
                    "id": r.id,
                    "project_id": r.project_id,
                    "reviewer_id": r.reviewer_id,
                    "status": r.status,
                    "comment": r.comment,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in reviews
            ]
        }
    )


@router.get("/pending", response_model=ApiResponse, summary="获取待审核项目")
async def get_pending_reviews(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取所有待审核的项目（仅导演）"""
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可查看")
    
    query = db.query(Project).filter(Project.status == "review")
    total = query.count()
    projects = query.order_by(Project.updated_at.desc()).offset((page - 1) * size).limit(size).all()
    
    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "total": total,
            "page": page,
            "size": size,
            "items": [
                {
                    "id": p.id,
                    "title": p.title,
                    "status": p.status,
                    "assigned_to": p.assigned_to,
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                }
                for p in projects
            ]
        }
    )


@router.get("/projects", response_model=ApiResponse, summary="获取审核中心项目列表")
async def get_review_projects(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取审核中心项目列表（仅导演）

    范围：待审核(review) + 已审核(approved/rejected) 项目
    """
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可查看")

    query = db.query(Project).filter(Project.status.in_(["review", "approved", "rejected"]))
    total = query.count()
    projects = query.order_by(Project.updated_at.desc()).offset((page - 1) * size).limit(size).all()

    items = []
    for p in projects:
        first_image_scene = (
            db.query(Scene)
            .filter(
                Scene.project_id == p.id,
                Scene.is_deleted == 0,
                Scene.image_url.isnot(None),
                Scene.image_url != "",
            )
            .order_by(Scene.episode_number.asc(), Scene.scene_index.asc(), Scene.id.asc())
            .first()
        )
        first_video_scene = (
            db.query(Scene)
            .filter(
                Scene.project_id == p.id,
                Scene.is_deleted == 0,
                Scene.video_url.isnot(None),
                Scene.video_url != "",
            )
            .order_by(Scene.episode_number.asc(), Scene.scene_index.asc(), Scene.id.asc())
            .first()
        )

        latest_review = (
            db.query(Review)
            .filter(Review.project_id == p.id)
            .order_by(Review.created_at.desc())
            .first()
        )
        reviewer_name = None
        if latest_review and latest_review.reviewer_id:
            reviewer = db.query(User).filter(User.id == latest_review.reviewer_id).first()
            if reviewer:
                reviewer_name = reviewer.display_name or reviewer.username

        items.append({
            "id": p.id,
            "title": p.title,
            "status": p.status,
            "assigned_to": p.assigned_to,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "latest_review_status": latest_review.status if latest_review else None,
            "latest_review_at": latest_review.created_at.isoformat() if latest_review and latest_review.created_at else None,
            "latest_reviewer": reviewer_name,
            "latest_comment": latest_review.comment if latest_review else None,
            "preview_image_url": first_image_scene.image_url if first_image_scene else None,
            "preview_video_url": first_video_scene.video_url if first_video_scene else None,
        })

    return ApiResponse(
        success=True,
        message="获取成功",
        data={
            "total": total,
            "page": page,
            "size": size,
            "items": items
        }
    )
