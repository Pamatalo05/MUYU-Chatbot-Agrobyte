/** Preguntas que Muyu responde sin internet, con datos de paquete_canton.json. */
export type AccionRapida = "rotacion" | "enso" | "urea" | "resumen";

export interface PreguntaRapida {
  accion: AccionRapida;
  /** Lo que se envía y aparece en el chat. */
  texto: string;
  /** Texto corto del botón; el icono es decorativo. */
  etiqueta: string;
  icono: string;
}

export const PREGUNTAS_RAPIDAS: readonly PreguntaRapida[] = [
  { accion: "rotacion", texto: "¿Qué siembro después?", etiqueta: "¿Qué siembro?", icono: "🌱" },
  { accion: "enso", texto: "¿Cómo afecta El Niño o La Niña?", etiqueta: "El Niño y La Niña", icono: "🌦️" },
  { accion: "urea", texto: "¿Cuánto ahorro en urea?", etiqueta: "Ahorro en urea", icono: "💰" },
  { accion: "resumen", texto: "Resumen de mi cantón", etiqueta: "Clima de mi cantón", icono: "📍" },
];

/** Palabras clave para entender preguntas escritas, en orden de prioridad. */
const PALABRAS_CLAVE: readonly [AccionRapida, RegExp][] = [
  ["urea", /\b(urea|ahorr\w*|nitr[oó]geno|fertiliz\w*|abono)\b/i],
  ["enso", /\b(ni[ñn]o|ni[ñn]a|enso|fen[oó]meno|escenario)\b/i],
  ["rotacion", /\b(rota\w*|siembr\w*|sembr\w*|cultiv\w*|planto|plantar|despu[eé]s)\b/i],
  ["resumen", /\b(lluvia|humedad|temperatura|calor|clima|suelo|resumen|cant[oó]n|ndvi|rendimiento)\b/i],
];

/** Detecta de qué trata una pregunta escrita; null si no la reconoce. */
export function detectarAccion(pregunta: string): AccionRapida | null {
  const encontrada = PALABRAS_CLAVE.find(([, patron]) => patron.test(pregunta));
  return encontrada ? encontrada[0] : null;
}
