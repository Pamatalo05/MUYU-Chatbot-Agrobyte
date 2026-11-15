import type { TemaConsulta } from "../knowledge/contextoConversacion";

import type { PeticionChat } from "../agent/peticion";
import type { MuyuContexto } from "../knowledge/contexto";
import type { ChatMessage, ChatReply, Sugerencia } from "./types";

export const RUTA_CHAT = "/api/chat";

// Temporalmente esperamos hasta 60 segundos para diagnosticar Gemini.
const TIEMPO_MAXIMO_MS = 60_000;

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
): Promise<ChatReply> {
  const cuerpo: PeticionChat = {
    pregunta,
    historial: historial.map(({ role, text }) => ({ role, text })),
    contexto,
    tema,
  };

  let respuesta: Response;

  try {
    respuesta = await fetchImpl(RUTA_CHAT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch (error) {
    console.error("[Muyu] Error de conexión con Gemini:", error);

    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new Error(
        "Gemini tardó más de 60 segundos en responder.",
      );
    }

    throw new Error(
      "No se pudo completar la conexión con el servidor de Muyu.",
    );
  }

  const datos = (await respuesta.json().catch(() => ({}))) as
    Partial<ChatReply> & { error?: string };

  if (!respuesta.ok) {
    const mensaje =
      datos.error ?? `El servidor respondió HTTP ${respuesta.status}`;

    console.error("[Muyu] Error del backend:", {
      status: respuesta.status,
      mensaje,
    });

    throw new Error(mensaje);
  }

  if (typeof datos.text !== "string") {
    console.error("[Muyu] Respuesta inválida:", datos);
    throw new Error("Gemini devolvió una respuesta sin texto.");
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
    text: datos.text,
    emotion: datos.emotion === "happy" ? "happy" : "neutral",
    sugerencias,
    evidencia: datos.evidencia,
  };
}
