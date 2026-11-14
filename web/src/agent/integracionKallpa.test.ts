
import { describe, expect, it } from "vitest";

import datosOriginales from "../../public/datos/paquete_canton.json";
import datosNuevos from "../../public/datos/nuevo/paquete_canton.json";

import { validarPaquete } from "../knowledge/validarPaquete";
import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";
import { conversar } from "./agente";
import type { PeticionChat } from "./peticion";

const paquete = validarPaquete(structuredClone(datosOriginales));
const paqueteNuevo = datosNuevos as PaqueteKallpa;

const peticion: PeticionChat = {
  pregunta:
    "¿Cuál es la humedad de raíz en Daule durante enero bajo El Niño?",
  historial: [],
  contexto: {
    cantonId: "daule",
    cultivoPrevioId: "arroz",
    escenario: "el_nino",
    mes: 1,
  },
};

describe("Integración Gemini + Kallpa ML", () => {
  it("Gemini puede consultar los datos nuevos de Daule", async () => {
    const solicitudes: Record<string, any>[] = [];

    const fetchFalso = (async (
      _url: string,
      opciones: RequestInit
    ) => {
      const cuerpo = JSON.parse(String(opciones.body));
      solicitudes.push(cuerpo);

      if (solicitudes.length === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        name: "consultar_kallpa_ml",
                        args: {
                          canton_id: "daule",
                          escenario: "nino",
                          mes: 1,
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text:
                      "La humedad de raíz predicha en Daule " +
                      "para enero bajo El Niño es 70.1%.",
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const respuesta = await conversar(peticion, {
      apiKey: "clave-de-prueba",
      paquete,
      paqueteNuevo,
      fetchImpl: fetchFalso,
    });

    expect(solicitudes).toHaveLength(2);

    const herramientas =
      solicitudes[0].tools[0].functionDeclarations;

    expect(
      herramientas.some(
        (h: { name: string }) =>
          h.name === "consultar_kallpa_ml"
      )
    ).toBe(true);

    const partes =
      solicitudes[1].contents.at(-1).parts;

    const resultado =
      partes[0].functionResponse.response;

    expect(resultado.canton).toBe(
      paqueteNuevo.cantones.daule.nombre
    );

    expect(
      resultado.clima.humedad_raiz_predicha
    ).toBeCloseTo(0.701);

    expect(resultado.modelo).toBe("Ridge");

    expect(respuesta.text).toContain("70.1%");
  });

  it("conserva las herramientas anteriores", async () => {
    const solicitudes: Record<string, any>[] = [];

    const fetchFalso = (async (
      _url: string,
      opciones: RequestInit
    ) => {
      solicitudes.push(JSON.parse(String(opciones.body)));

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hola" }],
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await conversar(
      { ...peticion, pregunta: "hola" },
      {
        apiKey: "clave-de-prueba",
        paquete,
        paqueteNuevo,
        fetchImpl: fetchFalso,
      }
    );

    const nombres = solicitudes[0].tools[0]
      .functionDeclarations.map(
        (h: { name: string }) => h.name
      );

    expect(nombres).toContain("resumen_canton");
    expect(nombres).toContain("recomendar_rotacion");
    expect(nombres).toContain("comparar_escenarios");
    expect(nombres).toContain("consultar_kallpa_ml");
  });
});
