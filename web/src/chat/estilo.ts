import type { ChatReply } from "./types";
export interface Preferencias { nivel: "sencillo" | "normal" | "tecnico"; longitud: "breve" | "detallada" }
export const ESTILO_INICIAL: Preferencias = { nivel: "sencillo", longitud: "breve" };
export function validarPreferencias(valor: unknown): Preferencias {
  const p = valor as Partial<Preferencias> | null;
  return { nivel: p && ["sencillo", "normal", "tecnico"].includes(p.nivel ?? "") ? p.nivel! : "sencillo",
    longitud: p?.longitud === "detallada" ? "detallada" : "breve" };
}
export function leerPreferencias(): Preferencias {
  try { return validarPreferencias(JSON.parse(localStorage.getItem("muyu-estilo") ?? "null")); }
  catch { return { ...ESTILO_INICIAL }; }
}
const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[¿?¡!.,]/g, "").trim();
/** Solo referencias conceptuales inequívocas: nunca infiere una parcela de la prosa de Muyu. */
export function resolverSeguimiento(pregunta: string, historial: { role: string; text: string }[]): string {
  const p = normal(pregunta);
  if (!/^(explicame mas|explicamelo mas facil|que significa eso|por que|dame un ejemplo|y eso sirve para el arroz)$/.test(p)) return pregunta;
  const anterior = [...historial].reverse().find(m => m.role === "user" && !/^(explicame|explicamelo|que significa eso|por que|dame un ejemplo|y eso)/.test(normal(m.text)));
  const concepto = anterior && normal(anterior.text).match(/^(?:pero )?(?:que es|que significa|para que sirve) (?:el |la )?(urea|mucuna|ndvi|humedad del suelo)$/)?.[1];
  if (!concepto) return pregunta;
  if (p === "y eso sirve para el arroz") return `¿Para qué sirve ${concepto} en el arroz?`;
  return `¿Qué es ${concepto}? ${pregunta}`;
}
/** Los botones repiten una consulta entendible y mantienen el mismo contexto efectivo. */
export function conSugerencias(reply: ChatReply): ChatReply {
  if (reply.sugerencias?.length) return reply;
  const tema = reply.evidencia?.tema;
  const textos = tema === "riesgo" ? ["¿Qué puedo revisar en el semáforo de mi parcela?", "Explícamelo más fácil"]
    : tema ? ["Explícamelo más fácil", "¿Y en noviembre?", "Muéstrame las fuentes"]
    : /urea|mucuna|NDVI|cantidad de agua/.test(reply.text) ? ["Explícame más", "Dame un ejemplo"] : [];
  return { ...reply, sugerencias: textos.map(texto => ({ texto })) };
}
