from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root:root@localhost:3306/showdemo"

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "admin123456"
    FORCE_RESET_DEFAULT_ADMIN_PASSWORD: bool = False

    LLM_API_KEY: str = ""
    LLM_API_URL: str = ""
    LLM_MODEL: str = ""
    GEEKNOW_API_URL: str = ""
    GEEKNOW_API_KEY: str = ""
    # showdemo 拆解服务扩展配置（可选）
    SHOWDEMO_LLM_BASE_URL: str = ""
    SHOWDEMO_LLM_API_KEY: str = ""
    SHOWDEMO_LLM_MODEL: str = ""
    SHOWDEMO_LLM_TIMEOUT_SEC: int = 120
    # 对外可访问的媒体域名（用于将 /uploads/... 转成完整 URL）
    MEDIA_PUBLIC_BASE_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
