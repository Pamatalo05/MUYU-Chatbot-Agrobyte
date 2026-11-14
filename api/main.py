"""Backend de Muyu: FastAPI + Gemini (nivel gratuito)."""

import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from config import settings

load_dotenv()
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
SYSTEM = (Path(__file__).parent / "prompts" / "muyu.txt").read_text(encoding="utf-8")
MODELS = list(dict.fromkeys([settings.gemini_model, "gemini-2.5-flash-lite"]))
TAG = re.compile(r"\[emocion:(happy|neutral)\]", re.IGNORECASE)

app = FastAPI(
    title="Muyu API",
    description="Backend del chatbot Muyu (Gemini, nivel gratuito).",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, object]:
    """Indica si el backend está vivo y si la clave de Gemini está configurada."""
    return {
        "status": "ok",
        "gemini_key_configured": settings.has_api_key,
        "model": settings.gemini_model,
    }


class Msg(BaseModel):
    role: str  # "user" o "assistant"
    text: str


class ChatIn(BaseModel):
    message: str
    history: list[Msg] = []


@app.post("/chat")
def chat(body: ChatIn):
    contents = [
        types.Content(
            role="model" if m.role == "assistant" else "user",
            parts=[types.Part(text=m.text)],
        )
        for m in body.history[-10:]
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=body.message)]))
    config = types.GenerateContentConfig(system_instruction=SYSTEM)

    for model in MODELS:
        try:
            res = client.models.generate_content(
                model=model, contents=contents, config=config
            )
            raw = res.text or ""
            m = TAG.search(raw)
            emotion = m.group(1).lower() if m else "neutral"
            return {"text": TAG.sub("", raw).strip(), "emotion": emotion}
        except errors.APIError as e:
            if e.code != 429:  # solo reintenta con Flash-Lite si es cuota
                break
    return {"text": "Uy, algo falló. ¿Probamos otra vez?", "emotion": "error"}