import type { PaqueteCanton } from "./types";
import { validarPaquete } from "./validarPaquete";

/**
 * Ruta del paquete. En la web va en /datos/; dentro de Kallpa se lee el MISMO archivo
 * que usa la app Android (assets/datos/), así hay una sola fuente de datos.
 */
export const RUTA_PAQUETE =
  import.meta.env.MODE === "kallpa" ? "../datos/paquete_canton.json" : `${import.meta.env.BASE_URL}datos/paquete_canton.json`;

let enCache: Promise<PaqueteCanton> | null = null;

/** Descarga y valida el paquete una sola vez por sesión. */
export function cargarPaquete(ruta: string = RUTA_PAQUETE): Promise<PaqueteCanton> {
  if (!enCache) {
    enCache = fetch(ruta)
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${respuesta.status})`);
        return respuesta.json() as Promise<unknown>;
      })
      .then(validarPaquete)
      .catch((error: unknown) => {
        enCache = null; // permite reintentar
        throw error;
      });
  }
  return enCache;
}
