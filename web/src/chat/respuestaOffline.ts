import { compararEscenarios, recomendarRotacion, resumenCanton } from "../knowledge/kallpaConocimiento";
import { nombrePrevio, type MuyuContexto } from "../knowledge/contexto";
import { evaluarSemaforo, type ColorSemaforo } from "../knowledge/semaforo";
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

/** "Soya de rotación (INIAP-308)" → "soya de rotación"; "Mucuna (Mucuna pruriens — …)" → "mucuna" */
const nombreCorto = (nombre: string) => nombre.split(" (")[0].split(" / ")[0].toLowerCase();

/** "Soya de rotación (INIAP-308)" → "INIAP-308" (la variedad le da confianza al agricultor). */
const variedad = (nombre: string) => nombre.match(/\((INIAP[^)]*)\)/)?.[1];

/** Como lo dice el agricultor (la UI usa los mismos términos). */
const CLIMA_TEXTO: Record<Escenario, string> = {
  neutro: "año normal",
  el_nino: "año de El Niño",
  la_nina: "año de La Niña",
};

const RIESGO_TEXTO: Record<ColorSemaforo, string> = {
  verde: "buen momento para sembrar",
  amarillo: "siembra con precaución",
  rojo: "momento riesgoso para sembrar",
};

const pct = (valor: number) => `${numero(valor * 100)} %`;

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

function responderRotacion(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, cultivoPrevioId, escenario } = contexto;
  const { recomendaciones } = recomendarRotacion(paquete, contexto);
  const canton = paquete.cantones[cantonId].nombre.split(",")[0];
  const [primera, ...otras] = recomendaciones;

  // Una idea por línea: se lee rápido en el celular y en voz alta.
  const semaforo = evaluarSemaforo(paquete, contexto);
  const lineas: string[] = [];
  if (semaforo.color === "rojo") lineas.push(`⚠️ Cuidado, el riesgo para sembrar es alto: ${semaforo.motivo}.`);
  const tipo = variedad(primera.nombre);
  lineas.push(
    `Después de cosechar ${nombrePrevio(cultivoPrevioId)} en ${canton} (${CLIMA_TEXTO[escenario]}), ` +
      `te recomiendo ${nombreCorto(primera.nombre)}${tipo ? ` ${tipo}` : ""}.`,
    `Por qué: es la primera opción de Kallpa para un ${CLIMA_TEXTO[escenario]} y en ${primera.ciclo_dias} días ` +
      `deja unos ${numero(primera.fijacion_n_kg_ha)} kg de nitrógeno por hectárea en la tierra.`,
    `Ganancia aproximada: unos ${numero(primera.ganancia_ha)} USD por hectárea, ya descontados los insumos (fuente: ${primera.fuente}).`,
  );
  if (otras.length > 0) lineas.push(`Otras opciones: ${otras.map((r) => nombreCorto(r.nombre)).join(" y ")}.`);

  return { text: lineas.join("\n"), emotion: semaforo.color === "rojo" ? "neutral" : "happy" };
}

function responderUrea(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  // Se elige la opción que más urea ahorra y la cifra va por hectárea:
  // no asumimos el tamaño de la parcela, se lo preguntamos al agricultor.
  const { recomendaciones } = recomendarRotacion(paquete, contexto);
  const mejor = [...recomendaciones].sort((a, b) => b.ahorro_urea_kg_ha - a.ahorro_urea_kg_ha)[0];

  if (!mejor || mejor.ahorro_urea_kg_ha <= 0) {
    return {
      text: "Con las opciones que hay para tu cantón y escenario, no encuentro ahorro en urea. Te conviene revisar otra rotación.",
      emotion: "neutral",
    };
  }
  const lineas = [
    `Si siembras ${nombreCorto(mejor.nombre)}, ese cultivo deja nitrógeno en la tierra.`,
    `Así el siguiente cultivo necesita unos ${numero(mejor.ahorro_urea_kg_ha)} kg menos de urea por hectárea: ` +
      `son unos ${numero(mejor.ahorro_urea_sacos, 1)} sacos de 50 kg, más o menos ${numero(mejor.ahorro_urea_usd)} USD por hectárea.`,
    "Es un cálculo aproximado, con el precio de referencia del MAG; depende de tu suelo y de cuánta urea usas hoy.",
    "Para calcular el ahorro total, necesito saber cuántas hectáreas tienes.",
  ];
  return { text: lineas.join("\n"), emotion: "happy" };
}

function responderEnso(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, mes } = contexto;
  const [neutro, nino, nina] = compararEscenarios(paquete, cantonId, mes);
  const riesgo = (escenario: Escenario) => RIESGO_TEXTO[evaluarSemaforo(paquete, { ...contexto, escenario }).color];
  const puntos = (d: number) => `${conSigno(d * 100)} puntos`;
  return {
    text: [
      `En ${MESES[mes - 1]}, en ${neutro.canton.split(",")[0]}, la humedad del suelo en la raíz sería:`,
      `🌱 Año normal: ${pct(neutro.humedad_raiz)}.`,
      `🌧️ Con El Niño: ${pct(nino.humedad_raiz)} (${puntos(nino.diferencia_humedad)}).`,
      `☀️ Con La Niña: ${pct(nina.humedad_raiz)} (${puntos(nina.diferencia_humedad)}).`,
      `Para sembrar ahora: con El Niño, ${riesgo("el_nino")}; con La Niña, ${riesgo("la_nina")}.`,
    ].join("\n"),
    emotion: "neutral",
  };
}

function responderResumen(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const r = resumenCanton(paquete, contexto.cantonId, contexto.escenario, contexto.mes);
  return {
    text: [
      `${r.canton.split(",")[0]} en ${MESES[r.mes - 1]} (${CLIMA_TEXTO[r.escenario]}):`,
      `🌧️ Lluvia típica: ${numero(r.lluvia_mm)} mm en el mes.`,
      `🌡️ Temperatura máxima típica: ${numero(r.temp_max_c, 1)} °C.`,
      `💧 Humedad del suelo en la raíz: ${pct(r.humedad_raiz)} (predicción del modelo).`,
      `🌿 Verdor de los cultivos (NDVI): ${numero(r.ndvi_modis * 100)} de 100.`,
      `Suelo ${r.suelo.split(" (")[0].toLowerCase()}, a ${numero(r.elevacion_msnm)} m de altura.`,
    ].join("\n"),
    emotion: "neutral",
  };
}
