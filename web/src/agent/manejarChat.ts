import datos from "../../public/datos/paquete_canton.json";
import { validarPaquete } from "../knowledge/validarPaquete";
import { AgenteError, conversar, MODELOS_GEMINI } from "./agente";
import { PeticionInvalidaError, validarPeticion } from "./peticion";

/**
 * Lógica de POST /api/chat, sin depender del servidor: la usan la Netlify Function
 * (producción) y el plugin de Vite (npm run dev). Solo corre en el servidor.
 */

export interface EntornoServidor {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface RespuestaHttp {
  status: number;
  cuerpo: unknown;
}

const paquete = validarPaquete(datos);
export const MAX_BYTES = 16_000;

export async function manejarChat(
  cuerpo: string,
  entorno: EntornoServidor,
  fetchImpl: typeof fetch = fetch,
): Promise<RespuestaHttp> {
  const apiKey = entorno.GEMINI_API_KEY?.trim();
  if (!apiKey) return { status: 500, cuerpo: { error: "El servidor no tiene GEMINI_API_KEY" } };
  if (cuerpo.length > MAX_BYTES) return { status: 413, cuerpo: { error: "Petición demasiado grande" } };

  try {
    const peticion = validarPeticion(JSON.parse(cuerpo));
    const modelos = entorno.GEMINI_MODEL ? [entorno.GEMINI_MODEL, ...MODELOS_GEMINI] : MODELOS_GEMINI;
    return { status: 200, cuerpo: await conversar(peticion, { apiKey, paquete, modelos, fetchImpl }) };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof PeticionInvalidaError) {
      return { status: 400, cuerpo: { error: error.message } };
    }
    // El detalle va al log del servidor, no al usuario.
    console.error("[api/chat]", error);
    const saturado = error instanceof AgenteError && /429|503/.test(error.message);
    return saturado
      ? { status: 503, cuerpo: { error: "Gemini está ocupado, intenta en un minuto" } }
      : { status: 502, cuerpo: { error: "Error del agente" } };
  }
}
