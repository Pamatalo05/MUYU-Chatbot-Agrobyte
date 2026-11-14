import type { AccionRapida } from "./preguntasRapidas";

export type ChatRole = "user" | "muyu";

/** Pregunta que Muyu ofrece como botón (p. ej. cuando algo está fuera de tema). */
export interface Sugerencia {
  texto: string;
  accion?: AccionRapida;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Botones que aparecen debajo de la respuesta de Muyu. */
  sugerencias?: Sugerencia[];
}

/** Emoción que acompaña cada respuesta (el backend la devuelve en el Bloque 2). */
export type ReplyEmotion = "happy" | "neutral";

export interface ChatReply {
  text: string;
  emotion: ReplyEmotion;
  sugerencias?: Sugerencia[];
}

/** Momento de la conversación; de aquí se deduce el estado de Muyu. */
export type ChatPhase = "idle" | "thinking" | "speaking" | "happy" | "error";

/** Quién responde: modo campo (K2) o Gemini (K3); K4 elige entre los dos. */
export type Responder = (
  pregunta: string,
  historial: ChatMessage[],
  accion?: AccionRapida,
) => Promise<ChatReply>;
