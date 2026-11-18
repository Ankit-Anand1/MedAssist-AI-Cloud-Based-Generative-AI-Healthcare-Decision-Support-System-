import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path)
load_dotenv()


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017/medassist"
    DB_NAME: str = "medassist"
    JWT_SECRET: str = "medassist-dev-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 720
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    AI_MODELS_DIR: str = "./ai"
    GEMINI_API_KEY: str = ""  # Optional: enables LLM-powered AI briefs and copilot
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "google/gemini-2.5-flash"
    OPENAI_API_KEY: str = ""
    ALLOWED_FILE_TYPES: list[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/bmp",
        "image/tiff",
        "application/dicom",
    ]

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


settings = Settings()
