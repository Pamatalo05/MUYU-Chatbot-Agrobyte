/**
 * Tipos de public/datos/paquete_canton.json. La fuente es el repo Kallpa-AgroByte-2026
 * (datos/procesados), generado por entrenar_modelo_kallpa.py; se copia con `npm run datos`.
 * Solo se tipan los campos que Muyu usa: smap_humedad_superficial y top_rotaciones_ml
 * se ignoran a propósito (ver README, sección Datos).
 */

export const ESCENARIOS = ["neutro", "el_nino", "la_nina"] as const;
export type Escenario = (typeof ESCENARIOS)[number];

export const ESCENARIO_NOMBRE: Record<Escenario, string> = {
  neutro: "Neutro",
  el_nino: "El Niño",
  la_nina: "La Niña",
};

/** El script de ML usa nombres cortos para las mismas fases. */
export type ClaveMl = "neutro" | "nino" | "nina";
export const CLAVE_ML: Record<Escenario, ClaveMl> = { neutro: "neutro", el_nino: "nino", la_nina: "nina" };

export type DemandaAgua = "baja" | "media" | "alta";
/** Piso climático, derivado de la región ("costa_humeda" → "costa"). */
export type Piso = "costa" | "sierra";

/** Promedio de un mes en años de esa fase ENSO (NASA POWER 2005-2025). */
export interface MesClima {
  mes: number;
  lluvia_mm_mes: number;
  humedad_raiz: number;
  humedad_superficial: number;
  temp_max_c: number;
  temp_min_c: number;
  radiacion_mj_m2: number;
  humedad_relativa_pct: number;
}

/** Perfil mensual satelital + predicción del modelo de ML. */
export interface MesSatelital {
  mes: number;
  lluvia_mm: number;
  temp_c: number;
  ndvi_modis: number;
  humedad_raiz_predicha: Record<ClaveMl, number>;
}

export interface Canton {
  nombre: string;
  /** p. ej. "costa_humeda", "costa_seca", "sierra_centro". */
  region: string;
  coordenadas: { lat: number; lon: number };
  terreno: { elevacion_msnm: number; pendiente_srtm_pct: number };
  suelo_referencia: string;
  escenarios_climaticos: Record<Escenario, MesClima[]>;
  serie_satelital_ml: MesSatelital[];
}

export interface Cultivo {
  id: string;
  nombre: string;
  /** Regiones donde se cultiva; se compara con Canton.region. */
  regiones: string[];
  tipo: string;
  dias_ciclo: number;
  demanda_agua: DemandaAgua;
  tolera_encharcamiento: boolean;
  fija_nitrogeno: boolean;
  /** 1 a 5. */
  protege_suelo: number;
  costo_insumos_ha: number;
  ingreso_bruto_ha: number;
  ahorro_urea_ha: number;
  fuente: string;
}

export interface PaqueteCanton {
  meta: { proyecto: string; fuentes_datos: string[]; periodo_analizado: string };
  cantones: Record<string, Canton>;
  cultivos: Cultivo[];
  ml_metadata: { modelo_seleccionado: string; r2_test: number; mae_test: number };
}
