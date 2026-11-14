# MUYU-Chatbot-Agrobyte

MUYU Chatbot Agrobyte: chatbot web con IA (Gemini, nivel gratuito) y Muyu, un personaje animado que reacciona a la conversación.

"Muyu" significa "semilla" en kichwa. En el pecho lleva la chakana, que representa el orden de la naturaleza.

## Estructura

```text
MUYU-Chatbot-Agrobyte/
├─ api/   # Backend: Python + FastAPI (guarda la clave de Gemini)
└─ web/   # Frontend: React + TypeScript + Vite
```

## Requisitos

- Python 3.11 o superior
- Node.js 20 o superior (LTS)
- Una clave gratuita de Gemini: https://aistudio.google.com → "Get API key"

## Cómo ejecutar (Windows, PowerShell)

### 1. Backend (terminal 1)

```powershell
cd api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # luego pega tu clave en GEMINI_API_KEY
python scripts\check_gemini.py
uvicorn main:app --reload --port 8000
```

Si PowerShell bloquea la activación del entorno, ejecuta una vez:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### 2. Frontend (terminal 2)

```powershell
cd web
npm install
copy .env.example .env
npm run dev
```

Abre http://localhost:5173. Debe decir "Backend conectado".

## Seguridad

- La clave de Gemini va solo en `api/.env`, que está en `.gitignore`.
- Nunca pongas la clave en el frontend ni la subas a GitHub.
