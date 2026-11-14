import { compararEscenarios, recomendarRotacion, resumenCanton } from "../knowledge/kallpaConocimiento";
import { evaluarSemaforo } from "../knowledge/semaforo";
import { ESCENARIOS, type Escenario, type PaqueteCanton } from "../knowledge/types";

/** Declaración de una herramienta en el formato de Gemini (function calling). */
export interface DeclaracionHerramienta {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, { type: "STRING" | "INTEGER"; description: string; enum?: string[] }>;
    required: string[];
  };
}

export type NombreHerramienta = "resumen_canton" | "recomendar_rotacion" | "comparar_escenarios";

/**
 * Las herramientas que Gemini puede pedir. Son las mismas funciones del modo campo (K1),
 * así Muyu da las mismas cifras con o sin internet. Los `enum` salen del paquete para que
 * el modelo no invente cantones ni cultivos.
 */
export function declararHerramientas(paquete: PaqueteCanton): DeclaracionHerramienta[] {
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
  const mes = { type: "INTEGER" as const, description: "Mes del año, de 1 (enero) a 12 (diciembre)" };

  return [
    {
      name: "resumen_canton",
      description: "Lluvia y temperatura máxima típicas del mes, verdor NDVI y humedad del suelo en la raíz que predice el modelo ML para ese escenario.",
      parameters: { type: "OBJECT", properties: { canton_id: canton, escenario, mes }, required: ["canton_id", "escenario", "mes"] },
    },
    {
      name: "recomendar_rotacion",
      description:
        "Cultivos de rotación en el orden que recomienda Kallpa para ese escenario ENSO, con ganancia por hectárea, " +
        "nitrógeno que fijan, ahorro de urea en kg, sacos y USD, fuente, y el semáforo de riesgo para sembrar en ese mes.",
      parameters: {
        type: "OBJECT",
        properties: { canton_id: canton, escenario, mes },
        required: ["canton_id", "escenario", "mes"],
      },
    },
    {
      name: "comparar_escenarios",
      description: "Compara la humedad del suelo en la raíz del mismo mes en Neutro, El Niño y La Niña (modelo ML).",
      parameters: { type: "OBJECT", properties: { canton_id: canton, mes }, required: ["canton_id", "mes"] },
    },
  ];
}

const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
const esEscenario = (valor: unknown): valor is Escenario =>
  typeof valor === "string" && (ESCENARIOS as readonly string[]).includes(valor);

/**
 * Ejecuta la herramienta que pidió Gemini. Nunca lanza: si los argumentos no sirven
 * devuelve `{ error }` para que el modelo se corrija o lo explique.
 */
export function ejecutarHerramienta(
  paquete: PaqueteCanton,
  nombre: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const cantonId = texto(args.canton_id);
    const mes = Number(args.mes);
    switch (nombre as NombreHerramienta) {
      case "resumen_canton":
        if (!esEscenario(args.escenario)) return { error: "escenario inválido" };
        return { ...resumenCanton(paquete, cantonId, args.escenario, mes) };
      case "recomendar_rotacion": {
        if (!esEscenario(args.escenario)) return { error: "escenario inválido" };
        const consulta = { cantonId, cultivoPrevioId: "", escenario: args.escenario, mes };
        return { ...recomendarRotacion(paquete, consulta), semaforo: evaluarSemaforo(paquete, consulta) };
      }
      case "comparar_escenarios":
        return { escenarios: compararEscenarios(paquete, cantonId, mes) };
      default:
        return { error: `La herramienta "${nombre}" no existe` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Consulta inválida" };
  }
}
