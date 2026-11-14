import type { MuyuContexto } from "../knowledge/contexto";
import { ESCENARIOS } from "../knowledge/types";

/** Cuerpo de POST /api/chat. Lo comparten el navegador y la Netlify Function. */
export interface PeticionChat {
  pregunta: string;
  historial: { role: "user" | "muyu"; text: string }[];
  contexto: MuyuContexto;
}

export const LIMITES = { PREGUNTA: 500, MENSAJES_HISTORIAL: 6, TEXTO_HISTORIAL: 1000 } as const;

export class PeticionInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeticionInvalidaError";
  }
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

/** Valida lo que llega desde internet antes de gastar cuota de Gemini. */
export function validarPeticion(datos: unknown): PeticionChat {
  if (!esObjeto(datos)) throw new PeticionInvalidaError("El cuerpo debe ser un objeto JSON");

  const pregunta = typeof datos.pregunta === "string" ? datos.pregunta.trim() : "";
  if (!pregunta) throw new PeticionInvalidaError("Falta la pregunta");
  if (pregunta.length > LIMITES.PREGUNTA) {
    throw new PeticionInvalidaError(`La pregunta supera ${LIMITES.PREGUNTA} caracteres`);
  }

  const historialCrudo = Array.isArray(datos.historial) ? datos.historial : [];
  const historial = historialCrudo.slice(-LIMITES.MENSAJES_HISTORIAL).map((mensaje, i): PeticionChat["historial"][number] => {
    if (!esObjeto(mensaje) || (mensaje.role !== "user" && mensaje.role !== "muyu") || typeof mensaje.text !== "string") {
      throw new PeticionInvalidaError(`historial[${i}] no es un mensaje válido`);
    }
    return { role: mensaje.role, text: mensaje.text.slice(0, LIMITES.TEXTO_HISTORIAL) };
  });

  const c = datos.contexto;
  if (
    !esObjeto(c) ||
    typeof c.cantonId !== "string" ||
    typeof c.cultivoPrevioId !== "string" ||
    !(ESCENARIOS as readonly unknown[]).includes(c.escenario) ||
    !Number.isInteger(c.mes) ||
    (c.mes as number) < 1 ||
    (c.mes as number) > 12
  ) {
    throw new PeticionInvalidaError("contexto inválido: se espera cantonId, cultivoPrevioId, escenario y mes 1-12");
  }

  return { pregunta, historial, contexto: c as unknown as MuyuContexto };
}
