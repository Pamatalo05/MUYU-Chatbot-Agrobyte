import type { PaqueteCanton } from "./types";
import { validarPaquete } from "./validarPaquete";

/** Ruta pública del paquete (la PWA lo deja en caché para uso sin internet). */
export const RUTA_PAQUETE = "/datos/paquete_canton.json";

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
