/**
 * Tipos de public/datos/paquete_canton.json. La fuente es el repo Kallpa-AgroByte-2026
 * (datos/procesados), generado por entrenar_modelo_kallpa.py; se copia con `npm run datos`.
 * Versión del paquete: cuenca baja del Guayas (Daule y Babahoyo), 4 cultivos de rotación.
 * `top_rotaciones_ml` se ignora: repite la lista del escenario neutro.
 */

export const ESCENARIOS = ["neutro", "el_nino", "la_nina"] as const;
export type Escenario = (typeof ESCENARIOS)[number];

export const ESCENARIO_NOMBRE: Record<Escenario, string> = {
  neutro: "Neutro",
  el_nino: "El Niño",
  la_nina: "La Niña",
};

/** El paquete usa nombres cortos para las mismas fases. */
export type ClaveMl = "neutro" | "nino" | "nina";
export const CLAVE_ML: Record<Escenario, ClaveMl> = { neutro: "neutro", el_nino: "nino", la_nina: "nina" };

/** Perfil mensual (climatología 2005-2025) + humedad en raíz predicha por el modelo para cada fase ENSO. */
export interface MesSatelital {
  mes: number;
  /** Lluvia típica del mes (no cambia por escenario en este paquete). */
  lluvia_mm: number;
  /** Temperatura máxima típica del mes (el script la llama temp_c). */
  temp_c: number;
  ndvi_modis: number;
  smap_humedad_superficial: number;
  /** Humedad del suelo en la raíz (0 a 1) que predice el modelo de ML. */
  humedad_raiz_predicha: Record<ClaveMl, number>;
}

/** Cultivo de rotación tal como lo recomienda Kallpa. */
export interface Rotacion {
  id: string;
  cultivo: string;
  region: string;
  ciclo_dias: number;
  fijacion_n_kg_ha: number;
  ahorro_urea_kg_ha: number;
  costo_insumos_ha: number;
  ingreso_bruto_ha: number;
  fuente_tecnica: string;
}

export interface Canton {
  nombre: string;
  region: string;
  coordenadas: { lat: number; lon: number };
  terreno: { elevacion_msnm: number; pendiente_srtm_pct: number };
  suelo_referencia: string;
  serie_satelital_ml: MesSatelital[];
  /** Orden de rotación que define Kallpa para cada fase ENSO (fuente única con la app). */
  top_rotaciones_por_enso: Record<ClaveMl, Rotacion[]>;
}

export interface PaqueteCanton {
  meta: { proyecto: string; alcance_geografico: string; periodo_analizado: string };
  ml_metadata: { modelo_seleccionado: string; r2_test: number; mae_test: number };
  fuentes_metodologia: Record<string, string>;
  cantones: Record<string, Canton>;
}
