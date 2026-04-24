from pydantic_settings import BaseSettings


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
    GEEKNOW_API_URL: str = ""
    GEEKNOW_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
