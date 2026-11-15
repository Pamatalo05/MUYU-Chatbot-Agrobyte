import {
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
} from "../knowledge/kallpaConocimiento";

import { evaluarSemaforo } from "../knowledge/semaforo";

import {
  ESCENARIOS,
  type Escenario,
  type PaqueteCanton,
} from "../knowledge/types";

import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";

import { consultarKallpaML } from "./herramientaKallpaNueva";

/**
 * Declaración de una herramienta para Gemini.
 */
export interface DeclaracionHerramienta {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<
      string,
      {
        type: "STRING" | "INTEGER";
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

export type NombreHerramienta =
  | "resumen_canton"
  | "recomendar_rotacion"
  | "comparar_escenarios"
  | "consultar_kallpa_ml";

/**
 * Herramientas disponibles para Gemini.
 *
 * Las herramientas anteriores siguen funcionando.
 * La nueva herramienta se agrega únicamente cuando
 * tenemos disponible el paquete actualizado de Kallpa.
 */
export function declararHerramientas(
  paquete: PaqueteCanton,
  paqueteNuevo?: PaqueteKallpa
): DeclaracionHerramienta[] {
  const canton = {
    type: "STRING" as const,
    description: "Id del cantón",
    enum: Object.keys(paquete.cantones),
  };

  const escenario = {
    type: "STRING" as const,
    description: "Escenario climático ENSO",
    enum: [...ESCENARIOS],
  };

  const mes = {
    type: "INTEGER" as const,
    description: "Mes del año, de 1 (enero) a 12 (diciembre)",
  };

  const herramientaNueva: DeclaracionHerramienta = {
    name: "consultar_kallpa_ml",
    description:
      "Consulta los datos actualizados de Kallpa para Daule y Babahoyo: " +
      "lluvia mensual, temperatura, NDVI, humedad superficial SMAP, " +
      "humedad de raíz predicha por escenario ENSO y rotaciones agrícolas. " +
      "El ahorro de urea se expresa en kg/ha. " +
      "El margen económico calculado es parcial, no ganancia neta.",
    parameters: {
      type: "OBJECT",
      properties: {
        canton_id: {
          type: "STRING",
          description: "Cantón con datos actualizados",
          enum: Object.keys(paqueteNuevo?.cantones ?? {}),
        },
        escenario: {
          type: "STRING",
          description: "Escenario climático ENSO",
          enum: ["neutro", "nino", "nina"],
        },
        mes: {
          type: "INTEGER",
          description: "Mes del año, entre 1 y 12",
        },
      },
      required: ["canton_id", "escenario", "mes"],
    },
  };
    if (
    paqueteNuevo &&
    Object.keys(paqueteNuevo.cantones).length > 0
  ) {
    return [herramientaNueva];
  }
  return [
    {
      name: "resumen_canton",
      description:
        "Clima, temperatura, lluvia, humedad de raíz, " +
        "NDVI y humedad predicha de un cantón en un mes y escenario.",
      parameters: {
        type: "OBJECT",
        properties: {
          canton_id: canton,
          escenario,
          mes,
        },
        required: ["canton_id", "escenario", "mes"],
      },
    },

    {
      name: "recomendar_rotacion",
      description:
        "Recomienda cultivos después de una cosecha, " +
        "usando los datos del paquete anterior. " +
        "Incluye información económica, balance hídrico " +
        "y semáforo de riesgo.",
      parameters: {
        type: "OBJECT",
        properties: {
          canton_id: canton,
          cultivo_previo_id: {
            type: "STRING",
            description: "Id del cultivo recién cosechado",
            enum: paquete.cultivos.map(
              (cultivo) => cultivo.id
            ),
          },
          escenario,
          mes,
        },
        required: [
          "canton_id",
          "cultivo_previo_id",
          "escenario",
          "mes",
        ],
      },
    },

    {
      name: "comparar_escenarios",
      description:
        "Compara los escenarios Neutro, El Niño y La Niña " +
        "utilizando los datos del paquete anterior.",
      parameters: {
        type: "OBJECT",
        properties: {
          canton_id: canton,
          mes,
        },
        required: ["canton_id", "mes"],
      },
    },

    ...(paqueteNuevo ? [herramientaNueva] : []),
  ];
}

/**
 * Convierte un argumento desconocido en texto.
 */
const texto = (valor: unknown): string =>
  typeof valor === "string" ? valor : "";

/**
 * Comprueba los escenarios del paquete anterior.
 */
const esEscenario = (
  valor: unknown
): valor is Escenario =>
  typeof valor === "string" &&
  (ESCENARIOS as readonly string[]).includes(valor);

/**
 * Ejecuta la herramienta solicitada por Gemini.
 *
 * Las herramientas anteriores utilizan el paquete original.
 * consultar_kallpa_ml utiliza el paquete actualizado.
 *
 * Si ocurre un error, se devuelve un objeto con "error".
 */
export function ejecutarHerramienta(
  paquete: PaqueteCanton,
  nombre: string,
  args: Record<string, unknown>,
  paqueteNuevo?: PaqueteKallpa
): Record<string, unknown> {
  try {
    const cantonId = texto(args.canton_id);
    const mes = Number(args.mes);

    // Evita consultar fuentes antiguas cuando existen
    // datos actualizados para el cantón solicitado.
    if (
      paqueteNuevo?.cantones[cantonId] &&
      nombre !== "consultar_kallpa_ml"
    ) {
      return {
        error:
          "Este cantón tiene datos actualizados. " +
          "Utiliza consultar_kallpa_ml.",
      };
    }


    switch (nombre as NombreHerramienta) {
      case "resumen_canton": {
        if (!esEscenario(args.escenario)) {
          return { error: "Escenario inválido" };
        }

        return {
          ...resumenCanton(
            paquete,
            cantonId,
            args.escenario,
            mes
          ),
        };
      }

      case "recomendar_rotacion": {
        if (!esEscenario(args.escenario)) {
          return { error: "Escenario inválido" };
        }

        const consulta = {
          cantonId,
          cultivoPrevioId: texto(args.cultivo_previo_id),
          escenario: args.escenario,
          mes,
        };

        return {
          ...recomendarRotacion(paquete, consulta),
          semaforo: evaluarSemaforo(paquete, consulta),
        };
      }

      case "comparar_escenarios": {
        return {
          escenarios: compararEscenarios(
            paquete,
            cantonId,
            mes
          ),
        };
      }

      case "consultar_kallpa_ml": {
        if (!paqueteNuevo) {
          return {
            error:
              "Los datos actualizados de Kallpa no están disponibles",
          };
        }

        return consultarKallpaML(paqueteNuevo, args);
      }

      default: {
        return {
          error: `La herramienta "${nombre}" no existe`,
        };
      }
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Consulta inválida",
    };
  }
}