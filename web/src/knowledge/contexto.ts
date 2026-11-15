import type { Escenario } from "./types";

/** Lo que Muyu sabe de la situación del agricultor (en Kallpa lo entrega la app). */
export interface MuyuContexto {
  cantonId: string;
  cultivoPrevioId: string;
  escenario: Escenario;
  /** 1 a 12 */
  mes: number;
}

/**
 * Cultivos que se acaban de cosechar. El paquete no los lista: Kallpa trabaja la
 * rotación en la llanura arrocera y maicera de la cuenca baja del Guayas.
 */
export const CULTIVOS_PREVIOS = [
  { id: "arroz", nombre: "Arroz" },
  { id: "maiz_duro", nombre: "Maíz duro" },
] as const;

export const nombrePrevio = (id: string) =>
  CULTIVOS_PREVIOS.find((c) => c.id === id)?.nombre.toLowerCase() ?? id.replace("_", " ");

export const CONTEXTO_INICIAL: MuyuContexto = {
  cantonId: "daule", // la propuesta precarga Daule al abrir
  cultivoPrevioId: "arroz",
  escenario: "neutro",
  mes: new Date().getMonth() + 1,
};
