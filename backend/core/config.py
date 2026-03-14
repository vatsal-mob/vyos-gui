from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # GUI Auth
    secret_key: str = Field(..., description="JWT signing key (openssl rand -hex 32)")
    gui_username: str = Field(default="admin")
    gui_password_hash: str = Field(..., description="bcrypt hash of GUI password")
    access_token_expire_minutes: int = Field(default=480)

    # VyOS Connection defaults (can be overridden at login)
    vyos_host: str = Field(default="10.10.10.1")
    vyos_port: int = Field(default=22)
    vyos_ssh_user: str = Field(default="vyos")
    vyos_ssh_password: str = Field(default="vyos")
    vyos_api_key: str = Field(default="")
    vyos_api_url: str = Field(default="https://10.10.10.1")
    vyos_tls_verify: bool = Field(default=False)

    # App
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:5173"])


settings = Settings()
