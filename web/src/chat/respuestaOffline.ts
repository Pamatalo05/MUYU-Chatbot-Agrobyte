import {
  balanceHidrico,
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
  type Balance,
} from "../knowledge/kallpaConocimiento";
import type { MuyuContexto } from "../knowledge/contexto";
import { evaluarSemaforo } from "../knowledge/semaforo";
import type { Escenario, PaqueteCanton } from "../knowledge/types";
import { esTemaVetado, respuestaFueraDeTema } from "../agent/guardarrailes";
import { detectarAccion, type AccionRapida } from "./preguntasRapidas";
import { sugerirPreguntas } from "./sugerencias";
import type { ChatReply } from "./types";

/**
 * Modo campo: redacta respuestas de Muyu sin internet, solo con el motor K1.
 * Frases cortas (2 o 3) porque se muestran y, más adelante, se leen en voz alta.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const numero = (valor: number, decimales = 0) =>
  valor.toLocaleString("es-EC", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const conSigno = (valor: number, decimales = 0) => (valor > 0 ? "+" : "") + numero(valor, decimales);

/**
 * Frases de apertura cálidas. Se elige una según la pregunta (siempre la misma para
 * la misma pregunta, así las pruebas son estables) para que Muyu no suene repetitivo.
 */
const APERTURAS = [
  "¡Hey, muy buena pregunta! 🌱",
  "¡Claro que sí, te ayudo!",
  "¡Qué buena pregunta!",
  "¡Con gusto te cuento!",
  "¡Buenísima pregunta!",
];

export function apertura(pregunta: string, accion: string): string {
  const semilla = [...`${pregunta}|${accion}`].reduce((total, letra) => total + letra.charCodeAt(0), 0);
  return APERTURAS[semilla % APERTURAS.length];
}

/** "Fréjol caupí / tumbe" → "fréjol caupí"; "Papa (INIAP-Fripapa)" → "papa" */
const nombreCorto = (nombre: string) => nombre.split(" (")[0].split(" / ")[0].toLowerCase();

/** Como lo dice el agricultor (la UI usa los mismos términos). */
const CLIMA_TEXTO: Record<Escenario, string> = {
  neutro: "año normal",
  el_nino: "año de El Niño",
  la_nina: "año de La Niña",
};

const BALANCE_TEXTO: Record<Balance, string> = {
  exceso: "riesgo de exceso de lluvia",
  deficit: "riesgo de sequía",
  normal: "lluvias cercanas a lo normal",
};

/** Sin internet solo entiende ciertos temas: ofrece las preguntas más parecidas. */
const noEntiendo = (pregunta: string): ChatReply => ({
  text: "¡Uy! Sin internet todavía no entiendo preguntas así, pero te sugiero estas:",
  emotion: "neutral",
  sugerencias: sugerirPreguntas(pregunta),
});

export function responderOffline(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
  pregunta: string,
  accion?: AccionRapida,
): ChatReply {
  if (!accion && esTemaVetado(pregunta)) return respuestaFueraDeTema(pregunta);
  const tema = accion ?? detectarAccion(pregunta);
  if (!tema) return noEntiendo(pregunta);

  const RESPUESTAS = { rotacion: responderRotacion, urea: responderUrea, enso: responderEnso, resumen: responderResumen };
  const respuesta = RESPUESTAS[tema](paquete, contexto);
  // Ante un riesgo alto no se abre con "¡Hey!": primero va el aviso, con tono serio.
  if (respuesta.text.startsWith("⚠️")) return respuesta;
  return { ...respuesta, text: `${apertura(pregunta, tema)}\n${respuesta.text}` };
}

/** Solo la ganancia por vender; el ahorro en urea ya va en el "Por qué" (no es plata que te pagan). */
function ganancia(r: { ingreso_bruto_ha: number; costo_insumos_ha: number; fuente: string }): string {
  if (r.ingreso_bruto_ha === 0) return `No se vende: es abono verde para recuperar la tierra (fuente: ${r.fuente}).`;
  const venta = numero(r.ingreso_bruto_ha - r.costo_insumos_ha);
  return `Ganancia aproximada: unos ${venta} USD por hectárea, ya descontados los insumos (fuente: ${r.fuente}).`;
}

function responderRotacion(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, cultivoPrevioId, escenario } = contexto;
  const { recomendaciones, avisos } = recomendarRotacion(paquete, contexto);
  const canton = paquete.cantones[cantonId].nombre.split(",")[0];
  const previo = nombreCorto(paquete.cultivos.find((c) => c.id === cultivoPrevioId)?.nombre ?? cultivoPrevioId);

  if (recomendaciones.length === 0) {
    return { text: `${avisos.join(" ")}\nPrueba con otro clima o consulta a un técnico de tu zona.`, emotion: "neutral" };
  }

  // Una idea por línea: se lee rápido en el celular y en voz alta.
  const [primera, ...otras] = recomendaciones;
  const semaforo = evaluarSemaforo(paquete, contexto);
  const lineas: string[] = [];
  if (semaforo.color === "rojo") lineas.push(`⚠️ Cuidado, el riesgo para sembrar es alto: ${semaforo.motivo}.`);
  lineas.push(
    `Después de cosechar ${previo} en ${canton} (${CLIMA_TEXTO[escenario]}), te recomiendo ${nombreCorto(primera.nombre)}.`,
    `Por qué: ${primera.razones.slice(0, 2).join(" y ")}.`,
    ganancia(primera),
  );
  if (otras.length > 0) lineas.push(`Otras opciones: ${otras.map((r) => nombreCorto(r.nombre)).join(" y ")}.`);
  else if (avisos.length > 0) lineas.push(avisos[0]);

  return { text: lineas.join("\n"), emotion: semaforo.color === "rojo" ? "neutral" : "happy" };
}

function responderUrea(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { recomendaciones } = recomendarRotacion(paquete, contexto);
  const conAhorro = recomendaciones.filter((r) => r.ahorro_urea_ha > 0);
  // Primero un cultivo que además se vende; el abono verde solo si no hay otro.
  const mejor =
    [...conAhorro].filter((r) => r.ingreso_bruto_ha > 0).sort((a, b) => b.ahorro_urea_ha - a.ahorro_urea_ha)[0] ??
    conAhorro[0];

  if (!mejor) {
    return {
      text: "Con las opciones que hay para tu cantón y este clima, no encuentro ahorro en urea.\nTe conviene mirar otra rotación.",
      emotion: "neutral",
    };
  }
  const lineas = [
    `Si siembras ${nombreCorto(mejor.nombre)}, ese cultivo deja nitrógeno en la tierra.`,
    `Así el siguiente cultivo necesita menos urea: ahorras unos ${numero(mejor.ahorro_urea_ha)} USD por hectárea.`,
    "Es un cálculo aproximado; cuánto ahorras de verdad depende de tu suelo y de cuánta urea usas hoy.",
  ];
  return { text: lineas.join("\n"), emotion: "happy" };
}

function responderEnso(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, mes } = contexto;
  const [, nino, nina] = compararEscenarios(paquete, cantonId, mes);
  const balance = (escenario: "el_nino" | "la_nina") =>
    BALANCE_TEXTO[balanceHidrico(paquete, cantonId, escenario, mes).balance];
  const canton = nino.canton.split(",")[0];
  return {
    text: [
      `En ${MESES[mes - 1]}, en ${canton}:`,
      `🌧️ Con El Niño: ${numero(nino.lluvia_mm_mes)} mm de lluvia (${conSigno(nino.diferencia.lluvia_mm_mes)} frente a un año normal).`,
      `☀️ Con La Niña: ${numero(nina.lluvia_mm_mes)} mm (${conSigno(nina.diferencia.lluvia_mm_mes)}).`,
      `Si siembras ahora, El Niño trae ${balance("el_nino")} y La Niña, ${balance("la_nina")}.`,
    ].join("\n"),
    emotion: "neutral",
  };
}

function responderResumen(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const r = resumenCanton(paquete, contexto.cantonId, contexto.escenario, contexto.mes);
  return {
    text: [
      `${r.canton.split(",")[0]} en ${MESES[r.mes - 1]} (${CLIMA_TEXTO[r.escenario]}):`,
      `🌡️ Temperatura: de ${numero(r.temp_min_c)} a ${numero(r.temp_max_c)} °C.`,
      `🌧️ Lluvia: ${numero(r.lluvia_mm_mes)} mm en el mes.`,
      `💧 Humedad del suelo en la raíz: ${numero(r.humedad_raiz * 100)} %.`,
      `🌿 Verdor de los cultivos (NDVI): ${numero(r.ndvi_modis * 100)} de 100.`,
      `Suelo ${r.suelo.split(" (")[0].toLowerCase()}, a ${numero(r.elevacion_msnm)} m de altura.`,
    ].join("\n"),
    emotion: "neutral",
  };
}
