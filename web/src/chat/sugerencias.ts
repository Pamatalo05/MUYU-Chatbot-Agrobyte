import type { AccionRapida } from "./preguntasRapidas";
import type { Sugerencia } from "./types";

/**
 * Preguntas sugeridas cuando Muyu no puede responder algo (fuera de tema o sin
 * internet). Salen de la skill "preguntas-agricultores-muyu", con el lenguaje del
 * agricultor, y todas tienen respuesta con datos del paquete, incluso sin internet.
 */
interface PreguntaCatalogo extends Sugerencia {
  accion: AccionRapida;
  /** Raíces de palabras (sin tildes) que acercan una pregunta a esta sugerencia. */
  raices: string[];
}

export const CATALOGO: readonly PreguntaCatalogo[] = [
  {
    texto: "¿Qué siembro después de mi cosecha?",
    accion: "rotacion",
    raices: ["siembr", "sembr", "cultiv", "cosech", "rotac", "plant", "semill", "lote", "terren", "finca", "chacra"],
  },
  {
    texto: "¿Cómo me afecta El Niño o La Niña?",
    accion: "enso",
    raices: ["nino", "nina", "fenomen", "lluv", "llue", "llov", "inund", "aguachin", "invierno", "sequi", "tiempo", "desastre"],
  },
  {
    texto: "¿Qué cultivo me deja más plata?",
    accion: "rotacion",
    raices: ["plata", "diner", "gan", "margen", "rentab", "precio", "vend", "negoci", "econom", "cost", "pag", "quintal", "trabaj"],
  },
  {
    texto: "¿Cuánto ahorro en urea?",
    accion: "urea",
    raices: ["urea", "abon", "fertiliz", "nitrog", "suelo", "tierra", "cansad", "quimic", "ahorr"],
  },
  {
    texto: "¿Cómo está el clima de mi cantón este mes?",
    accion: "resumen",
    raices: ["clima", "temperat", "calor", "frio", "humed", "verano", "mes", "canton", "zona", "sol", "verdor"],
  },
];

/** Si nada se parece, se ofrecen las más útiles (las más preguntadas). */
const POR_DEFECTO = [0, 1, 2];

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .match(/[a-zñ]+/g) ?? [];

/** Las `cantidad` preguntas del catálogo más parecidas a lo que escribió el agricultor. */
export function sugerirPreguntas(pregunta: string, cantidad = 3): Sugerencia[] {
  const palabras = normalizar(pregunta);
  const puntaje = (p: PreguntaCatalogo) =>
    p.raices.filter((raiz) => palabras.some((palabra) => palabra.startsWith(raiz))).length;

  const parecidas = CATALOGO.map((p, i) => ({ i, puntos: puntaje(p) }))
    .filter((p) => p.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.i - b.i)
    .map((p) => p.i);

  const elegidas = [...new Set([...parecidas, ...POR_DEFECTO, ...CATALOGO.keys()])].slice(0, cantidad);
  return elegidas.map((i) => ({ texto: CATALOGO[i].texto, accion: CATALOGO[i].accion }));
}
