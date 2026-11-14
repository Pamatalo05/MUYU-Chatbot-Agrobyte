
import datos from "../../public/datos/paquete_canton.json";
import datosNuevos from "../../public/datos/nuevo/paquete_canton.json";

import { validarPaquete } from "../knowledge/validarPaquete";
import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";

import {
  AgenteError,
  conversar,
  MODELOS_GEMINI,
} from "./agente";

import {
  PeticionInvalidaError,
  validarPeticion,
} from "./peticion";

/**
 * Lógica del endpoint POST /api/chat.
 *
 * Utiliza:
 * - Paquete original: compatibilidad con Muyu.
 * - Paquete nuevo: predicciones ML y rotaciones de Kallpa.
 *
 * Solo se ejecuta en el servidor.
 */

export interface EntornoServidor {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface RespuestaHttp {
  status: number;
  cuerpo: unknown;
}

// Datos originales
const paquete = validarPaquete(datos);

// Datos nuevos de Kallpa
const paqueteNuevo = datosNuevos as PaqueteKallpa;

export const MAX_BYTES = 16_000;

export async function manejarChat(
  cuerpo: string,
  entorno: EntornoServidor,
  fetchImpl: typeof fetch = fetch
): Promise<RespuestaHttp> {
  const apiKey = entorno.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return {
      status: 500,
      cuerpo: {
        error: "El servidor no tiene GEMINI_API_KEY",
      },
    };
  }

  if (cuerpo.length > MAX_BYTES) {
    return {
      status: 413,
      cuerpo: {
        error: "Petición demasiado grande",
      },
    };
  }

  try {
    const peticion = validarPeticion(
      JSON.parse(cuerpo)
    );

    const modelos = entorno.GEMINI_MODEL
      ? [
          entorno.GEMINI_MODEL,
          ...MODELOS_GEMINI,
        ]
      : MODELOS_GEMINI;

    const respuesta = await conversar(
      peticion,
      {
        apiKey,
        paquete,
        paqueteNuevo,
        modelos,
        fetchImpl,
      }
    );

    return {
      status: 200,
      cuerpo: respuesta,
    };
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof PeticionInvalidaError
    ) {
      return {
        status: 400,
        cuerpo: {
          error: error.message,
        },
      };
    }

    console.error("[api/chat]", error);

    const saturado =
      error instanceof AgenteError &&
      /429|503/.test(error.message);

    if (saturado) {
      return {
        status: 503,
        cuerpo: {
          error:
            "Gemini está ocupado, intenta en un minuto",
        },
      };
    }

    return {
      status: 502,
      cuerpo: {
        error: "Error del agente",
      },
    };
  }
}
