import { useEffect, useState } from "react";
import { cargarPaquete } from "./cargarPaquete";
import type { PaqueteCanton } from "./types";
import {
  cargarKallpaNuevo,
  type PaqueteKallpa,
} from "./adaptadorKallpa";
export type EstadoPaquete =
  | { estado: "cargando" }
  | { estado: "listo"; paquete: PaqueteCanton }
  | { estado: "error"; mensaje: string };

/** Carga paquete_canton.json una vez y expone su estado. */
export function usePaquete(): EstadoPaquete {
  const [resultado, setResultado] = useState<EstadoPaquete>({ estado: "cargando" });

  useEffect(() => {
    let activo = true;
    cargarPaquete()
      .then((paquete) => activo && setResultado({ estado: "listo", paquete }))
      .catch((error: unknown) =>
        activo &&
        setResultado({
          estado: "error",
          mensaje: error instanceof Error ? error.message : "No se pudo cargar el paquete de datos",
        }),
      );
    return () => {
      activo = false;
    };
  }, []);

  return resultado;
}
export function usePaqueteNuevo(): PaqueteKallpa | null {
  const [paqueteNuevo, setPaqueteNuevo] =
    useState<PaqueteKallpa | null>(null);

  useEffect(() => {
    let activo = true;

    cargarKallpaNuevo()
      .then((datos) => {
        if (activo) setPaqueteNuevo(datos);
      })
      .catch((error) => {
        console.warn(
          "[Muyu] No se pudieron cargar los datos nuevos:",
          error
        );
      });

    return () => {
      activo = false;
    };
  }, []);

  return paqueteNuevo;
}