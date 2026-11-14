import type { Escenario } from "./types";

/**
 * Lo que Muyu sabe de la situación del agricultor.
 * En Kallpa lo entregará la app (cantón del mapa, cultivo cosechado, botón ENSO) — K5.
 */
export interface MuyuContexto {
  cantonId: string;
  cultivoPrevioId: string;
  escenario: Escenario;
  /** 1 a 12 */
  mes: number;
}

export const CONTEXTO_INICIAL: MuyuContexto = {
  cantonId: "daule", // la propuesta precarga Daule al abrir
  cultivoPrevioId: "arroz",
  escenario: "neutro",
  mes: new Date().getMonth() + 1,
};
