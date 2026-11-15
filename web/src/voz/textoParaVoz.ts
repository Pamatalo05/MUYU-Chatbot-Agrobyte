/**
 * Prepara las respuestas de Muyu para leerlas en voz alta: sin emojis y con las
 * unidades dichas como las diría una persona ("USD/ha" → "dólares por hectárea").
 */

const REEMPLAZOS: [RegExp, string][] = [
  // "1.450" se lee como decimal en algunas voces: se quita el punto de miles.
  [/(\d)\.(\d{3})(?!\d)/g, "$1$2"],
  [/\+\s?(\d)/g, "más $1"],
  [/(^|[\s(])[-−]\s?(\d)/g, "$1menos $2"],
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
    // Una exclamación va sola: así conserva su entonación alegre.
    const unir = ultima && !/!$/.test(ultima) && !/!$/.test(frase) && ultima.length + frase.length + 1 <= maximo;
    if (unir) resultado[resultado.length - 1] = `${ultima} ${frase}`;
    else resultado.push(frase);
  }
  return resultado;
}

export interface VozDisponible {
  lang: string;
  localService: boolean;
  name?: string;
}

/** Español de Ecuador primero, luego latinoamericano; el de España al final. */
const LATINO = ["es-419", "es-us", "es-mx", "es-co", "es-pe", "es-cl", "es-ar", "es-ve"];
/** Voces femeninas conocidas (Edge, Windows, macOS, Google): suenan más tiernas para Muyu. */
const FEMENINAS = /\b(andrea|dalia|elena|paloma|paulina|sabina|helena|laura|m[oó]nica|camila|valentina|ximena|marisol|elvira|larissa|salom[eé]|lupe|catalina|renata|soledad|elsa|sof[ií]a|beatriz|luc[ií]a)\b/i;
const MASCULINAS = /\b(luis|jorge|pablo|ra[uú]l|[aá]lvaro|gonzalo|diego|jos[eé]|carlos|emilio|tom[aá]s|juan|andr[eé]s|gerardo|alonso)\b/i;
/** Voces neuronales de Edge ("... Online (Natural)"): las más naturales, pero necesitan internet. */
const NEURONAL = /(natural|neural|online)/i;

/**
 * Ordena las voces en español de la mejor a la peor para Muyu (menor puntaje = mejor):
 * idioma latino, calidad natural, voz femenina y que funcione con o sin internet.
 */
export function ordenarVoces<V extends VozDisponible>(voces: readonly V[], enLinea = true): V[] {
  const puntaje = (v: V) => {
    const lang = v.lang.replace("_", "-").toLowerCase();
    const nombre = v.name ?? "";
    let p = lang === "es-ec" ? 0 : LATINO.includes(lang) ? 1 : 3;
    if (NEURONAL.test(nombre)) p += enLinea ? -2 : 10; // sin internet no sirven
    else if (/google/i.test(nombre)) p += enLinea ? -1 : 10;
    if (FEMENINAS.test(nombre)) p -= 1.5;
    if (MASCULINAS.test(nombre)) p += 1;
    if (!v.localService) p += enLinea ? 0.1 : 10;
    return p;
  };
  return voces
    .filter((v) => v.lang.toLowerCase().startsWith("es"))
    .map((v) => ({ v, p: puntaje(v) }))
    .sort((a, b) => a.p - b.p)
    .map(({ v }) => v);
}

export function elegirVoz<V extends VozDisponible>(voces: readonly V[], enLinea = true): V | null {
  return ordenarVoces(voces, enLinea)[0] ?? null;
}

/**
 * Entonación de Muyu: tono algo más agudo y dulce, alegre en las exclamaciones,
 * curioso en las preguntas y calmado cuando avisa un riesgo.
 */
export function prosodia(frase: string, neuronal: boolean): { pitch: number; rate: number } {
  // Las voces neuronales ya son expresivas: se sube menos el tono para que no suene forzado.
  const base = neuronal ? 1.15 : 1.3;
  if (/^cuidado/i.test(frase)) return { pitch: base - 0.2, rate: 0.9 };
  if (/!\s*$/.test(frase)) return { pitch: base + 0.12, rate: 1.02 };
  if (/\?\s*$/.test(frase)) return { pitch: base + 0.06, rate: 0.97 };
  return { pitch: base, rate: 0.96 };
}

export const esNeuronal = (v: VozDisponible) => NEURONAL.test(v.name ?? "") || /google/i.test(v.name ?? "");
