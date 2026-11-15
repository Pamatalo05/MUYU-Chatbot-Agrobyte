# Publicar la corrección de integración Kallpa–Muyu

Esta guía no autoriza ni ejecuta merges o despliegues. Las ramas están preparadas para revisión; hace falta confirmar la publicación antes de continuar.

## Ramas que se deben revisar

- Muyu: `Pamatalo05/MUYU-Chatbot-Agrobyte`, rama `fix/verificacion-integracion-kallpa`. Incluye rutas Android corregidas, control de contexto incompatible, pruebas y la función CORS.
- Android: `Pamatalo05/Kallpa-AgroByte-2026`, rama `fix/verificacion-integracion-muyu`, commit `0112140036857eaa47af01228443fb8546dc386f`. Incluye los 18 recursos de Muyu que faltaban; no cambia los archivos científicos ni el código Java.

Los commits de Muyu incluyen `[skip netlify]` para que subir estas correcciones no genere un despliegue automático. No se han fusionado las ramas.

## Diagnóstico y corrección CORS

La comprobación pública de `OPTIONS /api/chat`, enviando el origen Android y solicitando POST con Content-Type, devolvió HTTP 405, cuerpo `{"error":"Usa POST"}` y ninguna cabecera Access-Control-Allow-*. Ese preflight no permite que WebView envíe el POST.

El código revisado de main ya contemplaba OPTIONS. Por tanto, el endpoint público observado no se comporta como esa revisión. Es compatible con una revisión anterior o una configuración de publicación distinta; no se puede determinar desde Git cuál es el repositorio y commit activos en la cuenta Netlify.

La función corregida:

- Conserva la ruta `/api/chat`.
- Responde 204 al preflight del origen HTTPS exacto `https://appassets.androidplatform.net`, antes de invocar al agente o leer su cuerpo.
- Permite POST con Content-Type; no usa comodines ni credenciales del navegador.
- Conserva POST desde la propia web y llamadas sin Origin.
- Rechaza orígenes ajenos, métodos de preflight o cabeceras no admitidos.
- Conserva CORS en respuestas de éxito y error; utiliza Vary: Origin y Cache-Control: no-store.
- HEAD sigue devolviendo 405 sin invocar Gemini, con las cabeceras necesarias para la comprobación de conectividad.

Referencia oficial del enrutamiento y métodos de funciones: https://docs.netlify.com/build/functions/configuration/

## 1. Revisar sin publicar

Abrir las comparaciones y revisar los cambios:

- https://github.com/Pamatalo05/MUYU-Chatbot-Agrobyte/compare/main...fix/verificacion-integracion-kallpa
- https://github.com/Pamatalo05/Kallpa-AgroByte-2026/compare/main...fix/verificacion-integracion-muyu

No fusionar todavía. Un merge a una rama conectada puede activar la publicación automática de Netlify; la marca del commit de la rama no garantiza que un commit de merge nuevo también omita el despliegue.

## 2. Verificar Netlify antes de autorizar producción

En el proyecto que sirve `https://muyu-agrobyte.netlify.app`, revisar Project configuration → Build & deploy → Continuous deployment:

- Repositorio conectado: debe contener la corrección. La rama preparada está en `Pamatalo05/MUYU-Chatbot-Agrobyte`; si el sitio apunta al fork `RitaParedesR`, habrá que cambiar la conexión o incorporar allí los cambios antes de desplegar. No basta con subirlos al repositorio original.
- Rama de producción prevista: `main`, después de aprobar la fusión de Muyu.
- Base directory: raíz del repositorio, sin `web` como base.
- Build command: `npm --prefix web ci && npm --prefix web run build`.
- Publish directory: `web/dist`.
- Functions directory: `netlify/functions`.
- Conservar `netlify.toml` en la raíz y comprobar que el build prepare la función `chat`.

Variables privadas del servidor:

- `GEMINI_API_KEY`: valor privado existente, disponible para las Functions en el contexto de producción. No copiarlo a Android, archivos rastreados ni variables `VITE_*`.
- `GEMINI_MODEL=gemini-3.5-flash-lite`.

El APK ya contiene la URL HTTPS pública correcta. `VITE_MUYU_API_BASE` es una URL pública opcional para compilar Android; no es una clave.

## 3. Publicar solo después de confirmar

Una vez autorizada expresamente la publicación:

1. Fusionar el PR de Muyu a `main`, conservando sus cambios existentes. No usar force push.
2. Desplegar desde ese commit de Git en el sitio Netlify existente. Si el sitio ya despliega automáticamente main, revisar ese despliegue; si no, usar Deploys → Trigger deploy. Si no actualiza los artefactos, reintentar con la caché de build vacía.
3. Confirmar en los detalles del despliegue el SHA publicado, la compilación del frontend y la función `chat` de la misma revisión. No subir únicamente `web/dist`: eso no publica esta corrección de la función.
4. Mantener la URL pública; no crear otro sitio ni cambiar la dirección que contiene el APK.
5. Comprobar el preflight de la siguiente sección antes de probar Gemini.
6. Fusionar también la rama Android cuando se apruebe. El APK de comprobación local ya contiene esos recursos; para distribución desde Git, generar el APK desde la revisión Android fusionada y seguir el proceso de firma que utilice el equipo.

## 4. Comprobar CORS publicado sin consumir Gemini

En PowerShell:

```powershell
curl.exe -i -X OPTIONS "https://muyu-agrobyte.netlify.app/api/chat" -H "Origin: https://appassets.androidplatform.net" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

Resultado esperado:

```text
HTTP 204
Access-Control-Allow-Origin: https://appassets.androidplatform.net
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Vary: Origin
```

Si continúa devolviendo 405 o faltan cabeceras, detener la prueba de integración: comprobar el commit y la función del despliegue activo, y que el sitio no siga apuntando a otro repositorio o a un despliegue antiguo. No es un problema que se resuelva colocando la clave en Android o deshabilitando CORS.

## 5. Pendientes en dispositivo real

Instalar el APK y comprobar, con una cuenta y parcela del proyecto:

- El botón flotante y «Preguntarle a Muyu» abren el chatbot completo dentro de Android.
- Para un cantón y cultivo compatibles, se aplican cantón, cultivo y mes de Kallpa. Cultivos desconocidos no se convierten en arroz y se muestra un aviso para revisar los selectores. Escenario, hectáreas y riego no se aplican automáticamente al contexto del agente.
- Funcionan teclado, envío, regreso a Kallpa y voz nativa. Se debe comprobar el motor TTS del dispositivo.
- Sin conexión, cargan los recursos y datos locales. Si se pierde Gemini, el aviso distingue el respaldo local de una respuesta en línea.
- Después de autorizar una prueba real, confirmar una consulta agrícola, herramientas utilizadas y datos de respaldo. No se ha realizado esa llamada real en esta entrega.

## Evidencia local

- 217 pruebas automatizadas aprobadas, incluidas 19 de la función CORS y las regresiones agrícolas.
- Build web correcto; empaquetado y ejecución local de OPTIONS/HEAD de la función correctos, sin llamadas a Gemini.
- Build Android correcto en la verificación anterior; testDebugUnitTest indicó NO-SOURCE, no pruebas unitarias Android ejecutadas.
- En navegador móvil con puente simulado: contexto Babahoyo–maíz duro–noviembre; ambos lectores reciben el JSON científico local; ahorro de urea y continuación Daule noviembre; enero 70,1 % y noviembre 49,9 %; parcela preservada. No equivale a una prueba en Android real.
- Seis JSON/GeoJSON científicos presentes en el APK, idénticos a los archivos de Kallpa; no se modificaron fórmulas ni fuentes.
- APK de comprobación: `C:\Users\ritap\Kallpa-AgroByte-2026\app\build\outputs\apk\debug\app-debug.apk`.
