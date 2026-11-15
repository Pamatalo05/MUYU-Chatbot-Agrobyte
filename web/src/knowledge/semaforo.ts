import { humedadVentana, VENTANA_MESES } from "./kallpaConocimiento";
import type { MuyuContexto } from "./contexto";
import type { PaqueteCanton } from "./types";

export type ColorSemaforo = "verde" | "amarillo" | "rojo";

export interface Semaforo {
  color: ColorSemaforo;
  /** Frase corta para la etiqueta y para que Muyu la diga. */
  motivo: string;
}

/**
 * Umbrales de humedad del suelo en la raíz (0 a 1) para sembrar sin riego.
 * Acordar con el equipo de datos; están aquí para cambiarlos en un solo lugar.
 */
export const UMBRALES_HUMEDAD = {
  /** Desde aquí, riesgo alto de encharcamiento. */
  EXCESO_ROJO: 0.85,
  EXCESO_AMARILLO: 0.8,
  /** Hasta aquí, suelo muy seco: sin riego la siembra es riesgosa. */
  SECO_ROJO: 0.52,
  SECO_AMARILLO: 0.58,
} as const;

const pct = (valor: number) => `${Math.round(valor * 100)} %`;

/**
 * Riesgo de sembrar ahora: humedad en raíz que predice el modelo de ML para los
 * próximos 3 meses en el escenario elegido.
 */
export function evaluarSemaforo(paquete: PaqueteCanton, contexto: MuyuContexto): Semaforo {
  const { cantonId, escenario, mes } = contexto;
  const humedad = humedadVentana(paquete, cantonId, escenario, mes);
  const detalle = `humedad del suelo de ${pct(humedad)} en los próximos ${VENTANA_MESES} meses`;
  const u = UMBRALES_HUMEDAD;

  if (humedad >= u.EXCESO_ROJO) return { color: "rojo", motivo: `riesgo de encharcamiento (${detalle})` };
  if (humedad <= u.SECO_ROJO) return { color: "rojo", motivo: `suelo muy seco, sin riego es riesgoso (${detalle})` };
  if (humedad >= u.EXCESO_AMARILLO) return { color: "amarillo", motivo: `suelo muy húmedo (${detalle})` };
  if (humedad <= u.SECO_AMARILLO) return { color: "amarillo", motivo: `suelo algo seco, ten riego a mano (${detalle})` };
  return { color: "verde", motivo: detalle };
}
