import {
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
} from "../knowledge/kallpaConocimiento";
import type { MuyuContexto } from "../knowledge/contexto";
import { ESCENARIO_NOMBRE, type PaqueteCanton } from "../knowledge/types";
import { detectarAccion, type AccionRapida } from "./preguntasRapidas";
import type { ChatReply } from "./types";

/**
 * Modo campo (K2): redacta respuestas de Muyu sin internet, solo con el motor K1.
 * Frases cortas (2 o 3) porque se muestran y, más adelante, se leen en voz alta.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const numero = (valor: number, decimales = 0) =>
  valor.toLocaleString("es-EC", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const conSigno = (valor: number, decimales = 0) => (valor > 0 ? "+" : "") + numero(valor, decimales);

/** "Soya (Glycine max)" → "soya" */
const nombreCorto = (nombre: string) => nombre.split(" (")[0].toLowerCase();

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
  const { cantonId, cultivoPrevioId, escenario } = contexto;
  const { recomendaciones, avisos } = recomendarRotacion(paquete, { cantonId, cultivoPrevioId, escenario });
  const canton = paquete.cantones[cantonId].nombre;
  const previo = nombreCorto(paquete.cultivos.find((c) => c.id === cultivoPrevioId)?.nombre ?? cultivoPrevioId);

  if (recomendaciones.length === 0) {
    return { text: `${avisos.join(" ")} Pronto aprenderé sobre cultivos de esa zona.`, emotion: "neutral" };
  }

  const [primera, ...otras] = recomendaciones;
  const razones = primera.razones.slice(0, 2).join(" y ");
  let texto =
    `Después de cosechar ${previo} en ${canton}, con escenario ${ESCENARIO_NOMBRE[escenario]}, ` +
    `te recomiendo ${nombreCorto(primera.nombre)}: ${razones}.`;
  if (otras.length > 0) {
    texto += ` Otras opciones: ${otras.map((r) => nombreCorto(r.nombre)).join(" y ")}.`;
  } else if (avisos.length > 0) {
    texto += ` ${avisos[0]}`;
  }
  return { text: texto, emotion: "happy" };
}

function responderUrea(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, cultivoPrevioId, escenario } = contexto;
  const { recomendaciones } = recomendarRotacion(paquete, { cantonId, cultivoPrevioId, escenario });
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
  const [, nino, nina] = compararEscenarios(paquete, contexto.cantonId, contexto.mes);
  const mes = MESES[contexto.mes - 1];
  const cambio = nina.diferencia.rendimiento_predicho_rf;
  const rendimiento =
    cambio === 0
      ? "y el índice de rendimiento se mantiene."
      : `y el índice de rendimiento ${cambio < 0 ? "cae" : "sube"} ${numero(Math.abs(cambio), 1)} puntos.`;
  return {
    text:
      `En ${mes}, en ${nino.canton}: con El Niño la lluvia llega a ${numero(nino.lluvia_mm_mes)} mm ` +
      `(${conSigno(nino.diferencia.lluvia_mm_mes)} frente a Neutro) y la humedad en raíz sube a ${numero(nino.humedad_raiz, 2)}. ` +
      `Con La Niña la lluvia es de ${numero(nina.lluvia_mm_mes)} mm, la humedad de ${numero(nina.humedad_raiz, 2)} ` +
      rendimiento,
    emotion: "neutral",
  };
}

function responderResumen(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const r = resumenCanton(paquete, contexto.cantonId, contexto.escenario, contexto.mes);
  return {
    text:
      `${r.canton} (${r.suelo.toLowerCase()}, ${numero(r.altitud_m)} m) en ${MESES[r.mes - 1]} con escenario ${r.escenarioNombre}: ` +
      `máxima de ${numero(r.temp_max_c, 1)} °C, ${numero(r.lluvia_mm_mes)} mm de lluvia ` +
      `y humedad en raíz de ${numero(r.humedad_raiz, 2)}. Índice de rendimiento previsto: ${numero(r.rendimiento_predicho_rf, 1)}.`,
    emotion: "neutral",
  };
}
