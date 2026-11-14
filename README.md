# MUYU-Chatbot-Agrobyte

MUYU Chatbot Agrobyte: chatbot web con IA (Gemini, nivel gratuito) y Muyu, un personaje animado que reacciona a la conversación.

"Muyu" significa "semilla" en kichwa. En el pecho lleva la chakana, que representa el orden de la naturaleza.

## Estructura

```text
MUYU-Chatbot-Agrobyte/
├─ api/                 # Backend antiguo (FastAPI), solo para pruebas locales
├─ netlify/functions/   # /api/chat: agente Gemini (guarda la clave)
└─ web/                 # Frontend: React + TypeScript + Vite
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

## Muyu en vivo con Gemini (K3)

`/api/chat` es una Netlify Function gratuita. Gemini decide qué dato consultar
(rotación, resumen del cantón o comparación ENSO) y la función lo calcula con
`paquete_canton.json`, el mismo motor del modo campo.

```powershell
copy .env.example .env      # en la raíz; pega tu clave en GEMINI_API_KEY
npx netlify-cli dev         # web + función en http://localhost:8888
```

Prueba rápida en otra terminal:

```powershell
$cuerpo = '{"pregunta":"¿Qué siembro después?","historial":[],"contexto":{"cantonId":"daule","cultivoPrevioId":"arroz","escenario":"neutro","mes":1}}'
Invoke-RestMethod -Method Post -Uri http://localhost:8888/api/chat -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($cuerpo))
```

Para publicar: conecta el repo en Netlify (plan gratis) y añade `GEMINI_API_KEY`
en Site configuration → Environment variables. `netlify.toml` ya trae la configuración.

## Seguridad

- La clave de Gemini va solo en `.env` (raíz o `api/`) y en Netlify; los `.env` están en `.gitignore`.
- Nunca pongas la clave en el frontend ni la subas a GitHub.
