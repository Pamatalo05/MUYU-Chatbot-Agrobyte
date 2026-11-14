import type { ChatMessage, ChatReply } from "./types";

/**
 * Respuestas de prueba mientras no está conectado el backend.
 * En el Bloque 6 se reemplaza por la llamada a POST /chat (misma firma).
 *
 * Para probar estados:
 *  - "hola", "gracias" o "genial" → respuesta feliz (Muyu saluda).
 *  - un mensaje que contenga "#error" → simula una falla (brote marchito).
 */
const MOCK_REPLIES = [
  "¡Qué buena pregunta! Déjame pensarlo con calma, como una semilla que crece.",
  "Me encanta conversar contigo. Pronto podré responderte con más detalle.",
  "Todavía estoy brotando, pero ya te escucho con atención.",
];

const HAPPY_WORDS = /\b(hola|gracias|genial|chévere|bien)\b/i;
const MOCK_DELAY_MS = 1200;

export function mockReply(message: string, _history: ChatMessage[]): Promise<ChatReply> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (message.includes("#error")) {
        reject(new Error("Error simulado"));
        return;
      }
      if (HAPPY_WORDS.test(message)) {
        resolve({ text: "¡Hola! Me alegra mucho verte por aquí. ¿Qué sembramos hoy?", emotion: "happy" });
        return;
      }
      const text = MOCK_REPLIES[message.length % MOCK_REPLIES.length];
      resolve({ text, emotion: "neutral" });
    }, MOCK_DELAY_MS);
  });
}
