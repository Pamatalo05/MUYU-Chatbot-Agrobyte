import {
  balanceHidrico,
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
  type Balance,
} from "../knowledge/kallpaConocimiento";
import type { MuyuContexto } from "../knowledge/contexto";
import { evaluarSemaforo } from "../knowledge/semaforo";
import { ESCENARIO_NOMBRE, type PaqueteCanton } from "../knowledge/types";
import { detectarAccion, type AccionRapida } from "./preguntasRapidas";
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

/** "Fréjol caupí / tumbe" → "fréjol caupí"; "Papa (INIAP-Fripapa)" → "papa" */
const nombreCorto = (nombre: string) => nombre.split(" (")[0].split(" / ")[0].toLowerCase();

const BALANCE_TEXTO: Record<Balance, string> = {
  exceso: "riesgo de exceso de lluvia",
  deficit: "riesgo de sequía",
  normal: "lluvias cercanas a lo normal",
};

const NO_ENTIENDO: ChatReply = {
  text:
    "Aún estoy aprendiendo a entender preguntas así sin internet. " +
    "Prueba con uno de los botones de abajo: sé de rotaciones, El Niño y La Niña, urea y el clima de tu cantón.",
  emotion: "neutral",
};

export function responderOffline(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
  pregunta: string,
  accion?: AccionRapida,
): ChatReply {
  const tema = accion ?? detectarAccion(pregunta);
  switch (tema) {
    case "rotacion":
      return responderRotacion(paquete, contexto);
    case "urea":
      return responderUrea(paquete, contexto);
    case "enso":
      return responderEnso(paquete, contexto);
    case "resumen":
      return responderResumen(paquete, contexto);
    default:
      return NO_ENTIENDO;
  }
}

function responderRotacion(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, cultivoPrevioId, escenario, mes } = contexto;
  const { recomendaciones, avisos } = recomendarRotacion(paquete, { cantonId, cultivoPrevioId, escenario, mes });
  const canton = paquete.cantones[cantonId].nombre;
  const previo = nombreCorto(paquete.cultivos.find((c) => c.id === cultivoPrevioId)?.nombre ?? cultivoPrevioId);

  if (recomendaciones.length === 0) {
    return { text: `${avisos.join(" ")} Prueba con otro escenario o consulta a un técnico de tu zona.`, emotion: "neutral" };
  }

  const [primera, ...otras] = recomendaciones;
  const razones = primera.razones.slice(0, 2).join(" y ");
  const semaforo = evaluarSemaforo(paquete, contexto);
  const alerta = semaforo.color === "rojo" ? `Cuidado, el riesgo para sembrar es alto: ${semaforo.motivo}. ` : "";
  let texto =
    alerta +
    `Después de cosechar ${previo} en ${canton}, con escenario ${ESCENARIO_NOMBRE[escenario]}, ` +
    `te recomiendo ${nombreCorto(primera.nombre)}: ${razones}. ` +
    `Deja un margen de unos ${numero(primera.margen_neto_ha)} USD/ha (fuente: ${primera.fuente}).`;
  if (otras.length > 0) {
    texto += ` Otras opciones: ${otras.map((r) => nombreCorto(r.nombre)).join(" y ")}.`;
  } else if (avisos.length > 0) {
    texto += ` ${avisos[0]}`;
  }
  return { text: texto, emotion: alerta ? "neutral" : "happy" };
}

function responderUrea(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { recomendaciones } = recomendarRotacion(paquete, contexto);
  const mejor = [...recomendaciones].sort((a, b) => b.ahorro_urea_ha - a.ahorro_urea_ha)[0];

  if (!mejor || mejor.ahorro_urea_ha === 0) {
    return {
      text: "Con las opciones que hay para tu cantón y escenario, no encuentro ahorro en urea. Te conviene revisar otra rotación.",
      emotion: "neutral",
    };
  }
  const fija = paquete.cultivos.find((c) => c.id === mejor.id)?.fija_nitrogeno;
  return {
    text:
      `Si siembras ${nombreCorto(mejor.nombre)}, ahorras unos ${numero(mejor.ahorro_urea_ha)} USD por hectárea en urea` +
      (fija ? " porque fija nitrógeno en el suelo." : ".") +
      ` En 5 hectáreas serían ${numero(mejor.ahorro_urea_ha * 5)} USD.`,
    emotion: "happy",
  };
}

function responderEnso(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, mes } = contexto;
  const [, nino, nina] = compararEscenarios(paquete, cantonId, mes);
  const balance = (escenario: "el_nino" | "la_nina") =>
    BALANCE_TEXTO[balanceHidrico(paquete, cantonId, escenario, mes).balance];
  return {
    text:
      `En ${MESES[mes - 1]}, en ${nino.canton}: con El Niño llueven ${numero(nino.lluvia_mm_mes)} mm ` +
      `(${conSigno(nino.diferencia.lluvia_mm_mes)} frente a Neutro) y con La Niña ${numero(nina.lluvia_mm_mes)} mm ` +
      `(${conSigno(nina.diferencia.lluvia_mm_mes)}). ` +
      `Para sembrar ahora, El Niño trae ${balance("el_nino")} y La Niña, ${balance("la_nina")}.`,
    emotion: "neutral",
  };
}

function responderResumen(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const r = resumenCanton(paquete, contexto.cantonId, contexto.escenario, contexto.mes);
  return {
    text:
      `${r.canton} (suelo ${r.suelo.split(" (")[0].toLowerCase()}, ${numero(r.elevacion_msnm)} m) en ${MESES[r.mes - 1]} con escenario ${r.escenarioNombre}: ` +
      `máxima de ${numero(r.temp_max_c, 1)} °C y mínima de ${numero(r.temp_min_c, 1)} °C, ${numero(r.lluvia_mm_mes)} mm de lluvia, ` +
      `humedad en raíz de ${numero(r.humedad_raiz, 2)} y verdor (NDVI) de ${numero(r.ndvi_modis, 2)}.`,
    emotion: "neutral",
  };
}
