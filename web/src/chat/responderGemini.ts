import type { PeticionChat } from "../agent/peticion";
import type { MuyuContexto } from "../knowledge/contexto";
import type { ChatMessage, ChatReply, Sugerencia } from "./types";

/**
 * En la web, /api/chat es del mismo sitio. Dentro de Kallpa la página vive en el teléfono,
 * así que se usa la dirección completa del sitio en Netlify (VITE_MUYU_API_BASE en web/.env.kallpa).
 */
export const RUTA_CHAT = `${import.meta.env.VITE_MUYU_API_BASE ?? ""}/api/chat`;
const TIEMPO_MAXIMO_MS = 15_000;

/**
 * Pregunta a Muyu en vivo (Gemini, vía la Netlify Function). Lanza si no hay red,
 * si tarda demasiado o si el servidor falla: K4 usa eso para pasar a modo campo.
 */
export async function responderGemini(
  pregunta: string,
  historial: ChatMessage[],
  contexto: MuyuContexto,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatReply> {
  const cuerpo: PeticionChat = {
    pregunta,
    historial: historial.map(({ role, text }) => ({ role, text })),
    contexto,
  };
  const respuesta = await fetchImpl(RUTA_CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  const datos = (await respuesta.json().catch(() => ({}))) as Partial<ChatReply> & { error?: string };
  if (!respuesta.ok || typeof datos.text !== "string") {
    throw new Error(datos.error ?? `El servidor respondió ${respuesta.status}`);
  }
  // Solo se aceptan sugerencias con texto; la acción la recalcula el chat si hace falta.
  const sugerencias = Array.isArray(datos.sugerencias)
    ? datos.sugerencias.filter((s): s is Sugerencia => typeof s?.texto === "string").slice(0, 3)
    : undefined;
  return { text: datos.text, emotion: datos.emotion === "happy" ? "happy" : "neutral", sugerencias };
}
