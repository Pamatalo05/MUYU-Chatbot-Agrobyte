/** Preguntas que Muyu responde sin internet, con datos de paquete_canton.json. */
export type AccionRapida = "rotacion" | "enso" | "urea" | "resumen";

export interface PreguntaRapida {
  accion: AccionRapida;
  texto: string;
}

export const PREGUNTAS_RAPIDAS: readonly PreguntaRapida[] = [
  { accion: "rotacion", texto: "¿Qué siembro después?" },
  { accion: "enso", texto: "¿Cómo afecta El Niño o La Niña?" },
  { accion: "urea", texto: "¿Cuánto ahorro en urea?" },
  { accion: "resumen", texto: "Resumen de mi cantón" },
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
