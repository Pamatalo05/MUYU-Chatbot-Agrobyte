import type { Preferencias } from "./estilo";
import { resolverConsulta, type TemaConsulta } from "../knowledge/contextoConversacion";
import { respuestaAgricola } from "../knowledge/consultaAgricola";

import {
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
} from "../knowledge/kallpaConocimiento";

import {
  obtenerCantonKallpa,
  obtenerRotacionesKallpa,
  calcularMargenParcial,
  type EscenarioKallpa,
  type PaqueteKallpa,
} from "../knowledge/adaptadorKallpa";

import { nombrePrevio, type MuyuContexto } from "../knowledge/contexto";
import { evaluarSemaforo, type ColorSemaforo } from "../knowledge/semaforo";
import type { Escenario, PaqueteCanton } from "../knowledge/types";
import {
  esTemaVetado,
  esPreguntaConceptual,
  responderPreguntaSencilla,
  respuestaFueraDeTema,
} from "../agent/guardarrailes";
import {
  detectarAccion,
  type AccionRapida,
} from "./preguntasRapidas";
import { sugerirPreguntas } from "./sugerencias";
import type { ChatReply } from "./types";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const numero = (valor: number, decimales = 0): string =>
  valor.toLocaleString("es-EC", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

const conSigno = (valor: number, decimales = 0): string =>
  (valor > 0 ? "+" : "") + numero(valor, decimales);

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


const conApertura = (respuesta: ChatReply, pregunta: string, tema: AccionRapida): ChatReply => respuesta.text.startsWith("⚠️") ? respuesta : { ...respuesta, text: `${apertura(pregunta, tema)}\n${respuesta.text}` };

const variedad = (nombre: string) => nombre.match(/\((INIAP[^)]*)\)/)?.[1];

const nombreCorto = (nombre: string): string =>
  nombre.split(" (")[0].split(" / ")[0].toLowerCase();

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

function convertirEscenario(
  escenario: MuyuContexto["escenario"],
): EscenarioKallpa {
  switch (escenario) {
    case "el_nino":
      return "nino";
    case "la_nina":
      return "nina";
    default:
      return "neutro";
  }
}

function noEntiendo(pregunta: string): ChatReply {
  return {
    text:
      "Sin internet todavía no entiendo preguntas así. " +
      "te sugiero estas:",
    emotion: "neutral",
    sugerencias: sugerirPreguntas(pregunta),
  };
}

// --------------------------------------------------
// RESPUESTAS CON DATOS NUEVOS DE KALLPA ML
// --------------------------------------------------

function responderRotacionML(
  paqueteNuevo: PaqueteKallpa,
  contexto: MuyuContexto,
): ChatReply | null {
  const canton = obtenerCantonKallpa(
    paqueteNuevo,
    contexto.cantonId,
  );

  if (!canton) return null;

  const escenario = convertirEscenario(contexto.escenario);
  const rotaciones = obtenerRotacionesKallpa(
    canton,
    escenario,
  );

  if (rotaciones.length === 0) {
    return {
      text:
        `No tengo rotaciones disponibles para ` +
        `${canton.nombre} en este escenario.`,
      emotion: "neutral",
    };
  }

  const mejor = rotaciones[0];
  const margen = calcularMargenParcial(mejor);

  return {
    text: [
      `Para ${canton.nombre}, una opción de rotación es ${mejor.cultivo}.`,
      `Su ciclo estimado es de ${mejor.ciclo_dias} días.`,
      `Margen parcial estimado: ${numero(margen)} USD/ha.`,
      `Fuente técnica: ${mejor.fuente_tecnica}.`,
      `Verifica si es adecuado para tu parcela y cultivo anterior.`,
    ].join("\n"),
    emotion: "happy",
  };
}

function responderUreaML(
  paqueteNuevo: PaqueteKallpa,
  contexto: MuyuContexto,
): ChatReply | null {
  const canton = obtenerCantonKallpa(
    paqueteNuevo,
    contexto.cantonId,
  );

  if (!canton) return null;

  const escenario = convertirEscenario(contexto.escenario);
  const rotaciones = obtenerRotacionesKallpa(
    canton,
    escenario,
  );

  const mejor = [...rotaciones].sort(
    (a, b) =>
      b.ahorro_urea_kg_ha - a.ahorro_urea_kg_ha,
  )[0];

  if (!mejor || mejor.ahorro_urea_kg_ha <= 0) {
    return {
      text:
        `No encuentro un ahorro estimado de urea ` +
        `para ${canton.nombre} en este escenario.`,
      emotion: "neutral",
    };
  }

  return {
    text: [
      `En ${canton.nombre}, cultivar ${mejor.cultivo} podría ahorrar aproximadamente ${numero(mejor.ahorro_urea_kg_ha)} kg de urea por hectárea.`,
      `Fijación estimada de nitrógeno: ${numero(mejor.fijacion_n_kg_ha)} kg/ha.`,
      `El ahorro económico depende del precio local de la urea.`,
    ].join("\n"),
    emotion: "happy",
  };
}

function responderEnsoML(
  paqueteNuevo: PaqueteKallpa,
  contexto: MuyuContexto,
): ChatReply | null {
  const canton = obtenerCantonKallpa(
    paqueteNuevo,
    contexto.cantonId,
  );

  if (!canton) return null;

  const datos = canton.serie_satelital_ml.find(
    (item) => item.mes === contexto.mes,
  );

  if (!datos) return null;

  const humedadNino = datos.humedad_raiz_predicha.nino;
  const humedadNina = datos.humedad_raiz_predicha.nina;

  return {
    text: [
      `En ${canton.nombre}, durante ${MESES[contexto.mes - 1]}:`,
      `Con El Niño, la humedad estimada en la raíz es ${numero(humedadNino * 100, 1)} %.`,
      `Con La Niña, sería ${numero(humedadNina * 100, 1)} %.`,
      `La lluvia mensual de referencia es ${numero(datos.lluvia_mm, 1)} mm.`,
      `Son estimaciones del modelo, no pronósticos exactos para tu parcela.`,
    ].join("\n"),
    emotion: "neutral",
  };
}

function responderResumenML(
  paqueteNuevo: PaqueteKallpa,
  contexto: MuyuContexto,
): ChatReply | null {
  const canton = obtenerCantonKallpa(
    paqueteNuevo,
    contexto.cantonId,
  );

  if (!canton) return null;

  const datos = canton.serie_satelital_ml.find(
    (item) => item.mes === contexto.mes,
  );

  if (!datos) return null;

  const escenario = convertirEscenario(contexto.escenario);
  const humedadRaiz =
    datos.humedad_raiz_predicha[escenario];

  return {
    text: [
      `${canton.nombre}, ${MESES[contexto.mes - 1]} (${CLIMA_TEXTO[contexto.escenario]}):`,
      `Temperatura de referencia: ${numero(datos.temp_c, 1)} °C.`,
      `Lluvia mensual de referencia: ${numero(datos.lluvia_mm, 1)} mm.`,
      `Humedad de raíz estimada por ML: ${numero(humedadRaiz * 100, 1)} %.`,
      `Humedad superficial SMAP: ${numero(datos.smap_humedad_superficial * 100, 1)} %.`,
      `NDVI: ${numero(datos.ndvi_modis, 3)}.`,
      `Son datos de referencia y estimaciones, no mediciones actuales de tu parcela.`,
    ].join("\n"),
    emotion: "neutral",
  };
}

// --------------------------------------------------
// CONTROLADOR PRINCIPAL DEL MODO OFFLINE
// --------------------------------------------------

export function responderOffline(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
  pregunta: string,
  accion?: AccionRapida,
  paqueteNuevo?: PaqueteKallpa,
  temaConversacion?: TemaConsulta,
  preferencias?: Preferencias,
): ChatReply {
  if (!accion && esTemaVetado(pregunta)) {
    return respuestaFueraDeTema(pregunta);
  }

  if (!accion) {
    const sencilla = responderPreguntaSencilla(pregunta, preferencias);
    if (sencilla) return sencilla;
    if (esPreguntaConceptual(pregunta)) return { text: "Puedo explicarte la urea, la humedad del suelo, el NDVI o la mucuna sin conexión. ¿Cuál de esos temas necesitas?", emotion: "neutral" };
  }

  const consulta = resolverConsulta(pregunta, contexto, null, Object.keys(paquete.cantones), temaConversacion);
  if (accion) consulta.tema = accion;
  if (consulta.error) return { text: consulta.error, emotion: "neutral" };
  if (paqueteNuevo || temaConversacion) {
    const factual = respuestaAgricola(consulta, paqueteNuevo, pregunta, paquete, preferencias);
    if (factual) return factual;
  }
  contexto = consulta.contexto;
  const tema = accion ?? detectarAccion(pregunta);

  switch (tema) {
    case "rotacion": {
      if (paqueteNuevo) {
        const respuesta = responderRotacionML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return conApertura(responderRotacion(paquete, contexto), pregunta, "rotacion");
    }

    case "urea": {
      if (paqueteNuevo) {
        const respuesta = responderUreaML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return conApertura(responderUrea(paquete, contexto), pregunta, "urea");
    }

    case "enso": {
      if (paqueteNuevo) {
        const respuesta = responderEnsoML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return conApertura(responderEnso(paquete, contexto), pregunta, "enso");
    }

    case "resumen": {
      if (paqueteNuevo) {
        const respuesta = responderResumenML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return conApertura(responderResumen(paquete, contexto), pregunta, "resumen");
    }

    default:
      return noEntiendo(pregunta);
  }
}

// Respaldo adaptado al esquema vigente, con las mismas fórmulas del motor compartido.

function responderRotacion(paquete: PaqueteCanton, contexto: MuyuContexto): ChatReply {
  const { cantonId, cultivoPrevioId, escenario } = contexto;
  const { recomendaciones } = recomendarRotacion(paquete, contexto);
  const canton = paquete.cantones[cantonId].nombre.split(",")[0];
  const [primera, ...otras] = recomendaciones;
  if (!primera) return { text: "No hay rotaciones documentadas para este contexto.", emotion: "neutral" };

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
    `Margen parcial aproximado: unos ${numero(primera.ganancia_ha)} USD por hectárea, ya descontados los insumos (fuente: ${primera.fuente}).`,
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
