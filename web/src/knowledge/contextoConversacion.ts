import { esPreguntaConceptual, responderPreguntaSencilla } from "../agent/guardarrailes";
import type { MuyuContexto } from "./contexto";

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const TEMAS = ["humedad_raiz", "humedad_superficial", "lluvia", "temperatura", "ndvi", "resumen", "rotacion", "urea", "enso", "riesgo"] as const;
export type TemaConsulta = typeof TEMAS[number];
export interface ContextoConversacion { contexto: MuyuContexto; tema: TemaConsulta }
export interface Consulta { contexto: MuyuContexto; tema?: TemaConsulta; error?: string }
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function detectarTema(texto: string): TemaConsulta | undefined {
  const s = normalizar(texto);
  const variables = [/humedad/, /lluvia|precipitacion|llover/, /temperatura/, /ndvi/].filter(p => p.test(s));
  if (variables.length > 1) return "resumen";
  if (/humedad/.test(s)) return /superficial|smap/.test(s) ? "humedad_superficial" : "humedad_raiz";
  if (/semaforo|riesgo|sequia|inundacion|seguro|germinacion|capacidad de campo/.test(s)) return "riesgo";
  if (/urea|fertiliz|nitrogeno|abono/.test(s)) return "urea";
  if (/rotacion|siembr|sembr|cultiv|cosech|margen|ganancia|costo|ingreso/.test(s)) return "rotacion";
  if (/lluvia|precipitacion|llover/.test(s)) return "lluvia";
  if (/temperatura|calor/.test(s)) return "temperatura";
  if (/ndvi|verdor/.test(s)) return "ndvi";
  if (/resumen|clima/.test(s)) return "resumen";
  if (/nino|nina|enso|neutro|ano normal/.test(s)) return "enso";
}

/** Pure shared resolver. Never writes to the parcel or infers context from assistant prose. */
export function resolverConsulta(pregunta: string, parcela: MuyuContexto, memoria?: ContextoConversacion | null, cantones: string[] = ["daule", "babahoyo"], temaAnterior?: TemaConsulta): Consulta {
  const texto = normalizar(pregunta);
  const volver = /mi parcela|mi canton|mi configuracion/.test(texto);
  const contexto = { ...(volver ? parcela : memoria?.contexto ?? parcela) };
  const explicacion = /^(?:[¿?¡! ]*)(?:explicame|explicamelo|por que|que significa eso|muestrame las fuentes|fuentes)/.test(texto);
  if (responderPreguntaSencilla(pregunta) || (esPreguntaConceptual(pregunta) && !/semaforo/.test(texto) && !(explicacion && (memoria?.tema || temaAnterior)))) return { contexto };
  const temaExplicito = detectarTema(pregunta);
  const continuacion = explicacion || /^\s*[¿?¡!]*\s*(y\b|en\b|para\b|ahora\b|lo mismo|tambien|compara)/.test(texto);
  const anterior = memoria?.tema ?? temaAnterior;
  const soloEscenario = temaExplicito === "enso" && continuacion && !/compar|afecta|diferencia/.test(texto);
  const tema = soloEscenario ? (anterior === "enso" ? "humedad_raiz" : anterior) ?? temaExplicito : temaExplicito ?? (continuacion || volver || MESES.some(m => texto.includes(m)) ? anterior : undefined);
  const consulta: Consulta = { contexto, tema };
  const meses = MESES.flatMap((mes, i) => new RegExp(`\\b${mes}\\b`).test(texto) ? [i + 1] : []);
  if (meses.length > 1) return { ...consulta, error: "Indica un solo mes por consulta; todavía no comparo varios meses a la vez." };
  if (meses.length) contexto.mes = meses[0];
  const lugares = cantones.filter(id => new RegExp(`\\b${normalizar(id)}\\b`).test(texto));
  if (lugares.length > 1) return { ...consulta, error: "Indica un solo cantón por consulta." };
  if (lugares.length) contexto.cantonId = lugares[0];
  // Unknown explicit places must not silently fall back to the selected parcel.
  const candidatos = [...texto.matchAll(/\b(?:en|para|canton(?: de)?)\s+([a-z]+)/g)].map(m => m[1]);
  const ignorar = new Set([...MESES, ...cantones.map(normalizar), "el", "la", "los", "las", "mi", "un", "una", "este", "ese", "enero", "noviembre", "sembrar", "cultivar", "neutro", "humedad", "raiz", "suelo", "porcentaje", "mm", "grados"]);
  if (candidatos.some(c => !ignorar.has(c))) return { ...consulta, error: "No reconozco el lugar o período solicitado. Indica un cantón disponible y un mes por nombre." };
  const nino = /\bnino\b/.test(texto), nina = /\bnina\b/.test(texto), neutro = /neutro|ano normal/.test(texto);
  if (neutro && (nino || nina)) return { ...consulta, error: "La comparación disponible es El Niño frente a La Niña. Consulta el escenario neutro por separado para no mezclar resultados." };
  if ([nino, nina, neutro].filter(Boolean).length > 1) {
    if (tema === "enso" || /compar|diferencia/.test(texto)) consulta.tema = "enso";
    else return { ...consulta, error: "Indica un escenario por consulta o pide una comparación de ENSO." };
  } else if (nino) contexto.escenario = "el_nino";
  else if (nina) contexto.escenario = "la_nina";
  else if (neutro) contexto.escenario = "neutro";
  const previo = texto.match(/(?:despues (?:de|del)|coseche|cosechado|cosechar)\s+(?:cosechar )?(?:el |la )?(arroz|maiz|soya|papa|haba|frejol)/);
  if (previo) contexto.cultivoPrevioId = previo[1];
  else if (/(?:despues (?:de|del)|coseche|cosechado|cosechar)\s+(?:el |la )?[a-z]+/.test(texto)) return { ...consulta, error: "No reconozco el cultivo previo solicitado. Indica un cultivo disponible en Tu parcela para no asumir otro." };
  if (/\b20\d{2}\b|hoy|ayer|tiempo real|actualmente|manana|esta semana|proxima semana/.test(texto)) return { ...consulta, error: "Tengo referencias de meses anteriores y estimaciones para cada escenario, no observaciones actuales ni pronósticos para una fecha concreta." };
  if (!consulta.tema && continuacion) return { ...consulta, error: "¿Qué variable agrícola quieres consultar? Puedes preguntar por humedad de raíz, lluvia o temperatura." };
  return consulta;
}

/** Session memory with revision checks: pending answers cannot undo selector edits. */
export class MemoriaConversacional {
  private revision = 0;
  private valor: ContextoConversacion | null = null;
  leer() { return this.valor ? { contexto: { ...this.valor.contexto }, tema: this.valor.tema } : null; }
  version() { return this.revision; }
  reiniciar() { this.revision++; this.valor = null; }
  aceptar(version: number, valor: ContextoConversacion) {
    if (version !== this.revision) return false;
    this.valor = { contexto: { ...valor.contexto }, tema: valor.tema };
    return true;
  }
}
