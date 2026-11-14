export type ChatRole = "user" | "muyu";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

/** Emoción que acompaña cada respuesta (el backend la devuelve en el Bloque 2). */
export type ReplyEmotion = "happy" | "neutral";

export interface ChatReply {
  text: string;
  emotion: ReplyEmotion;
}

/** Momento de la conversación; de aquí se deduce el estado de Muyu. */
export type ChatPhase = "idle" | "thinking" | "speaking" | "happy" | "error";
