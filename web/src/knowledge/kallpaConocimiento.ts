import {
  CLAVE_ML,
  ESCENARIOS,
  ESCENARIO_NOMBRE,
  type Canton,
  type Escenario,
  type MesSatelital,
  type PaqueteCanton,
  type Rotacion,
} from "./types";

/**
 * Motor de conocimiento de Muyu.
 * Funciones puras sobre paquete_canton.json: las usa el modo campo (sin internet)
 * y Gemini como herramientas (con internet), así ambos modos dan las mismas cifras.
 * El orden de rotación es el que define Kallpa por fase ENSO: Muyu no inventa otro.
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

const mesDe = (canton: Canton, mes: number): MesSatelital => {
  validarMes(mes);
  return canton.serie_satelital_ml[mes - 1];
};

const redondear = (valor: number, decimales = 2) => Math.round(valor * 10 ** decimales) / 10 ** decimales;

// ------------------------------------------------------------------- precio urea

/** Precio de referencia por defecto (MAG/SIPA): saco de urea 46 % N de 50 kg. */
const UREA_POR_DEFECTO = { usdSaco: 38, kgSaco: 50 };

/**
 * Lee el precio del saco de urea del texto de fuentes ("saco de Urea 46% N de 50 kg = $38.00").
 * El paquete no lo trae como número; si el texto cambia, se usa la referencia por defecto.
 */
export function precioUrea(paquete: PaqueteCanton): { usdSaco: number; kgSaco: number } {
  const texto = paquete.fuentes_metodologia.economia_insumos ?? "";
  const usd = Number(texto.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1]);
  const kg = Number(texto.match(/de\s*(\d+)\s*kg/i)?.[1]);
  return {
    usdSaco: Number.isFinite(usd) && usd > 0 ? usd : UREA_POR_DEFECTO.usdSaco,
    kgSaco: Number.isFinite(kg) && kg > 0 ? kg : UREA_POR_DEFECTO.kgSaco,
  };
}

// ---------------------------------------------------------------- resumenCanton

export interface ResumenCanton {
  cantonId: string;
  canton: string;
  suelo: string;
  elevacion_msnm: number;
  mes: number;
  escenario: Escenario;
  escenarioNombre: string;
  /** Lluvia típica del mes (2005-2025). */
  lluvia_mm: number;
  /** Temperatura máxima típica del mes. */
  temp_max_c: number;
  ndvi_modis: number;
  humedad_superficial: number;
  /** Humedad en raíz que predice el modelo de ML para ese escenario (0 a 1). */
  humedad_raiz: number;
}

/** Clima típico, verdor y humedad del suelo predicha de un cantón en un mes y escenario. */
export function resumenCanton(paquete: PaqueteCanton, cantonId: string, escenario: Escenario, mes: number): ResumenCanton {
  const canton = obtenerCanton(paquete, cantonId);
  const m = mesDe(canton, mes);
  return {
    cantonId,
    canton: canton.nombre,
    suelo: canton.suelo_referencia,
    elevacion_msnm: Math.round(canton.terreno.elevacion_msnm),
    mes,
    escenario,
    escenarioNombre: ESCENARIO_NOMBRE[escenario],
    lluvia_mm: m.lluvia_mm,
    temp_max_c: m.temp_c,
    ndvi_modis: m.ndvi_modis,
    humedad_superficial: m.smap_humedad_superficial,
    humedad_raiz: m.humedad_raiz_predicha[CLAVE_ML[escenario]],
  };
}

// --------------------------------------------------------------- humedadVentana

/** Meses que dura una siembra típica: el riesgo se evalúa en esa ventana. */
export const VENTANA_MESES = 3;

/** Humedad en raíz promedio (0 a 1) de los próximos 3 meses según el modelo, para un escenario. */
export function humedadVentana(paquete: PaqueteCanton, cantonId: string, escenario: Escenario, mes: number): number {
  validarMes(mes);
  const canton = obtenerCanton(paquete, cantonId);
  const valores = Array.from(
    { length: VENTANA_MESES },
    (_, i) => canton.serie_satelital_ml[(mes - 1 + i) % 12].humedad_raiz_predicha[CLAVE_ML[escenario]],
  );
  return redondear(valores.reduce((a, b) => a + b, 0) / VENTANA_MESES, 3);
}

// ------------------------------------------------------------ recomendarRotacion

export interface ConsultaRotacion {
  cantonId: string;
  escenario: Escenario;
  /** Cuántas recomendaciones devolver. Por defecto 3. */
  limite?: number;
}

export interface Recomendacion {
  id: string;
  nombre: string;
  ciclo_dias: number;
  fijacion_n_kg_ha: number;
  ingreso_bruto_ha: number;
  costo_insumos_ha: number;
  /** Ingreso por vender menos costo de insumos (USD/ha). */
  ganancia_ha: number;
  /** Urea que deja de necesitar el siguiente cultivo. */
  ahorro_urea_kg_ha: number;
  ahorro_urea_sacos: number;
  ahorro_urea_usd: number;
  fuente: string;
}

export interface ResultadoRotacion {
  recomendaciones: Recomendacion[];
}

/** "INIAP Estación Experimental Boliche — Ficha…; FAO…" → "INIAP Estación Experimental Boliche" */
const fuenteCorta = (fuente: string) => fuente.split(/\s+—\s+|;/)[0].trim();

function aRecomendacion(r: Rotacion, urea: { usdSaco: number; kgSaco: number }): Recomendacion {
  const sacos = r.ahorro_urea_kg_ha / urea.kgSaco;
  return {
    id: r.id,
    nombre: r.cultivo,
    ciclo_dias: r.ciclo_dias,
    fijacion_n_kg_ha: r.fijacion_n_kg_ha,
    ingreso_bruto_ha: r.ingreso_bruto_ha,
    costo_insumos_ha: r.costo_insumos_ha,
    ganancia_ha: r.ingreso_bruto_ha - r.costo_insumos_ha,
    ahorro_urea_kg_ha: r.ahorro_urea_kg_ha,
    ahorro_urea_sacos: redondear(sacos, 1),
    ahorro_urea_usd: Math.round(sacos * urea.usdSaco),
    fuente: fuenteCorta(r.fuente_tecnica),
  };
}

/** Cultivos de rotación en el orden que Kallpa recomienda para ese escenario ENSO. */
export function recomendarRotacion(
  paquete: PaqueteCanton,
  { cantonId, escenario, limite = 3 }: ConsultaRotacion,
): ResultadoRotacion {
  const canton = obtenerCanton(paquete, cantonId);
  const urea = precioUrea(paquete);
  return {
    recomendaciones: canton.top_rotaciones_por_enso[CLAVE_ML[escenario]].slice(0, limite).map((r) => aRecomendacion(r, urea)),
  };
}

/** Todos los cultivos de rotación que aparecen en el paquete, sin repetir. */
export function cultivosDelPaquete(paquete: PaqueteCanton): Rotacion[] {
  const vistos = new Map<string, Rotacion>();
  for (const canton of Object.values(paquete.cantones)) {
    for (const lista of Object.values(canton.top_rotaciones_por_enso)) {
      for (const r of lista) if (!vistos.has(r.id)) vistos.set(r.id, r);
    }
  }
  return [...vistos.values()];
}

// ------------------------------------------------------------ compararEscenarios

export interface ComparacionEscenario extends ResumenCanton {
  /** Diferencia de humedad en raíz frente a Neutro, en puntos de 0 a 1 (0 en el propio Neutro). */
  diferencia_humedad: number;
}

/** Cómo cambia la humedad del suelo del mismo mes en Neutro, El Niño y La Niña (modelo de ML). */
export function compararEscenarios(paquete: PaqueteCanton, cantonId: string, mes: number): ComparacionEscenario[] {
  const base = resumenCanton(paquete, cantonId, "neutro", mes);
  return ESCENARIOS.map((escenario) => {
    const r = resumenCanton(paquete, cantonId, escenario, mes);
    return { ...r, diferencia_humedad: redondear(r.humedad_raiz - base.humedad_raiz, 3) };
  });
}
