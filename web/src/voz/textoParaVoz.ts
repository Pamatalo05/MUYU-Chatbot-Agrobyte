/**
 * Prepara las respuestas de Muyu para leerlas en voz alta: sin emojis y con las
 * unidades dichas como las diría una persona ("USD/ha" → "dólares por hectárea").
 */

const REEMPLAZOS: [RegExp, string][] = [
  [/USD\/ha/g, "dólares por hectárea"],
  [/\bUSD\b/g, "dólares"],
  [/(\d)\s*°C/g, "$1 grados"],
  [/(\d)\s*mm\b/g, "$1 milímetros"],
  [/(\d)\s*m\b(?!\w)/g, "$1 metros"],
  [/(\d)\s*%/g, "$1 por ciento"],
  [/\s*\(NDVI\)/g, ""],
  [/\bNDVI\b/g, "índice de verdor"],
  // Solo tras un número: "ha" también es un verbo ("la lluvia ha bajado").
  [/(\d)\s*ha\b/g, "$1 hectáreas"],
  [/\s\/\s/g, " o "],
  [/[·•]/g, ","],
];

/** Emojis y símbolos gráficos (incluye selectores de variación y uniones). */
const EMOJIS = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

export function textoParaVoz(texto: string): string {
  let limpio = texto.replace(EMOJIS, "");
  for (const [patron, reemplazo] of REEMPLAZOS) limpio = limpio.replace(patron, reemplazo);
  return limpio
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean)
    // Cada línea es una idea: se separa con punto para que la voz haga una pausa.
    .map((linea) => (/[.:!?¿¡]$/.test(linea) ? linea : `${linea}.`))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Parte el texto en frases cortas: algunos navegadores cortan la voz pasados
 * ~15 segundos, y así además se puede detener entre frases.
 */
export function partirEnFrases(texto: string, maximo = 180): string[] {
  const frases = texto.match(/[^.!?]+[.!?]*/g)?.map((f) => f.trim()).filter(Boolean) ?? [];
  const resultado: string[] = [];
  for (const frase of frases) {
    const ultima = resultado[resultado.length - 1];
    if (ultima && ultima.length + frase.length + 1 <= maximo) resultado[resultado.length - 1] = `${ultima} ${frase}`;
    else resultado.push(frase);
  }
  return resultado;
}

interface VozDisponible {
  lang: string;
  localService: boolean;
}

/** Orden de preferencia: español de Ecuador, luego latinoamericano, luego cualquier español. */
const PREFERENCIA = ["es-EC", "es-419", "es-US", "es-MX", "es-CO", "es-PE"];

export function elegirVoz<V extends VozDisponible>(voces: readonly V[]): V | null {
  const espanol = voces.filter((v) => v.lang.toLowerCase().startsWith("es"));
  if (espanol.length === 0) return null;
  const puntaje = (v: V) => {
    const indice = PREFERENCIA.findIndex((p) => p.toLowerCase() === v.lang.replace("_", "-").toLowerCase());
    // Las voces locales funcionan sin internet: se prefieren a igual idioma.
    return (indice === -1 ? PREFERENCIA.length : indice) * 2 + (v.localService ? 0 : 1);
  };
  return [...espanol].sort((a, b) => puntaje(a) - puntaje(b))[0];
}
