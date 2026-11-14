"""Configuración del backend leída desde variables de entorno (.env)."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    gemini_fallback_model: str
    allowed_origins: list[str]

    @property
    def has_api_key(self) -> bool:
        return bool(self.gemini_api_key)


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


settings = Settings(
    gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
    gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip(),
    gemini_fallback_model=os.getenv(
        "GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite"
    ).strip(),
    allowed_origins=_split_csv(
        os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    ),
)
