import { nombreRegion, recomendarRotacion } from "./kallpaConocimiento";
import type { MuyuContexto } from "./contexto";
import { ESCENARIO_NOMBRE, type PaqueteCanton } from "./types";

export type ColorSemaforo = "verde" | "amarillo" | "rojo";

export interface Semaforo {
  color: ColorSemaforo;
  /** Frase corta para la etiqueta y para que Muyu la diga. */
  motivo: string;
}

/** Cambio de lluvia (en %) desde el que el riesgo es alto. */
export const CAMBIO_LLUVIA_ROJO_PCT = 35;

/**
 * Riesgo de sembrar ahora en el cantón, con dos señales del paquete:
 *  - lluvia de los próximos 3 meses frente a Neutro (balance hídrico);
 *  - cuántos cultivos de la zona siguen siendo viables tras el cultivo cosechado.
 * Rojo: cambio de lluvia ≥ 35 % o ningún cultivo viable.
 * Amarillo: hay riesgo de sequía o exceso, o quedan menos de 3 opciones.
 * Verde: lluvias cercanas a lo normal y opciones suficientes.
 */
export function evaluarSemaforo(paquete: PaqueteCanton, contexto: MuyuContexto): Semaforo {
  const { balance, recomendaciones } = recomendarRotacion(paquete, contexto);
  const escenario = ESCENARIO_NOMBRE[contexto.escenario];
  const cambio = Math.abs(balance.cambio_pct);
  const lluvia = `${balance.cambio_pct > 0 ? "+" : ""}${balance.cambio_pct} % frente a un año Neutro`;

  if (recomendaciones.length === 0) {
    const zona = nombreRegion(paquete.cantones[contexto.cantonId].region);
    return { color: "rojo", motivo: `ningún cultivo de la ${zona} es viable con ${escenario}` };
  }
  if (balance.balance !== "normal") {
    const riesgo = balance.balance === "exceso" ? "exceso de lluvia" : "sequía";
    return cambio >= CAMBIO_LLUVIA_ROJO_PCT
      ? { color: "rojo", motivo: `${riesgo} (${lluvia})` }
      : { color: "amarillo", motivo: `${riesgo} (${lluvia})` };
  }
  if (recomendaciones.length < 3) {
    return { color: "amarillo", motivo: `solo ${recomendaciones.length} cultivo(s) viables con ${escenario}` };
  }
  return { color: "verde", motivo: `lluvia cercana a lo normal (${lluvia})` };
}
