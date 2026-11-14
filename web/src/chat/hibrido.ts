import type { AccionRapida } from "./preguntasRapidas";
import type { ChatReply } from "./types";

/** "en_vivo" = Gemini por /api/chat; "campo" = motor local con paquete_canton.json. */
export type ModoConexion = "en_vivo" | "campo";

/** Tras un fallo de Gemini, cuánto tiempo responder en modo campo antes de reintentar. */
export const PAUSA_TRAS_FALLO_MS = 60_000;

export const AVISO_RESPALDO = "No pude conectarme, así que te respondo en modo campo: ";

interface Situacion {
  enLinea: boolean;
  /** Los botones siempre van al modo campo: son instantáneos y no gastan cuota. */
  accion?: AccionRapida;
  ultimoFalloMs: number | null;
  ahoraMs: number;
}

export function elegirModo({ enLinea, accion, ultimoFalloMs, ahoraMs }: Situacion): ModoConexion {
  if (!enLinea || accion) return "campo";
  if (ultimoFalloMs !== null && ahoraMs - ultimoFalloMs < PAUSA_TRAS_FALLO_MS) return "campo";
  return "en_vivo";
}

export interface ResultadoHibrido {
  reply: ChatReply;
  /** Modo que realmente respondió. */
  modo: ModoConexion;
  /** true si se intentó en vivo y falló. */
  fallo: boolean;
}

/** Responde en el modo elegido; si "en vivo" falla, cae al modo campo sin mostrar error. */
export async function responderHibrido(
  modo: ModoConexion,
  enVivo: () => Promise<ChatReply>,
  campo: () => ChatReply,
): Promise<ResultadoHibrido> {
  if (modo === "campo") return { reply: campo(), modo, fallo: false };
  try {
    return { reply: await enVivo(), modo, fallo: false };
  } catch {
    const reply = campo();
    return { reply: { ...reply, text: AVISO_RESPALDO + reply.text }, modo: "campo", fallo: true };
  }
}
