from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, Review, User
from app.schemas import ReviewCreate, ReviewResponse

router = APIRouter()


@router.post("/", response_model=ReviewResponse, status_code=201)
async def create_review(review_in: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in {"director", "reviewer"}:
        raise HTTPException(status_code=403, detail="仅审核角色可提交审核")
    project = db.query(Project).filter(Project.id == review_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    review = Review(
        project_id=review_in.project_id,
        reviewer_id=current_user.id,
        status=review_in.status,
        comment=review_in.comment,
    )
    db.add(review)
    project.status = review_in.status
    db.commit()
    db.refresh(review)
    return review


@router.get("/", response_model=List[ReviewResponse])
async def list_reviews(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        return db.query(Review).filter(Review.project_id == project_id).order_by(Review.created_at.desc()).all()
    if current_user.role != "director":
        raise HTTPException(status_code=403, detail="仅导演可查看所有审核记录")
    return db.query(Review).order_by(Review.created_at.desc()).all()
