"""Prueba rápida de la clave de Gemini.

Uso (desde la carpeta api, con el entorno activado):
    python scripts\\check_gemini.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from google import genai  # noqa: E402

from config import settings  # noqa: E402


def main() -> int:
    if not settings.has_api_key:
        print("Falta GEMINI_API_KEY en api/.env")
        return 1

    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents="Saluda en una frase corta como Muyu, una semilla curiosa.",
        )
    except Exception as error:  # Mostrar cualquier error de forma legible
        print(f"Error al llamar a Gemini: {error}")
        return 1

    print(f"Gemini responde ({settings.gemini_model}): {response.text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
