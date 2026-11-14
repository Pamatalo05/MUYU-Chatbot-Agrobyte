"""Backend de Muyu: punto de entrada de FastAPI.

Bloque 1: solo arranque y verificación de salud.
El endpoint POST /chat se agrega en el Bloque 2.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

app = FastAPI(
    title="Muyu API",
    description="Backend del chatbot Muyu (Gemini, nivel gratuito).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, object]:
    """Indica si el backend está vivo y si la clave de Gemini está configurada.

    Nunca devuelve la clave, solo si existe.
    """
    return {
        "status": "ok",
        "gemini_key_configured": settings.has_api_key,
        "model": settings.gemini_model,
    }
