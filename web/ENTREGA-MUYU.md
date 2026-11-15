# Entrega local de mejoras de Muyu

Rama: `feat/muyu-experiencia-agricultor`. Base local: `c901749`.
Se conservaron las seis modificaciones previas para definiciones, saludos y fecha. No se reinició el trabajo. El commit exacto que sirve Netlify no se pudo comprobar desde el repositorio local.

## Implementado

- Definiciones directas de urea, mucuna, humedad del suelo y NDVI, sin recomendaciones no solicitadas. Saludos y fecha del reloj en Ecuador.
- Respuestas de respaldo más breves, con cifras y unidades verificadas. Procedencia, período y tipo de resultado conservados en evidencia; fuentes desplegables o a petición.
- Continuaciones conceptuales acotadas, incluido urea → «¿Y eso sirve para el arroz?». Continuaciones agrícolas para explicaciones, fuentes, mes y cantón, con la memoria y sus revisiones existentes.
- Dos o tres sugerencias pertinentes, usando los botones existentes.
- Preferencias de explicación y extensión, guardadas localmente cuando el navegador lo permite. No contienen datos personales ni alteran los valores agrícolas. Campo opcional de petición compatible con clientes anteriores.
- Semáforo con explicación sencilla, dos comprobaciones según el factor evaluado y consulta a Muyu sobre la parcela seleccionada. Se conservan íntegros cálculos y umbrales. No se presenta como evaluación completa de siembra.
- Reintento manual, sin solicitud automática adicional ni duplicación de la pregunta. Cancelación al desmontar o perder conexión; respuestas tardías descartadas.

## Causas de bloqueo y correcciones

La espera anterior dependía de `AbortSignal.timeout`, no imponía por sí sola un límite a toda la promesa de lectura, y permitía hasta cuatro turnos sucesivos sin presupuesto global. Se añadieron plazos que abarcan conexión y cuerpo: 10 segundos por llamada de proveedor, 20 segundos para los turnos del agente, 25 segundos de transporte web y 30 segundos como protección final del chat. Los modelos configurados duplicados ya no producen intentos repetidos.

El bloqueo de envíos dependía del estado de React, que todavía podía estar desactualizado entre dos llamadas síncronas. Ahora existe un bloqueo inmediato mediante referencia. Al cancelar la escritura se resuelve su promesa pendiente, sin actualizaciones posteriores al desmontaje.

## Ejemplos

- Antes: «¿Qué es la urea?» podía activar recomendaciones de mucuna. Ahora explica que la urea aporta nitrógeno y qué significa para el crecimiento de las plantas.
- Antes: «Indicador orientativo… reglas del paquete original». Ahora explica si los factores evaluados son favorables o requieren precaución, sin afirmar que la parcela esté seca o inundada.
- Humedad de raíz en Daule, enero, El Niño: **70,1 %**; continuación noviembre: **49,9 %**. Se mantiene que son cálculos de referencia, no mediciones actuales.

## Archivos

- `src/App.tsx`
- `src/agent/agente.ts`, `agente.test.ts`, `guardarrailes.ts`, `peticion.ts`, `plazos.test.ts`
- `src/chat/ChatPanel.tsx`, `ChatPanel.css`, `responderGemini.ts`, `responderGemini.test.ts`, `respuestaOffline.ts`, `respuestaOffline.test.ts`, `types.ts`, `useChat.ts`, `useChat.test.ts`, `estilo.ts`, `estilo.test.ts`, `limite.ts`
- `src/kallpa/SemaforoRiesgo.tsx`, `SemaforoRiesgo.css`, `explicarSemaforo.ts`, `explicarSemaforo.test.ts`
- `src/knowledge/consultaAgricola.ts`, `consultaAgricola.test.ts`, `contextoConversacion.ts`
- Este documento.

No se modificaron Android, datos científicos, modelos, cálculos, umbrales, dependencias, rutas REST, configuración de Netlify ni URL pública. La caché preexistente `Microsoft/` permanece excluida del trabajo.

## Verificaciones y límites

- Pruebas automatizadas: 176 aprobadas en 19 archivos; cubren validaciones científicas, firmas de pensamiento y respuestas de herramientas, fuentes, preferencias, tiempos límite, cancelación y reintento.
- Build: TypeScript y Vite correctos.
- Chrome real en modo headless, pantalla 390 × 844, servidor estático local y modo sin conexión: definición, continuación urea/arroz, enero/noviembre, persistencia de preferencias, ausencia de desbordamiento y de excepciones JavaScript.
- Cero llamadas reales a Gemini. Las pruebas del proveedor son simuladas.
- Android permanece limpio en su commit local `f8d4403`; falta probar los nuevos controles, teclado, voz y navegación en un dispositivo WebView real. No se afirma funcionamiento offline de una primera carga en Android.
- Las referencias conceptuales locales reconocen los conceptos documentados; no constituyen una memoria semántica ilimitada. Para otros conceptos, Gemini puede explicar en línea; sin datos suficientes, el modo campo reconoce la limitación.
- El semáforo sigue teniendo alcance parcial. No se añadieron mediciones ni datos para evaluar integralmente una siembra.
- El semáforo nativo de Android requeriría una tarea posterior autorizada; esta entrega modifica solamente la página mostrada en WebView.

## Publicación posterior, solo con autorización

1. Revisar el diff de esta rama y seleccionar exclusivamente estos archivos y el documento, excluyendo `Microsoft/`, `.env` y secretos. Crear commit y subir la rama solo después de autorización.
2. Revisar en Netlify la rama de producción y el despliegue automático antes de hacer push o merge: un push a una rama conectada podría publicar automáticamente.
3. Conservar el sitio existente y su dirección `https://muyu-agrobyte.netlify.app`. Mantener la configuración actual: comando `npm --prefix web ci && npm --prefix web run build`, publicación `web/dist`, funciones `netlify/functions`.
4. Conservar `GEMINI_API_KEY` únicamente como variable privada del backend y `GEMINI_MODEL=gemini-3.5-flash-lite`. No usar prefijo público `VITE_` para la clave. Publicar frontend y función desde la misma revisión para que las preferencias opcionales se apliquen en ambos modos.
5. Tras aprobar la publicación, comprobar el sitio y después el APK existente, que seguirá abriendo la misma URL. Una prueba real de Gemini requiere autorización adicional.

No se ejecutaron commit, push, merge ni despliegue.
