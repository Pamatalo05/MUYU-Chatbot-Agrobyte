
import {
  balanceHidrico,
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
  type Balance,
} from "../knowledge/kallpaConocimiento";

import {
  obtenerCantonKallpa,
  obtenerRotacionesKallpa,
  calcularMargenParcial,
  type EscenarioKallpa,
  type PaqueteKallpa,
} from "../knowledge/adaptadorKallpa";

import type { MuyuContexto } from "../knowledge/contexto";
import { evaluarSemaforo } from "../knowledge/semaforo";
import type { Escenario, PaqueteCanton } from "../knowledge/types";
import {
  esTemaVetado,
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

const nombreCorto = (nombre: string): string =>
  nombre.split(" (")[0].split(" / ")[0].toLowerCase();

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
      "Te sugiero estas:",
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
): ChatReply {
  if (!accion && esTemaVetado(pregunta)) {
    return respuestaFueraDeTema(pregunta);
  }

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

      return responderRotacion(paquete, contexto);
    }

    case "urea": {
      if (paqueteNuevo) {
        const respuesta = responderUreaML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return responderUrea(paquete, contexto);
    }

    case "enso": {
      if (paqueteNuevo) {
        const respuesta = responderEnsoML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return responderEnso(paquete, contexto);
    }

    case "resumen": {
      if (paqueteNuevo) {
        const respuesta = responderResumenML(
          paqueteNuevo,
          contexto,
        );

        if (respuesta) return respuesta;
      }

      return responderResumen(paquete, contexto);
    }

    default:
      return noEntiendo(pregunta);
  }
}

// --------------------------------------------------
// RESPUESTAS ORIGINALES COMO RESPALDO
// --------------------------------------------------

function responderRotacion(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
): ChatReply {
  const { cantonId, cultivoPrevioId, escenario } = contexto;

  const { recomendaciones, avisos } = recomendarRotacion(
    paquete,
    contexto,
  );

  const canton =
    paquete.cantones[cantonId].nombre.split(",")[0];

  const previo = nombreCorto(
    paquete.cultivos.find(
      (c) => c.id === cultivoPrevioId,
    )?.nombre ?? cultivoPrevioId,
  );

  if (recomendaciones.length === 0) {
    return {
      text:
        `${avisos.join(" ")}\n` +
        "Prueba con otro clima o consulta a un técnico de tu zona.",
      emotion: "neutral",
    };
  }

  const [primera, ...otras] = recomendaciones;
  const semaforo = evaluarSemaforo(paquete, contexto);
  const lineas: string[] = [];

  if (semaforo.color === "rojo") {
    lineas.push(
      `Cuidado, el riesgo para sembrar es alto: ${semaforo.motivo}.`,
    );
  }

  lineas.push(
    `Después de cosechar ${previo} en ${canton} (${CLIMA_TEXTO[escenario]}), te recomiendo ${nombreCorto(primera.nombre)}.`,
    `Por qué: ${primera.razones.slice(0, 2).join(" y ")}.`,
    `Margen estimado: unos ${numero(primera.margen_neto_ha)} USD/ha (fuente: ${primera.fuente}).`,
  );

  if (otras.length > 0) {
    lineas.push(
      `Otras opciones: ${otras.map((r) => nombreCorto(r.nombre)).join(" y ")}.`,
    );
  } else if (avisos.length > 0) {
    lineas.push(avisos[0]);
  }

  return {
    text: lineas.join("\n"),
    emotion: semaforo.color === "rojo" ? "neutral" : "happy",
  };
}

function responderUrea(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
): ChatReply {
  const { recomendaciones } = recomendarRotacion(
    paquete,
    contexto,
  );

  const mejor = [...recomendaciones].sort(
    (a, b) => b.ahorro_urea_ha - a.ahorro_urea_ha,
  )[0];

  if (!mejor || mejor.ahorro_urea_ha === 0) {
    return {
      text:
        "Con las opciones que hay para tu cantón y escenario, " +
        "no encuentro ahorro en urea. " +
        "Te conviene revisar otra rotación.",
      emotion: "neutral",
    };
  }

  const fija = paquete.cultivos.find(
    (c) => c.id === mejor.id,
  )?.fija_nitrogeno;

  return {
    text:
      `Si siembras ${nombreCorto(mejor.nombre)}, ` +
      `el ahorro estimado en urea es de ${numero(mejor.ahorro_urea_ha)} USD por hectárea` +
      (fija ? " porque fija nitrógeno en el suelo." : ".") +
      " Para calcular el ahorro total, necesito saber cuántas hectáreas tienes.",
    emotion: "happy",
  };
}

function responderEnso(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
): ChatReply {
  const { cantonId, mes } = contexto;

  const [, nino, nina] = compararEscenarios(
    paquete,
    cantonId,
    mes,
  );

  const balance = (
    escenario: "el_nino" | "la_nina",
  ) =>
    BALANCE_TEXTO[
      balanceHidrico(
        paquete,
        cantonId,
        escenario,
        mes,
      ).balance
    ];

  const canton = nino.canton.split(",")[0];

  return {
    text: [
      `En ${MESES[mes - 1]}, en ${canton}:`,
      `Con El Niño: ${numero(nino.lluvia_mm_mes)} mm de lluvia (${conSigno(nino.diferencia.lluvia_mm_mes)} frente a un año normal).`,
      `Con La Niña: ${numero(nina.lluvia_mm_mes)} mm (${conSigno(nina.diferencia.lluvia_mm_mes)}).`,
      `Si siembras ahora, El Niño trae ${balance("el_nino")} y La Niña, ${balance("la_nina")}.`,
    ].join("\n"),
    emotion: "neutral",
  };
}

function responderResumen(
  paquete: PaqueteCanton,
  contexto: MuyuContexto,
): ChatReply {
  const r = resumenCanton(
    paquete,
    contexto.cantonId,
    contexto.escenario,
    contexto.mes,
  );

  return {
    text: [
      `${r.canton.split(",")[0]} en ${MESES[r.mes - 1]} (${CLIMA_TEXTO[r.escenario]}):`,
      `Temperatura: de ${numero(r.temp_min_c)} a ${numero(r.temp_max_c)} °C.`,
      `Lluvia: ${numero(r.lluvia_mm_mes)} mm en el mes.`,
      `Humedad del suelo en la raíz: ${numero(r.humedad_raiz * 100)} %.`,
      `Verdor de los cultivos (NDVI): ${numero(r.ndvi_modis * 100)} de 100.`,
      `Suelo ${r.suelo.split(" (")[0].toLowerCase()}, a ${numero(r.elevacion_msnm)} m de altura.`,
    ].join("\n"),
    emotion: "neutral",
  };
}
