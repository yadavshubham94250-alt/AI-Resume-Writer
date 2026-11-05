from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")
    app_name: str = "AI Resume Writer"
    database_url: str = "sqlite:///./data/resume_writer.db"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    max_upload_mb: int = Field(default=10, ge=1, le=50)

    @property
    def database_path(self) -> Path:
        return Path(self.database_url.removeprefix("sqlite:///"))


settings = Settings()
