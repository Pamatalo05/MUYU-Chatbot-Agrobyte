import { describe, expect, it } from "vitest";
import datosJson from "../../public/data/paquete_canton.json";
import { validarPaquete } from "../knowledge/validarPaquete";
import { AgenteError, conversar } from "./agente";
import { ejecutarHerramienta } from "./herramientas";
import { PeticionInvalidaError, validarPeticion, type PeticionChat } from "./peticion";

const paquete = validarPaquete(structuredClone(datosJson));
const peticion: PeticionChat = {
  pregunta: "¿Qué siembro después?",
  historial: [],
  contexto: { cantonId: "daule", cultivoPrevioId: "arroz", escenario: "neutro", mes: 1 },
};

/** Gemini falso: devuelve las respuestas en orden y guarda lo que recibió. */
function geminiFalso(respuestas: { status?: number; parts?: unknown[] }[]) {
  const recibido: { url: string; body: any }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    recibido.push({ url, body: JSON.parse(String(init.body)) });
    const r = respuestas.shift() ?? { status: 500 };
    const status = r.status ?? 200;
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: r.parts } }] }), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, recibido };
}

describe("ejecutarHerramienta", () => {
  it("usa el mismo motor del modo campo", () => {
    const r = ejecutarHerramienta(paquete, "recomendar_rotacion", {
      canton_id: "daule",
      cultivo_previo_id: "arroz",
      escenario: "neutro",
    }) as { recomendaciones: { id: string }[] };
    expect(r.recomendaciones[0].id).toBe("soya");
  });

  it("devuelve un error en lugar de lanzar", () => {
    expect(ejecutarHerramienta(paquete, "resumen_canton", { canton_id: "x", escenario: "neutro", mes: 1 })).toHaveProperty("error");
    expect(ejecutarHerramienta(paquete, "borrar_todo", {})).toHaveProperty("error");
  });
});

describe("conversar", () => {
  it("ejecuta la herramienta que pide Gemini y devuelve su respuesta final", async () => {
    const { fetchImpl, recibido } = geminiFalso([
      { parts: [{ functionCall: { name: "recomendar_rotacion", args: { canton_id: "daule", cultivo_previo_id: "arroz", escenario: "neutro" } } }] },
      { parts: [{ text: "Te recomiendo soya, ahorras 85 USD/ha." }] },
    ]);
    const r = await conversar(peticion, { apiKey: "k", paquete, fetchImpl });
    expect(r).toEqual({ text: "Te recomiendo soya, ahorras 85 USD/ha.", emotion: "happy" });
    const respuestaHerramienta = recibido[1].body.contents[recibido[1].body.contents.length - 1].parts[0].functionResponse;
    expect(respuestaHerramienta.response.recomendaciones[0].id).toBe("soya");
    expect(recibido[0].body.systemInstruction.parts[0].text).toContain("Daule");
  });

  it("si un modelo está saturado prueba el siguiente", async () => {
    const { fetchImpl, recibido } = geminiFalso([{ status: 429 }, { parts: [{ text: "Hola" }] }]);
    const r = await conversar(peticion, { apiKey: "k", paquete, fetchImpl });
    expect(r.text).toBe("Hola");
    expect(recibido[0].url).toContain("gemini-2.5-flash:");
    expect(recibido[1].url).toContain("gemini-2.5-flash-lite:");
  });

  it("no reintenta ante una clave inválida", async () => {
    const { fetchImpl, recibido } = geminiFalso([{ status: 400 }, { parts: [{ text: "x" }] }]);
    await expect(conversar(peticion, { apiKey: "k", paquete, fetchImpl })).rejects.toBeInstanceOf(AgenteError);
    expect(recibido).toHaveLength(1);
  });
});

describe("validarPeticion", () => {
  it("acepta una petición válida y recorta el historial", () => {
    const historial = Array.from({ length: 10 }, () => ({ role: "user", text: "hola" }));
    expect(validarPeticion({ ...peticion, historial }).historial).toHaveLength(6);
  });

  it("rechaza preguntas vacías, largas o contexto inválido", () => {
    expect(() => validarPeticion({ ...peticion, pregunta: " " })).toThrow(PeticionInvalidaError);
    expect(() => validarPeticion({ ...peticion, pregunta: "a".repeat(501) })).toThrow(PeticionInvalidaError);
    expect(() => validarPeticion({ ...peticion, contexto: { ...peticion.contexto, mes: 13 } })).toThrow(PeticionInvalidaError);
  });
});
