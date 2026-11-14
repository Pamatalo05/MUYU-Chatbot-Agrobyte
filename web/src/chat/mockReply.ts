/**
 * Respuestas de prueba mientras no está conectado el backend.
 * Se reemplaza por la llamada a POST /chat en el Bloque 6.
 */
const MOCK_REPLIES = [
  "¡Qué buena pregunta! Déjame pensarlo con calma, como una semilla que crece.",
  "Me encanta conversar contigo. Pronto podré responderte con más detalle.",
  "Todavía estoy brotando, pero ya te escucho con atención.",
];

const MOCK_DELAY_MS = 1200;

export function mockReply(message: string): Promise<string> {
  const index = message.length % MOCK_REPLIES.length;
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_REPLIES[index]), MOCK_DELAY_MS);
  });
}
