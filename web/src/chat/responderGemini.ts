import type { Preferencias } from "./estilo";
import { conLimite } from "./limite";
import type { TemaConsulta } from "../knowledge/contextoConversacion";

import type { PeticionChat } from "../agent/peticion";
import type { MuyuContexto } from "../knowledge/contexto";
import type { ChatMessage, ChatReply, Sugerencia } from "./types";

export const RUTA_CHAT = "/api/chat";

// Un solo intento; el modo campo toma el relevo si el servicio no responde.
const TIEMPO_MAXIMO_MS = 25_000;

/**
 * Consulta al agente Gemini mediante el backend de Muyu.
 * Si falla, informa del motivo y permite activar el modo offline.
 */
export async function responderGemini(
  pregunta: string,
  historial: ChatMessage[],
  contexto: MuyuContexto,
  fetchImpl: typeof fetch = fetch,
  tema?: TemaConsulta,
  signal?: AbortSignal,
  preferencias?: Preferencias,
): Promise<ChatReply> {
  const cuerpo: PeticionChat = {
    pregunta,
    historial: historial.map(({ role, text }) => ({ role, text })),
    contexto,
    tema,
    preferencias,
  };

  const controlador = new AbortController();
  const cancelar = () => controlador.abort();
  signal?.addEventListener("abort", cancelar, { once: true });
  if (signal?.aborted) cancelar();
  if (typeof window !== "undefined") window.addEventListener("offline", cancelar);
  try {
    return await conLimite(async (signal) => {
      const respuesta = await fetchImpl(RUTA_CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal,
      });
      if (!respuesta.ok) throw new Error("No pude completar la consulta en línea.");
      const datos = await respuesta.json() as Partial<ChatReply>;
      if (typeof datos.text !== "string" || !datos.text.trim()) {
        throw new Error("No recibí una respuesta completa. ¿Intentamos otra vez?");
      }

      const sugerencias = Array.isArray(datos.sugerencias)
        ? datos.sugerencias
            .filter(
              (s): s is Sugerencia =>
                typeof s?.texto === "string",
            )
            .slice(0, 3)
        : undefined;

      return {
        text: datos.text.trim(),
        emotion: datos.emotion === "happy" ? "happy" : "neutral",
        sugerencias,
        evidencia: datos.evidencia,
      };
    }, TIEMPO_MAXIMO_MS, controlador.signal);
  } finally {
    signal?.removeEventListener("abort", cancelar);
    if (typeof window !== "undefined") window.removeEventListener("offline", cancelar);
  }
}
