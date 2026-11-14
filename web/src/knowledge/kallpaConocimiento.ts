import {
  CLAVE_ML,
  ESCENARIOS,
  ESCENARIO_NOMBRE,
  type Canton,
  type Cultivo,
  type Escenario,
  type MesClima,
  type PaqueteCanton,
  type Piso,
} from "./types";

/**
 * Motor de conocimiento de Muyu.
 * Funciones puras sobre paquete_canton.json: las usa el modo campo (sin internet)
 * y Gemini como herramientas (con internet), así ambos modos dan las mismas cifras.
 */

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

function validarMes(mes: number): void {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new ConsultaInvalidaError(`Mes ${mes} inválido: debe estar entre 1 y 12`);
  }
}

function obtenerMes(canton: Canton, escenario: Escenario, mes: number): MesClima {
  validarMes(mes);
  return canton.escenarios_climaticos[escenario][mes - 1];
}

export const pisoDeRegion = (region: string): Piso => (region.startsWith("sierra") ? "sierra" : "costa");

/** "costa_humeda" → "costa húmeda" */
export const nombreRegion = (region: string) =>
  region.replace("_", " ").replace("humeda", "húmeda");

const redondear = (valor: number, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

// ---------------------------------------------------------------- resumenCanton

export interface ResumenCanton extends MesClima {
  cantonId: string;
  canton: string;
  suelo: string;
  elevacion_msnm: number;
  region: string;
  piso: Piso;
  escenario: Escenario;
  escenarioNombre: string;
  /** Verdor medido por MODIS en ese mes (0 a 1). */
  ndvi_modis: number;
  /** Humedad en raíz que predice el modelo de ML para ese escenario. */
  humedad_raiz_ml: number;
}

/** Clima, humedad, verdor y predicción de ML de un cantón en un mes y escenario. */
export function resumenCanton(
  paquete: PaqueteCanton,
  cantonId: string,
  escenario: Escenario,
  mes: number,
): ResumenCanton {
  const canton = obtenerCanton(paquete, cantonId);
  const satelital = canton.serie_satelital_ml[mes - 1];
  return {
    ...obtenerMes(canton, escenario, mes),
    cantonId,
    canton: canton.nombre,
    suelo: canton.suelo_referencia,
    elevacion_msnm: Math.round(canton.terreno.elevacion_msnm),
    region: canton.region,
    piso: pisoDeRegion(canton.region),
    escenario,
    escenarioNombre: ESCENARIO_NOMBRE[escenario],
    ndvi_modis: satelital.ndvi_modis,
    humedad_raiz_ml: satelital.humedad_raiz_predicha[CLAVE_ML[escenario]],
  };
}

// --------------------------------------------------------------- balanceHidrico

/** Meses que dura una siembra típica: el agua se evalúa en esa ventana. */
const VENTANA_MESES = 3;
const UMBRAL = {
  /** +20 % y al menos 50 mm más que en Neutro: riesgo de encharcamiento. */
  EXCESO: { relativo: 1.2, mm: 50 },
  /** −20 % y al menos 30 mm menos que en Neutro: riesgo de sequía. */
  DEFICIT: { relativo: 0.8, mm: 30 },
} as const;

export type Balance = "exceso" | "deficit" | "normal";

export interface BalanceHidrico {
  balance: Balance;
  lluvia_ventana_mm: number;
  lluvia_ventana_neutro_mm: number;
  /** Cambio frente a Neutro, en %. */
  cambio_pct: number;
}

/**
 * Lluvia de los próximos 3 meses frente a un año Neutro, con los datos del propio cantón.
 * No se asume que El Niño siempre trae más lluvia: en la Sierra muchas veces no es así.
 */
export function balanceHidrico(
  paquete: PaqueteCanton,
  cantonId: string,
  escenario: Escenario,
  mes: number,
): BalanceHidrico {
  validarMes(mes);
  const canton = obtenerCanton(paquete, cantonId);
  const lluvia = (e: Escenario) =>
    Array.from({ length: VENTANA_MESES }, (_, i) => canton.escenarios_climaticos[e][(mes - 1 + i) % 12])
      .reduce((total, m) => total + m.lluvia_mm_mes, 0);

  const actual = lluvia(escenario);
  const neutro = lluvia("neutro");
  const diferencia = actual - neutro;
  let balance: Balance = "normal";
  if (actual >= neutro * UMBRAL.EXCESO.relativo && diferencia >= UMBRAL.EXCESO.mm) balance = "exceso";
  else if (actual <= neutro * UMBRAL.DEFICIT.relativo && -diferencia >= UMBRAL.DEFICIT.mm) balance = "deficit";

  return {
    balance,
    lluvia_ventana_mm: Math.round(actual),
    lluvia_ventana_neutro_mm: Math.round(neutro),
    cambio_pct: neutro === 0 ? 0 : Math.round((diferencia / neutro) * 100),
  };
}

// ------------------------------------------------------------ recomendarRotacion

export interface ConsultaRotacion {
  cantonId: string;
  cultivoPrevioId: string;
  escenario: Escenario;
  /** Mes de siembra (1-12): define la ventana de lluvia que se evalúa. */
  mes: number;
  /** Cuántas recomendaciones devolver. Por defecto 3. */
  limite?: number;
}

export interface Recomendacion {
  id: string;
  nombre: string;
  puntaje: number;
  /** ingreso − costo de insumos + ahorro en urea (USD/ha). */
  margen_neto_ha: number;
  ingreso_bruto_ha: number;
  costo_insumos_ha: number;
  ahorro_urea_ha: number;
  dias_ciclo: number;
  fuente: string;
  razones: string[];
}

export interface ResultadoRotacion {
  balance: BalanceHidrico;
  recomendaciones: Recomendacion[];
  descartados: { id: string; motivo: string }[];
  avisos: string[];
}

const PUNTOS = {
  MISMO_TIPO: -3,
  AGUA_DEFICIT: { baja: 3, media: 0, alta: -3 },
  FIJA_N_NORMAL: 2,
  FIJA_N_OTRO: 1,
} as const;

/**
 * Top de rotaciones tras el cultivo cosechado, con las reglas de la propuesta Kallpa:
 *  1. Ruptura de monocultivo: descarta el mismo cultivo y penaliza el mismo tipo.
 *  2. Zona: solo cultivos de la región del cantón (costa húmeda, seca, sierra…).
 *  3. Balance hídrico de los próximos 3 meses en ese escenario: con exceso de lluvia
 *     descarta los que no toleran encharcamiento; con déficit prioriza baja demanda
 *     de agua; en condiciones normales prioriza leguminosas.
 *  4. Desempate económico: mayor margen neto por hectárea.
 */
export function recomendarRotacion(
  paquete: PaqueteCanton,
  { cantonId, cultivoPrevioId, escenario, mes, limite = 3 }: ConsultaRotacion,
): ResultadoRotacion {
  const canton = obtenerCanton(paquete, cantonId);
  const previo = paquete.cultivos.find((cultivo) => cultivo.id === cultivoPrevioId);
  if (!previo) {
    const disponibles = paquete.cultivos.map((cultivo) => cultivo.id).join(", ");
    throw new ConsultaInvalidaError(`Cultivo "${cultivoPrevioId}" no existe. Disponibles: ${disponibles}`);
  }

  const balance = balanceHidrico(paquete, cantonId, escenario, mes);
  const descartados: ResultadoRotacion["descartados"] = [];
  const candidatos: Recomendacion[] = [];

  for (const cultivo of paquete.cultivos) {
    const motivo = motivoDeDescarte(cultivo, previo, canton.region, balance.balance);
    if (motivo) descartados.push({ id: cultivo.id, motivo });
    else candidatos.push(puntuar(cultivo, previo, balance));
  }

  candidatos.sort((a, b) => b.puntaje - a.puntaje || b.margen_neto_ha - a.margen_neto_ha);

  const avisos: string[] = [];
  if (candidatos.length < limite) {
    avisos.push(
      candidatos.length === 0
        ? `No hay cultivos del paquete para la ${nombreRegion(canton.region)} con ${ESCENARIO_NOMBRE[escenario]}.`
        : `Solo ${candidatos.length} cultivo(s) cumplen las condiciones de ${ESCENARIO_NOMBRE[escenario]}.`,
    );
  }

  return { balance, recomendaciones: candidatos.slice(0, limite), descartados, avisos };
}

function motivoDeDescarte(cultivo: Cultivo, previo: Cultivo, region: string, balance: Balance): string | null {
  if (cultivo.id === previo.id) return "repetiría el mismo cultivo (monocultivo)";
  if (!cultivo.regiones.includes(region)) return `no se cultiva en la ${nombreRegion(region)}`;
  if (balance === "exceso" && !cultivo.tolera_encharcamiento) {
    return "no tolera el exceso de lluvia previsto (riesgo de pudrición radicular)";
  }
  return null;
}

function puntuar(cultivo: Cultivo, previo: Cultivo, balance: BalanceHidrico): Recomendacion {
  let puntaje = 0;
  const razones: string[] = [];

  if (cultivo.tipo === previo.tipo) {
    puntaje += PUNTOS.MISMO_TIPO;
    razones.push(`es del mismo tipo que el cultivo anterior (${cultivo.tipo})`);
  } else {
    razones.push("rompe el ciclo de monocultivo");
  }

  if (balance.balance === "deficit") {
    puntaje += PUNTOS.AGUA_DEFICIT[cultivo.demanda_agua];
    if (cultivo.demanda_agua === "baja") {
      razones.push(`necesita poca agua y se espera ${Math.abs(balance.cambio_pct)} % menos lluvia`);
    }
  } else if (balance.balance === "exceso") {
    razones.push(`tolera el encharcamiento y se espera ${balance.cambio_pct} % más lluvia`);
  }

  if (cultivo.fija_nitrogeno) {
    puntaje += balance.balance === "normal" ? PUNTOS.FIJA_N_NORMAL : PUNTOS.FIJA_N_OTRO;
    razones.push(`fija nitrógeno: ahorra ${cultivo.ahorro_urea_ha} USD/ha en urea`);
  }

  return {
    id: cultivo.id,
    nombre: cultivo.nombre,
    puntaje,
    margen_neto_ha: cultivo.ingreso_bruto_ha - cultivo.costo_insumos_ha + cultivo.ahorro_urea_ha,
    ingreso_bruto_ha: cultivo.ingreso_bruto_ha,
    costo_insumos_ha: cultivo.costo_insumos_ha,
    ahorro_urea_ha: cultivo.ahorro_urea_ha,
    dias_ciclo: cultivo.dias_ciclo,
    fuente: cultivo.fuente,
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
    humedad_raiz_ml: number;
  };
}

/** Cómo cambia el mismo mes en Neutro, El Niño y La Niña. */
export function compararEscenarios(
  paquete: PaqueteCanton,
  cantonId: string,
  mes: number,
): ComparacionEscenario[] {
  const base = resumenCanton(paquete, cantonId, "neutro", mes);
  return ESCENARIOS.map((escenario) => {
    const r = resumenCanton(paquete, cantonId, escenario, mes);
    return {
      ...r,
      diferencia: {
        temp_max_c: redondear(r.temp_max_c - base.temp_max_c),
        lluvia_mm_mes: redondear(r.lluvia_mm_mes - base.lluvia_mm_mes),
        humedad_raiz: redondear(r.humedad_raiz - base.humedad_raiz),
        humedad_raiz_ml: redondear(r.humedad_raiz_ml - base.humedad_raiz_ml, 3),
      },
    };
  });
}
