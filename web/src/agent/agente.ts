import type { ChatReply } from "../chat/types";
import { ESCENARIO_NOMBRE, type PaqueteCanton } from "../knowledge/types";
import { esFueraDeTema, esTemaVetado, pareceManipulacion, reglasDeAlcance, respuestaFueraDeTema } from "./guardarrailes";
import { declararHerramientas, ejecutarHerramienta } from "./herramientas";
import type { PeticionChat } from "./peticion";

/**
 * Modelos con plan gratis, en orden. Los alias "-latest" los mantiene Google apuntando
 * al Flash vigente, así un retiro de modelo (como el de 2.5 en octubre de 2026) no rompe
 * a Muyu. Si un modelo no existe (404) o está saturado (429/503), se prueba el siguiente.
 */
export const MODELOS_GEMINI = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"];
/** Errores en los que vale la pena probar otro modelo (no aplica a clave inválida). */
const PROBAR_OTRO_MODELO = new Set([404, 429, 503]);
const URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
/** Máximo de idas y vueltas con herramientas antes de rendirse. */
const MAX_TURNOS = 4;

interface Parte {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface Contenido {
  role: "user" | "model";
  parts: Parte[];
}

export class AgenteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgenteError";
  }
}

export interface OpcionesAgente {
  apiKey: string;
  paquete: PaqueteCanton;
  modelos?: string[];
  /** Se inyecta en las pruebas; en producción es el `fetch` global. */
  fetchImpl?: typeof fetch;
}

function instrucciones(paquete: PaqueteCanton, { contexto }: PeticionChat): string {
  const canton = paquete.cantones[contexto.cantonId]?.nombre ?? contexto.cantonId;
  const previo = paquete.cultivos.find((c) => c.id === contexto.cultivoPrevioId)?.nombre ?? contexto.cultivoPrevioId;
  return [
    "Eres Muyu, asistente agronómico de Kallpa para agricultores de Ecuador.",
    "Responde en español sencillo, cálido y respetuoso, en máximo 3 frases cortas, sin markdown; " +
      "pon cada idea en su propia línea y la cifra clave primero.",
    "Usa SOLO cifras que te devuelvan las herramientas; nunca inventes datos.",
    "Si algo no está en los datos, dilo con honestidad y sugiere qué sí puedes responder.",
    "Si el semáforo de una herramienta está en rojo, empieza avisando ese riesgo.",
    ...reglasDeAlcance(paquete),
    `Contexto del agricultor: cantón ${canton} (id ${contexto.cantonId}), acaba de cosechar ${previo}` +
      ` (id ${contexto.cultivoPrevioId}), escenario ${ESCENARIO_NOMBRE[contexto.escenario]}` +
      ` (id ${contexto.escenario}), mes ${contexto.mes}. Úsalo si la pregunta no dice otra cosa.`,
  ].join("\n");
}

/** Llama a Gemini probando cada modelo; solo cambia de modelo si está saturado. */
async function generar(cuerpo: unknown, { apiKey, modelos = MODELOS_GEMINI, fetchImpl = fetch }: OpcionesAgente) {
  let ultimoError = "sin modelos";
  for (const modelo of modelos) {
    const respuesta = await fetchImpl(`${URL_GEMINI}/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(cuerpo),
    });
    if (respuesta.ok) return (await respuesta.json()) as { candidates?: { content?: Contenido }[] };
    // El motivo de Google ayuda a diagnosticar (va al log del servidor, nunca al usuario).
    const motivo = await respuesta.text().then((t) => t.slice(0, 200)).catch(() => "");
    ultimoError = `${modelo} respondió ${respuesta.status} ${motivo}`.trim();
    if (!PROBAR_OTRO_MODELO.has(respuesta.status)) break;
  }
  throw new AgenteError(ultimoError);
}

/**
 * Agente de Muyu: Gemini decide qué herramienta usar, nosotros la ejecutamos con los
 * datos del paquete y Gemini redacta la respuesta final con esas cifras.
 */
export async function conversar(peticion: PeticionChat, opciones: OpcionesAgente): Promise<ChatReply> {
  const { paquete } = opciones;
  if (pareceManipulacion(peticion.pregunta) || esTemaVetado(peticion.pregunta)) {
    return respuestaFueraDeTema(peticion.pregunta);
  }

  const contents: Contenido[] = [
    ...peticion.historial.map(
      (m): Contenido => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }),
    ),
    { role: "user", parts: [{ text: peticion.pregunta }] },
  ];
  const base = {
    systemInstruction: { parts: [{ text: instrucciones(paquete, peticion) }] },
    tools: [{ functionDeclarations: declararHerramientas(paquete) }],
    // Sin thinkingConfig: cada familia de Gemini acepta opciones distintas y una inválida da 400.
    // El margen de tokens cubre el razonamiento interno; las instrucciones piden 3 frases.
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };
  let recomendo = false;

  for (let turno = 0; turno < MAX_TURNOS; turno++) {
    const datos = await generar({ ...base, contents }, opciones);
    const contenido = datos.candidates?.[0]?.content;
    const partes = contenido?.parts ?? [];
    const llamadas = partes.flatMap((p) => (p.functionCall ? [p.functionCall] : []));

    if (llamadas.length === 0) {
      const text = partes.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new AgenteError("Gemini no devolvió texto");
      if (esFueraDeTema(text)) return respuestaFueraDeTema(peticion.pregunta);
      return { text, emotion: recomendo ? "happy" : "neutral" };
    }

    contents.push({ role: "model", parts: partes });
    contents.push({
      role: "user",
      parts: llamadas.map(({ name, args = {} }) => {
        const response = ejecutarHerramienta(paquete, name, args);
        const recomendaciones = response.recomendaciones;
        if (name === "recomendar_rotacion" && Array.isArray(recomendaciones) && recomendaciones.length > 0) {
          recomendo = true;
        }
        return { functionResponse: { name, response } };
      }),
    });
  }
  throw new AgenteError("Demasiadas llamadas a herramientas");
}
