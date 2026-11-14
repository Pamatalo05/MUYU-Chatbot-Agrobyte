import { useEffect, useState } from "react";
import { cargarPaquete } from "./cargarPaquete";
import type { PaqueteCanton } from "./types";

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
