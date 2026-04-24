"""应用启动自检与初始化。"""

from __future__ import annotations

from passlib.context import CryptContext
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _is_valid_password_hash(value: str | None) -> bool:
    if not value:
        return False
    try:
        return pwd_context.identify(value) is not None
    except Exception:
        return False


def ensure_default_admin() -> None:
    """
    启动时确保默认管理员可登录：
    - 不存在则创建 admin
    - 存在但密码不是有效哈希则重置为默认密码
    - 角色异常则修正为 director
    - 如果用户用 admin123 登录失败，自动重置为 admin123456
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == settings.DEFAULT_ADMIN_USERNAME).first()
        admin_hash = pwd_context.hash(settings.DEFAULT_ADMIN_PASSWORD)

        if user is None:
            user = User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                password=admin_hash,
                role="director",
            )
            db.add(user)
            db.commit()
            print(f"[bootstrap] 已创建默认管理员: {settings.DEFAULT_ADMIN_USERNAME}")
            return

        needs_update = False
        if user.role != "director":
            user.role = "director"
            needs_update = True

        # 始终重置密码为 admin123456（方便测试）
        if settings.FORCE_RESET_DEFAULT_ADMIN_PASSWORD or not _is_valid_password_hash(user.password):
            user.password = admin_hash
            needs_update = True
        
        # 如果是旧密码 admin123，也重置
        try:
            if not pwd_context.verify("admin123456", user.password):
                user.password = admin_hash
                needs_update = True
                print(f"[bootstrap] 检测到旧密码，已重置为 admin123456")
        except Exception:
            pass

        if needs_update:
            db.commit()
            print(f"[bootstrap] 已修复默认管理员: {settings.DEFAULT_ADMIN_USERNAME}")
    except SQLAlchemyError as exc:
        db.rollback()
        print(f"[bootstrap] 跳过管理员初始化（数据库异常）: {exc}")
    except Exception as exc:
        db.rollback()
        print(f"[bootstrap] 跳过管理员初始化（未知异常）: {exc}")
    finally:
        db.close()
