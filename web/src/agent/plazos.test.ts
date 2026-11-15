import { afterEach, describe, expect, it, vi } from "vitest";
import { conversar } from "./agente";
import datos from "../../public/datos/paquete_canton.json";
import { validarPaquete } from "../knowledge/validarPaquete";
const paquete = validarPaquete(structuredClone(datos));
const peticion = { pregunta: "Describe tu función", historial: [], contexto: { cantonId: "daule", cultivoPrevioId: "arroz", mes: 1, escenario: "neutro" as const } };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("plazos del agente REST", () => {
  it("no repite un modelo duplicado tras un error", async () => {
    const falso = vi.fn(async () => new Response("No disponible", { status: 503 }));
    await expect(conversar(peticion, { paquete, apiKey: "fake", modelos: ["modelo-prueba", "modelo-prueba"], fetchImpl: falso })).rejects.toThrow("503");
    expect(falso).toHaveBeenCalledTimes(1);
  });
  it("limita la lectura de un cuerpo detenido, no solo las cabeceras", async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const falso = vi.fn(async (_u, init) => {
      signal = init?.signal as AbortSignal;
      return { ok: true, status: 200, text: () => new Promise(() => {}) } as Response;
    });
    const pendiente = conversar(peticion, { paquete, apiKey: "fake", fetchImpl: falso });
    const rechaza = expect(pendiente).rejects.toThrow("Solicitud cancelada");
    await vi.advanceTimersByTimeAsync(10_001); await rechaza;
    expect(signal.aborted).toBe(true);
    expect(falso).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("respeta el presupuesto total entre turnos de herramientas", async () => {
    vi.useFakeTimers();
    const falso = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 8000));
      return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "resumen_canton", args: { canton_id: "daule", escenario: "neutro", mes: 1 } } }] } }] }));
    });
    const pendiente = conversar(peticion, { paquete, apiKey: "fake", fetchImpl: falso });
    const rechaza = expect(pendiente).rejects.toThrow("Solicitud cancelada");
    await vi.advanceTimersByTimeAsync(20_001); await rechaza;
    expect(falso).toHaveBeenCalledTimes(3);
    // Completar el simulador que ignora AbortSignal no inicia otro turno.
    await vi.advanceTimersByTimeAsync(5000);
    expect(falso).toHaveBeenCalledTimes(3);
  });
});
