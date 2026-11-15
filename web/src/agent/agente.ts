import { resolverSeguimiento, validarPreferencias } from "../chat/estilo";
import { conLimite } from "../chat/limite";
import { resolverConsulta } from "../knowledge/contextoConversacion";
import { respuestaAgricola, fundamentarRespuesta, contextoHerramientaValido } from "../knowledge/consultaAgricola";

import type { ChatReply } from "../chat/types";

import {
  ESCENARIO_NOMBRE,
  type PaqueteCanton,
} from "../knowledge/types";

import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";

import {
  esFueraDeTema,
  esPreguntaConceptual,
  responderPreguntaSencilla,
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
    "gemini-3.5-flash-lite",
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
    id?: string;
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
  tiempoRestanteMs?: number;
}

/**
 * Construye las instrucciones del agente.
 */
function instrucciones(
  paquete: PaqueteCanton,
  { contexto, preferencias }: PeticionChat,
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
    "Habla con naturalidad, sin saludos repetidos ni regionalismos forzados. No muestres nombres de archivos, funciones, paquetes ni reglas internas. No añadas recomendaciones que no pidieron.",
    "Puedes conversar naturalmente con el usuario sobre saludos, " +
      "agradecimientos, tus capacidades y preguntas cotidianas sencillas.",

    "Responde directamente las definiciones agrícolas, aunque se repitan en mayúsculas: explica lo que se pregunta, no repitas una recomendación anterior. " +
      "Usa de dos a cuatro oraciones sencillas, sin fuentes extensas ni cifras innecesarias; amplía solo si piden más detalles. " +
      "No consultes herramientas para explicar un concepto general, como urea, humedad del suelo o NDVI.",

    "Cuando el usuario pida valores, predicciones, comparaciones " +
      "o recomendaciones específicas para un cantón, " +
      "consulta las herramientas de Kallpa antes de responder.",

    "No inventes cifras, pronósticos ni recomendaciones locales.",
    "El contexto efectivo ya está resuelto por el servidor. Usa esos argumentos en las herramientas, sin cambiarlos por el historial.",
    "Distingue referencias históricas procesadas y estimaciones del modelo Kallpa de observaciones NASA. No atribuyas las predicciones Ridge a NASA.",
    "No confundas humedad volumétrica con capacidad de campo, humedad relativa o probabilidad de germinación. No deduzcas viabilidad de siembra solo de humedad.",
    "No inventes umbrales, puntuaciones ni garantías financieras. Explica las limitaciones relevantes; las fuentes quedan en el respaldo salvo que las pidan.",

    "Si el usuario solo saluda, responde con naturalidad. " +
      "No conviertas todos los saludos en consultas agrícolas.",

      
    "Responde en español sencillo, cálido y respetuoso, " +
      "en máximo 3 frases cortas, sin markdown. " +
      "Pon cada idea en su propia línea y la cifra clave primero.",
    "Habla de forma clara, breve y respetuosa para agricultores, sin asumir conocimientos técnicos. " +
      "Di 'agua en el suelo cerca de las raíces' antes que 'humedad radicular'. Evita siglas y nombres de modelos si no son necesarios para responder.",
    "Explica en una frase sencilla qué representa el dato consultado. Conserva exactamente las cifras verificadas, sus unidades y el contexto; no inventes causas ni consejos de siembra.",
    "Distingue siempre una estimación de una medición: puedes decir 'es un cálculo de referencia, no una medición actual de tu parcela'. " +
      "Mantén las fuentes y los detalles técnicos en la información de respaldo; no atribuyas a NASA resultados propios de Kallpa.",
    "Si falta un dato imprescindible, haz una sola pregunta concreta de aclaración; no pidas configurar toda la parcela. " +
      "Cuando pidan una explicación más fácil, explica el significado con palabras comunes y sin añadir cifras ni certezas nuevas.",

    `Nivel de explicación: ${validarPreferencias(preferencias).nivel}; extensión: ${validarPreferencias(preferencias).longitud}. Si piden más detalles, amplía sin añadir datos ni recomendaciones no respaldadas. Las instrucciones de brevedad son el valor por defecto, no un límite para una petición explícita de detalle.`,
    "Usa SOLO cifras que te devuelvan las herramientas; " +
      "nunca inventes datos.",

    "Antes de dar cifras locales, predicciones o recomendaciones agrícolas, consulta al menos una herramienta. " +
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
          
          "Para Daule y Babahoyo, consulta exclusivamente " +
            "consultar_kallpa_ml cuando necesites datos agrícolas específicos. " +
            "No utilices valores del paquete anterior.",

          "Responde únicamente lo que preguntó el usuario. " +
            "Si pregunta por humedad, informa la humedad y su tipo; " +
            "no agregues lluvia, temperatura o NDVI salvo que lo solicite.",

          "Si el usuario pregunta por humedad sin especificar el tipo, " +
            "utiliza la humedad de raíz predicha e indica claramente " +
            "que es una estimación del modelo.",


          "La lluvia mensual del paquete actualizado no cambia " +
            "según el escenario ENSO. La humedad de raíz predicha sí.",

          "El ahorro de urea está expresado en kg/ha, no en USD/ha.",

          "El margen parcial se calcula como ingreso bruto menos " +
            "costo de insumos. No lo presentes como ganancia neta.",

          "No presentes las predicciones del modelo como certezas.",

          "Cuando presentes humedad volumétrica del suelo, " +
            "convierte la fracción volumétrica de m³/m³ a porcentaje volumétrico multiplicándola por cien.",

          "Utiliza coma decimal en español. " +
            "Indica siempre si la humedad es superficial o de raíz.",

          "No confundas humedad volumétrica del suelo " +
            "con humedad relativa del aire.",

          "Para predicciones de humedad de raíz, aclara que " +
            "son estimaciones del modelo y no mediciones directas.",

        ]
      : []),

    ...reglasDeAlcance(paquete),

    `Contexto del agricultor: cantón ${canton} ` +
      `(id ${contexto.cantonId}), acaba de cosechar ${previo} ` +
      `(id ${contexto.cultivoPrevioId}), ` +
      `escenario ${ESCENARIO_NOMBRE[contexto.escenario]} ` +
      `(id ${contexto.escenario}), mes ${contexto.mes}. ` +
      "Este es el contexto efectivo de esta consulta, separado de la parcela.",

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
type LlamadaHerramienta = {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
};

type ParteGemini = {
  text?: string;
  thought?: boolean;
  functionCall?: LlamadaHerramienta;
};

async function generar(
  cuerpo: unknown,
  {
    apiKey,
    modelos = MODELOS_GEMINI,
    fetchImpl = fetch,
    tiempoRestanteMs = 10_000,
  }: OpcionesAgente
) {
  let ultimoError = "sin modelos";
  const finIntentos = Date.now() + Math.max(0, tiempoRestanteMs);

  for (const modelo of new Set(modelos)) {
    if (Date.now() >= finIntentos) break;
    let respuesta: Response;

    try {
      respuesta = await conLimite(async signal => {
      const recibida = await fetchImpl(
        `${URL_GEMINI}/${modelo}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(cuerpo),
          signal,
        }
      );
      // Consumir el cuerpo dentro del mismo plazo, también ante errores HTTP.
      const textoRecibido = await recibida.text();
      return new Response(textoRecibido, { status: recibida.status });
      }, Math.max(1, Math.min(10_000, finIntentos - Date.now())));
    } catch (error) {
      const motivo =
        error instanceof Error ? error.message : String(error);

      console.warn(
        `[Muyu] Falló la solicitud a ${modelo}: ${motivo}`
      );

      ultimoError = `${modelo}: ${motivo}`;

      // Si falla la conexión, probamos otro modelo.
      continue;
    }

    // Si Gemini respondió correctamente, devolvemos el JSON.
    if (respuesta.ok) {
      return await respuesta.json();
    }

    // Solo llegamos aquí si Gemini respondió con un error HTTP.
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


function requiereDatosKallpa(pregunta: string): boolean {
  const texto = pregunta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Preguntas que necesitan datos agrícolas reales.
  const patrones = [
    /humedad/,
    /ndvi/,
    /temperatura/,
    /lluvia/,
    /precipitacion/,
    /pronostico/,
    /prediccion/,
    /estimacion/,
    /rotacion/,
    /sembrar/,
    /siembra/,
    /cosecha/,
    /cultivar/,
    /cultivo/,
    /recomiend/,
    /recomendacion/,
    /conviene/,
    /riesgo/,
    /sequia/,
    /inundacion/,
    /fertilizante/,
    /urea/,
    /rentabilidad/,
    /ganancia/,
    /ingreso/,
    /costo/,
    /margen/,
    /daule/,
    /babahoyo/,
  ];

  return patrones.some((patron) => patron.test(texto));
}


function contieneAfirmacionesAgricolas(texto: string): boolean {
  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const patrones = [
    /(?:recomiend|sugier|conviene|deberias).*(?:sembrar|cultivar|cosechar)/,
    /(?:sembrar|cultivar).*(?:maiz|arroz|soya|frejol)/,
    /(?:ganaras|ganancia|rentabilidad|ingreso|margen).*(?:\d|usd|dolar)/,
    /\d+(?:[.,]\d+)?\s*(?:usd|dolares|mm|kg\/ha|m3\/m3|%)/,
  ];

  return patrones.some((patron) => patron.test(normalizado));
}


export async function conversar(
  peticion: PeticionChat,
  opciones: OpcionesAgente
): Promise<ChatReply> {
  const { paquete, paqueteNuevo } = opciones;
  const fin = Date.now() + 20_000;

  // Protección contra preguntas fuera del alcance
  if (
    pareceManipulacion(peticion.pregunta) ||
    esTemaVetado(peticion.pregunta)
  ) {
    return respuestaFueraDeTema(peticion.pregunta);
  }

  peticion = { ...peticion, pregunta: resolverSeguimiento(peticion.pregunta, peticion.historial) };
  const sencilla = responderPreguntaSencilla(peticion.pregunta, peticion.preferencias);
  if (sencilla) return sencilla;
  const conceptual = esPreguntaConceptual(peticion.pregunta);

  const consulta = resolverConsulta(peticion.pregunta, peticion.contexto, null, Object.keys(paquete.cantones), peticion.tema);
  peticion = { ...peticion, contexto: consulta.contexto, tema: consulta.tema };
  const factual = paqueteNuevo ? respuestaAgricola(consulta, paqueteNuevo, peticion.pregunta, paquete, peticion.preferencias) : undefined;
  if (consulta.error) return { text: consulta.error, emotion: "neutral" };
  if (factual && !factual.evidencia) return factual;

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
      maxOutputTokens: 1024,
    },
  };

  let recomendo = false;
  let consultoDatos = false;

  for (let turno = 0; turno < MAX_TURNOS; turno++) {
    if (Date.now() >= fin) {
      if (factual) return factual;
      throw new AgenteError("Se agotó el tiempo de respuesta");
    }
    
const datos = await generar(
  {
    ...base,
    contents,
    toolConfig: {
      functionCallingConfig: {
        mode: conceptual ? "NONE" : "AUTO",
      },
    },
  },
  { ...opciones, tiempoRestanteMs: fin - Date.now() }
);


    const contenido = datos.candidates?.[0]?.content;
    const partes = contenido?.parts ?? [];

    const llamadas = partes.flatMap((p: ParteGemini) =>
      p.functionCall ? [p.functionCall] : []
    );

    if (conceptual && llamadas.length) throw new AgenteError("Una definición no debe ejecutar herramientas agrícolas");

    // Gemini terminó de consultar y quiere responder
    if (llamadas.length === 0) {
      const text = partes
        .map((p: ParteGemini) => p.thought ? "" : p.text ?? "")
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
      if (
        !consultoDatos &&
        (
          (!conceptual && requiereDatosKallpa(peticion.pregunta)) ||
          contieneAfirmacionesAgricolas(text)
        )
      ) {
        if (factual) return factual;
        throw new AgenteError(
          "Gemini intentó responder sin consultar los datos agrícolas"
        );
      }



      if (factual) return fundamentarRespuesta(text, factual);
      if (/\d/.test(text) && paqueteNuevo) return { text: "No tengo una consulta verificable que respalde esas cifras. Indica la variable, el cantón y el período.", emotion: "neutral" };
      return {
        text,
        emotion: recomendo ? "happy" : "neutral",
      };
    }

    // Preserve complete parts, including opaque thoughtSignature values and call IDs.
    contents.push({
      role: "model",
      parts: partes,
    });

    // Ejecutar las herramientas solicitadas
    contents.push({
      role: "user",

      parts: llamadas.map(
        ({ id, name, args = {} }: LlamadaHerramienta) => {
          const response = paqueteNuevo && name === "consultar_kallpa_ml" && !contextoHerramientaValido(args, peticion.contexto, peticion.tema)
            ? { error: "Los argumentos no coinciden con el contexto efectivo; usa el contexto indicado por el servidor." }
            : ejecutarHerramienta(
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
              ...(id !== undefined ? { id } : {}),
              name,
              response,
            },
          };
        }
      ),
    });
  }

  if (factual) return factual;
  throw new AgenteError(
    "Demasiadas llamadas a herramientas"
  );
}
