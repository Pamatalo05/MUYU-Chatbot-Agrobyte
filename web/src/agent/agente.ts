
import type { ChatReply } from "../chat/types";

import {
  ESCENARIO_NOMBRE,
  type PaqueteCanton,
} from "../knowledge/types";

import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";

import {
  esFueraDeTema,
  esTemaVetado,
  pareceManipulacion,
  reglasDeAlcance,
  respuestaFueraDeTema,
} from "./guardarrailes";

import {
  declararHerramientas,
  ejecutarHerramienta,
} from "./herramientas";

import type { PeticionChat } from "./peticion";

/**
 * Modelos de Gemini disponibles como alternativas.
 */
export const MODELOS_GEMINI = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
];

const PROBAR_OTRO_MODELO = new Set([404, 429, 503]);

const URL_GEMINI =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_TURNOS = 4;

interface Parte {
  text?: string;

  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };

  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

interface Contenido {
  role: "user" | "model";
  parts: Parte[];
}

export class AgenteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgenteError";
  }
}

export interface OpcionesAgente {
  apiKey: string;

  // Paquete original de Muyu
  paquete: PaqueteCanton;

  // Nuevo paquete de Kallpa ML
  paqueteNuevo?: PaqueteKallpa;

  modelos?: string[];

  // Permite simular Gemini durante las pruebas
  fetchImpl?: typeof fetch;
}

/**
 * Construye las instrucciones del agente.
 */
function instrucciones(
  paquete: PaqueteCanton,
  { contexto }: PeticionChat,
  paqueteNuevo?: PaqueteKallpa
): string {
  const canton =
    paquete.cantones[contexto.cantonId]?.nombre ??
    contexto.cantonId;

  const previo =
    paquete.cultivos.find(
      (c) => c.id === contexto.cultivoPrevioId
    )?.nombre ?? contexto.cultivoPrevioId;

  const hayDatosNuevos =
    paqueteNuevo?.cantones[contexto.cantonId] !== undefined;

  return [
    "Eres Muyu, asistente agronómico de Kallpa para agricultores de Ecuador.",

    "Responde en español sencillo, cálido y respetuoso, " +
      "en máximo 3 frases cortas, sin markdown. " +
      "Pon cada idea en su propia línea y la cifra clave primero.",

    "Usa SOLO cifras que te devuelvan las herramientas; " +
      "nunca inventes datos.",

    "Antes de responder preguntas agrícolas, consulta al menos una herramienta. " +
      "No proporciones cifras ni recomendaciones sin datos de las herramientas.",

    "Si una herramienta devuelve un error, no inventes una respuesta. " +
      "Explica qué información no está disponible.",

    "Si algo no está en los datos, dilo con honestidad y " +
      "sugiere qué sí puedes responder.",

    "Si el semáforo de una herramienta está en rojo, " +
      "empieza avisando ese riesgo.",

    ...(paqueteNuevo
      ? [
          "Tienes disponible la herramienta consultar_kallpa_ml " +
            "con información actualizada de Daule y Babahoyo.",

          "Para estos dos cantones, prioriza consultar_kallpa_ml " +
            "cuando pregunten por lluvia, temperatura, humedad, " +
            "NDVI, escenarios ENSO o rotaciones.",

          "La lluvia mensual del paquete actualizado no cambia " +
            "según el escenario ENSO. La humedad de raíz predicha sí.",

          "El ahorro de urea está expresado en kg/ha, no en USD/ha.",

          "El margen parcial se calcula como ingreso bruto menos " +
            "costo de insumos. No lo presentes como ganancia neta.",

          "No presentes las predicciones del modelo como certezas.",
        ]
      : []),

    ...reglasDeAlcance(paquete),

    `Contexto del agricultor: cantón ${canton} ` +
      `(id ${contexto.cantonId}), acaba de cosechar ${previo} ` +
      `(id ${contexto.cultivoPrevioId}), ` +
      `escenario ${ESCENARIO_NOMBRE[contexto.escenario]} ` +
      `(id ${contexto.escenario}), mes ${contexto.mes}. ` +
      "Úsalo si la pregunta no dice otra cosa.",

    hayDatosNuevos
      ? "El cantón seleccionado tiene datos actualizados de Kallpa ML."
      : "El cantón seleccionado no tiene datos en el paquete nuevo. " +
        "Utiliza las herramientas originales cuando corresponda.",
  ].join("\n");
}

/**
 * Llama a Gemini.
 * Si un modelo no está disponible, intenta con el siguiente.
 */
async function generar(
  cuerpo: unknown,
  {
    apiKey,
    modelos = MODELOS_GEMINI,
    fetchImpl = fetch,
  }: OpcionesAgente
) {
  let ultimoError = "sin modelos";

  for (const modelo of modelos) {
    const respuesta = await fetchImpl(
      `${URL_GEMINI}/${modelo}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(cuerpo),
      }
    );

    if (respuesta.ok) {
      return (await respuesta.json()) as {
        candidates?: {
          content?: Contenido;
        }[];
      };
    }

    const motivo = await respuesta
      .text()
      .then((t) => t.slice(0, 200))
      .catch(() => "");

    ultimoError =
      `${modelo} respondió ${respuesta.status} ${motivo}`.trim();

    if (!PROBAR_OTRO_MODELO.has(respuesta.status)) {
      break;
    }
  }

  throw new AgenteError(ultimoError);
}

/**
 * Agente principal de Muyu.
 *
 * Gemini decide qué herramienta consultar.
 * Nuestro código ejecuta la herramienta con datos reales.
 * Gemini utiliza el resultado para redactar su respuesta.
 */
export async function conversar(
  peticion: PeticionChat,
  opciones: OpcionesAgente
): Promise<ChatReply> {
  const { paquete, paqueteNuevo } = opciones;

  // Protección contra preguntas fuera del alcance
  if (
    pareceManipulacion(peticion.pregunta) ||
    esTemaVetado(peticion.pregunta)
  ) {
    return respuestaFueraDeTema(peticion.pregunta);
  }

  const contents: Contenido[] = [
    ...peticion.historial.map(
      (m): Contenido => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })
    ),

    {
      role: "user",
      parts: [{ text: peticion.pregunta }],
    },
  ];

  const base = {
    systemInstruction: {
      parts: [
        {
          text: instrucciones(
            paquete,
            peticion,
            paqueteNuevo
          ),
        },
      ],
    },

    tools: [
      {
        functionDeclarations: declararHerramientas(
          paquete,
          paqueteNuevo
        ),
      },
    ],

    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  let recomendo = false;
  let consultoDatos = false;

  for (let turno = 0; turno < MAX_TURNOS; turno++) {
    const datos = await generar(
      { ...base, contents },
      opciones
    );

    const contenido = datos.candidates?.[0]?.content;
    const partes = contenido?.parts ?? [];

    const llamadas = partes.flatMap((p) =>
      p.functionCall ? [p.functionCall] : []
    );

    // Gemini terminó de consultar y quiere responder
    if (llamadas.length === 0) {
      const text = partes
        .map((p) => p.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new AgenteError(
          "Gemini no devolvió texto"
        );
      }

      if (esFueraDeTema(text)) {
        return respuestaFueraDeTema(
          peticion.pregunta
        );
      }

      // Evita respuestas agrícolas sin consultar datos
      if (!consultoDatos) {
        const saludo =
          /^(hola|buenos días|buenas tardes|buenas noches|gracias|adiós)[!¡.\s]*$/i.test(
            peticion.pregunta.trim()
          );

        if (!saludo) {
          throw new AgenteError(
            "Gemini intentó responder sin consultar los datos agrícolas"
          );
        }
      }

      return {
        text,
        emotion: recomendo ? "happy" : "neutral",
      };
    }

    // Guardar las llamadas realizadas por Gemini
    contents.push({
      role: "model",
      parts: partes,
    });

    // Ejecutar las herramientas solicitadas
    contents.push({
      role: "user",

      parts: llamadas.map(
        ({ name, args = {} }) => {
          const response = ejecutarHerramienta(
            paquete,
            name,
            args,
            paqueteNuevo
          );

          // Solo cuenta como consulta válida si no hubo error
          if (!("error" in response)) {
            consultoDatos = true;
          }

          const recomendaciones =
            response.recomendaciones;

          // Detectar recomendaciones del paquete original
          if (
            name === "recomendar_rotacion" &&
            Array.isArray(recomendaciones) &&
            recomendaciones.length > 0
          ) {
            recomendo = true;
          }

          // Detectar recomendaciones de Kallpa ML
          if (
            name === "consultar_kallpa_ml" &&
            Array.isArray(recomendaciones) &&
            recomendaciones.length > 0
          ) {
            recomendo = true;
          }

          return {
            functionResponse: {
              name,
              response,
            },
          };
        }
      ),
    });
  }

  throw new AgenteError(
    "Demasiadas llamadas a herramientas"
  );
}
