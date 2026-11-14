import {
  ESCENARIOS,
  ESCENARIO_NOMBRE,
  type Canton,
  type Cultivo,
  type Escenario,
  type MesClima,
  type PaqueteCanton,
  type Region,
} from "./types";

/**
 * Motor de conocimiento de Muyu (K1).
 * Funciones puras sobre paquete_canton.json: las usa el modo campo (sin internet)
 * y Gemini como herramientas (con internet), así ambos modos dan las mismas cifras.
 */

/** Altitud desde la que un cantón se considera de Sierra. */
const ALTITUD_SIERRA_M = 1500;

export class ConsultaInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ConsultaInvalidaError";
  }
}

function obtenerCanton(paquete: PaqueteCanton, cantonId: string): Canton {
  const canton = paquete.cantones[cantonId];
  if (!canton) {
    const disponibles = Object.keys(paquete.cantones).join(", ");
    throw new ConsultaInvalidaError(`Cantón "${cantonId}" no existe. Disponibles: ${disponibles}`);
  }
  return canton;
}

function obtenerMes(canton: Canton, escenario: Escenario, mes: number): MesClima {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new ConsultaInvalidaError(`Mes ${mes} inválido: debe estar entre 1 y 12`);
  }
  return canton.escenarios_climaticos[escenario][mes - 1];
}

export const regionDeCanton = (canton: Canton): Region =>
  canton.altitud_m >= ALTITUD_SIERRA_M ? "sierra" : "costa";

// ---------------------------------------------------------------- resumenCanton

export interface ResumenCanton extends MesClima {
  cantonId: string;
  canton: string;
  suelo: string;
  altitud_m: number;
  region: Region;
  escenario: Escenario;
  escenarioNombre: string;
}

/** Clima, humedad, verdor y rendimiento previsto de un cantón en un mes y escenario. */
export function resumenCanton(
  paquete: PaqueteCanton,
  cantonId: string,
  escenario: Escenario,
  mes: number,
): ResumenCanton {
  const canton = obtenerCanton(paquete, cantonId);
  return {
    ...obtenerMes(canton, escenario, mes),
    cantonId,
    canton: canton.nombre,
    suelo: canton.suelo_referencia,
    altitud_m: canton.altitud_m,
    region: regionDeCanton(canton),
    escenario,
    escenarioNombre: ESCENARIO_NOMBRE[escenario],
  };
}

// ------------------------------------------------------------ recomendarRotacion

export interface ConsultaRotacion {
  cantonId: string;
  cultivoPrevioId: string;
  escenario: Escenario;
  /** Cuántas recomendaciones devolver. Por defecto 3. */
  limite?: number;
}

export interface Recomendacion {
  id: string;
  nombre: string;
  puntaje: number;
  /** ingreso_bruto_ha + ahorro_urea_ha (USD/ha). El JSON aún no trae costos para un margen neto. */
  valor_estimado_ha: number;
  ahorro_urea_ha: number;
  ingreso_bruto_ha: number;
  dias_ciclo: number;
  razones: string[];
}

export interface ResultadoRotacion {
  recomendaciones: Recomendacion[];
  descartados: { id: string; motivo: string }[];
  avisos: string[];
}

const PUNTOS = {
  MISMO_TIPO: -3,
  AGUA_LA_NINA: { baja: 3, media: 0, alta: -3 },
  FIJA_N_NEUTRO: 2,
  FIJA_N_OTRO: 1,
} as const;

/**
 * Top de rotaciones tras el cultivo cosechado, con las reglas de la propuesta Kallpa:
 *  1. Ruptura de monocultivo: descarta el mismo cultivo y penaliza el mismo tipo.
 *  2. Piso térmico: descarta cultivos de otra región (costa/sierra).
 *  3. Balance hídrico por ENSO: La Niña prioriza baja demanda de agua;
 *     El Niño descarta los que no toleran encharcamiento; Neutro prioriza leguminosas.
 *  4. Desempate económico: mayor ingreso bruto + ahorro en urea.
 */
export function recomendarRotacion(
  paquete: PaqueteCanton,
  { cantonId, cultivoPrevioId, escenario, limite = 3 }: ConsultaRotacion,
): ResultadoRotacion {
  const canton = obtenerCanton(paquete, cantonId);
  const previo = paquete.cultivos.find((cultivo) => cultivo.id === cultivoPrevioId);
  if (!previo) {
    const disponibles = paquete.cultivos.map((cultivo) => cultivo.id).join(", ");
    throw new ConsultaInvalidaError(`Cultivo "${cultivoPrevioId}" no existe. Disponibles: ${disponibles}`);
  }

  const region = regionDeCanton(canton);
  const descartados: ResultadoRotacion["descartados"] = [];
  const avisos: string[] = [];
  const candidatos: Recomendacion[] = [];

  for (const cultivo of paquete.cultivos) {
    const motivo = motivoDeDescarte(cultivo, previo, escenario, region);
    if (motivo) {
      descartados.push({ id: cultivo.id, motivo });
      continue;
    }
    candidatos.push(puntuar(cultivo, previo, escenario));
  }

  candidatos.sort(
    (a, b) => b.puntaje - a.puntaje || b.valor_estimado_ha - a.valor_estimado_ha,
  );

  if (candidatos.length === 0 && region === "sierra") {
    avisos.push(
      `${canton.nombre} es de Sierra (${canton.altitud_m} m) y el paquete aún no tiene cultivos de Sierra.`,
    );
  } else if (candidatos.length < limite) {
    avisos.push(
      `Solo ${candidatos.length} cultivo(s) cumplen las condiciones de ${ESCENARIO_NOMBRE[escenario]}.`,
    );
  }

  return { recomendaciones: candidatos.slice(0, limite), descartados, avisos };
}

function motivoDeDescarte(
  cultivo: Cultivo,
  previo: Cultivo,
  escenario: Escenario,
  region: Region,
): string | null {
  if (cultivo.id === previo.id) return "repetiría el mismo cultivo (monocultivo)";
  if ((cultivo.region ?? "costa") !== region) return `no corresponde a la ${region}`;
  if (escenario === "el_nino" && !cultivo.tolera_encharcamiento) {
    return "no tolera el exceso de agua de El Niño (riesgo de pudrición radicular)";
  }
  return null;
}

function puntuar(cultivo: Cultivo, previo: Cultivo, escenario: Escenario): Recomendacion {
  let puntaje = 0;
  const razones: string[] = [];

  if (cultivo.tipo === previo.tipo) {
    puntaje += PUNTOS.MISMO_TIPO;
    razones.push(`es del mismo tipo que el ${previo.nombre.split(" (")[0].toLowerCase()} (${cultivo.tipo})`);
  } else {
    razones.push("rompe el ciclo de monocultivo");
  }

  if (escenario === "la_nina") {
    puntaje += PUNTOS.AGUA_LA_NINA[cultivo.demanda_agua];
    razones.push(`demanda de agua ${cultivo.demanda_agua} ante el déficit de La Niña`);
  }
  if (escenario === "el_nino") {
    razones.push("tolera el encharcamiento de El Niño");
  }

  if (cultivo.fija_nitrogeno) {
    puntaje += escenario === "neutro" ? PUNTOS.FIJA_N_NEUTRO : PUNTOS.FIJA_N_OTRO;
    razones.push(`fija nitrógeno: ahorra ${cultivo.ahorro_urea_ha} USD/ha en urea`);
  }

  return {
    id: cultivo.id,
    nombre: cultivo.nombre,
    puntaje,
    valor_estimado_ha: cultivo.ingreso_bruto_ha + cultivo.ahorro_urea_ha,
    ahorro_urea_ha: cultivo.ahorro_urea_ha,
    ingreso_bruto_ha: cultivo.ingreso_bruto_ha,
    dias_ciclo: cultivo.dias_ciclo,
    razones,
  };
}

// ------------------------------------------------------------ compararEscenarios

export interface ComparacionEscenario extends ResumenCanton {
  /** Diferencias frente al escenario Neutro (0 en el propio Neutro). */
  diferencia: {
    temp_max_c: number;
    lluvia_mm_mes: number;
    humedad_raiz: number;
    rendimiento_predicho_rf: number;
  };
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

/** Cómo cambia el mismo mes en Neutro, El Niño y La Niña. */
export function compararEscenarios(
  paquete: PaqueteCanton,
  cantonId: string,
  mes: number,
): ComparacionEscenario[] {
  const base = resumenCanton(paquete, cantonId, "neutro", mes);
  return ESCENARIOS.map((escenario) => {
    const resumen = resumenCanton(paquete, cantonId, escenario, mes);
    return {
      ...resumen,
      diferencia: {
        temp_max_c: redondear(resumen.temp_max_c - base.temp_max_c),
        lluvia_mm_mes: redondear(resumen.lluvia_mm_mes - base.lluvia_mm_mes),
        humedad_raiz: redondear(resumen.humedad_raiz - base.humedad_raiz),
        rendimiento_predicho_rf: redondear(
          resumen.rendimiento_predicho_rf - base.rendimiento_predicho_rf,
        ),
      },
    };
  });
}
