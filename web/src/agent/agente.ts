import type { ChatReply } from "../chat/types";
import { ESCENARIO_NOMBRE, type PaqueteCanton } from "../knowledge/types";
import { declararHerramientas, ejecutarHerramienta } from "./herramientas";
import type { PeticionChat } from "./peticion";

/** Modelos gratis, en orden: si uno está saturado (429/503) se usa el siguiente. */
export const MODELOS_GEMINI = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
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
    "Responde en español sencillo, en máximo 3 frases, sin markdown.",
    "Usa SOLO cifras que te devuelvan las herramientas; nunca inventes datos.",
    "Si algo no está en los datos, dilo con honestidad y sugiere qué sí puedes responder.",
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
    ultimoError = `${modelo} respondió ${respuesta.status}`;
    if (respuesta.status !== 429 && respuesta.status !== 503) break;
  }
  throw new AgenteError(ultimoError);
}

/**
 * Agente de Muyu: Gemini decide qué herramienta usar, nosotros la ejecutamos con los
 * datos del paquete y Gemini redacta la respuesta final con esas cifras.
 */
export async function conversar(peticion: PeticionChat, opciones: OpcionesAgente): Promise<ChatReply> {
  const { paquete } = opciones;
  const contents: Contenido[] = [
    ...peticion.historial.map(
      (m): Contenido => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }),
    ),
    { role: "user", parts: [{ text: peticion.pregunta }] },
  ];
  const base = {
    systemInstruction: { parts: [{ text: instrucciones(paquete, peticion) }] },
    tools: [{ functionDeclarations: declararHerramientas(paquete) }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
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
