from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres@127.0.0.1:5432/pipeline"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # A deal that has sat in its current stage this long is flagged in the UI.
    stage_warning_days: int = 21
    stage_stale_days: int = 45

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
