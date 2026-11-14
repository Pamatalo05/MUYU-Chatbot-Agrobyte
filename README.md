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
cd web; npm run dev         # http://localhost:5173 ya sirve /api/chat con Gemini
```

Si la terminal dice "Falta GEMINI_API_KEY", revisa el `.env` de la raíz y reinicia `npm run dev`.
`npx netlify-cli dev` (puerto 8888) también funciona y simula Netlify tal cual.

**Guardrails:** Muyu solo responde sobre agricultura en Kallpa (rotación, clima, ENSO,
urea, costos). Otras preguntas o intentos de cambiarle el rol reciben un mensaje fijo
(`web/src/agent/guardarrailes.ts`).

Prueba rápida en otra terminal:

```powershell
$cuerpo = '{"pregunta":"¿Qué siembro después?","historial":[],"contexto":{"cantonId":"daule","cultivoPrevioId":"arroz","escenario":"neutro","mes":1}}'
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/chat -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($cuerpo))
```

Para publicar: conecta el repo en Netlify (plan gratis) y añade `GEMINI_API_KEY`
en Site configuration → Environment variables. `netlify.toml` ya trae la configuración.

## Datos (repo Kallpa)

La fuente única es `Kallpa-AgroByte-2026/datos/procesados/paquete_canton.json`.
Cuando el equipo de datos lo regenere, cópialo y verifica:

```powershell
cd web
npm run datos          # o: npm run datos -- C:\ruta\Kallpa-AgroByte-2026
npm test
```

Muyu usa el paquete tal cual lo publica Kallpa (hoy: Daule y Babahoyo, 4 cultivos):
- **Cantones:** salen de `cantones`; si el equipo agrega uno, aparece solo en Muyu.
- **Rotación:** el orden de `top_rotaciones_por_enso`, el mismo que muestra la app.
- **Riesgo (semáforo):** humedad en raíz predicha por el modelo para los próximos 3 meses;
  umbrales en `web/src/knowledge/semaforo.ts` (`UMBRALES_HUMEDAD`).
- **Urea:** kg del paquete convertidos a sacos y USD con el precio de `fuentes_metodologia`.
- `top_rotaciones_ml` se ignora: repite el escenario neutro.

## Seguridad

- La clave de Gemini va solo en `.env` (raíz o `api/`) y en Netlify; los `.env` están en `.gitignore`.
- Nunca pongas la clave en el frontend ni la subas a GitHub.
