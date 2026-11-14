/** Tipos de public/data/paquete_canton.json (generado por el equipo de Datos/ML). */

export const ESCENARIOS = ["neutro", "el_nino", "la_nina"] as const;
export type Escenario = (typeof ESCENARIOS)[number];

export const ESCENARIO_NOMBRE: Record<Escenario, string> = {
  neutro: "Neutro",
  el_nino: "El Niño",
  la_nina: "La Niña",
};

export type DemandaAgua = "baja" | "media" | "alta";
export type Region = "costa" | "sierra";

export interface MesClima {
  mes: number;
  temp_max_c: number;
  lluvia_mm_mes: number;
  ndvi: number;
  humedad_raiz: number;
  rendimiento_predicho_rf: number;
}

export interface Canton {
  nombre: string;
  suelo_referencia: string;
  altitud_m: number;
  escenarios_climaticos: Record<Escenario, MesClima[]>;
  /** Pendiente en el JSON: necesarios para el pronóstico de Open-Meteo. */
  lat?: number;
  lon?: number;
}

export interface Cultivo {
  id: string;
  nombre: string;
  tipo: string;
  dias_ciclo: number;
  ahorro_urea_ha: number;
  ingreso_bruto_ha: number;
  fija_nitrogeno: boolean;
  demanda_agua: DemandaAgua;
  tolera_encharcamiento: boolean;
  /** Pendiente en el JSON. Si falta, se asume "costa" (todos los actuales lo son). */
  region?: Region;
  /** Pendiente en el JSON: explicación agronómica de 2 líneas. */
  ficha?: string;
}

export interface PaqueteCanton {
  version: string;
  proyecto: string;
  cantones: Record<string, Canton>;
  cultivos: Cultivo[];
}
