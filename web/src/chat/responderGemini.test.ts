import { afterEach, describe, expect, it, vi } from "vitest";
import { responderGemini } from "./responderGemini";
import { conLimite } from "./limite";
const contexto = { cantonId: "daule", mes: 1, escenario: "el_nino" as const, cultivoPrevioId: "arroz" };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("plazos y errores del transporte", () => {
  it("limita también un cuerpo que nunca termina, aborta y no reintenta", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_u, init) => {
      signal = init?.signal as AbortSignal;
      return { ok: true, json: () => new Promise(() => {}) } as Response;
    });
    const pendiente = responderGemini("humedad", [], contexto, fetchImpl);
    const rechaza = expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(25_001);
    await rechaza;
    expect(signal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancela solicitudes que incluso ignoran AbortSignal y no deja temporizadores", async () => {
    vi.useFakeTimers();
    const controlador = new AbortController();
    const pendiente = conLimite(() => new Promise(() => {}), 1000, controlador.signal);
    const rechaza = expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
    controlador.abort();
    await rechaza;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancela al perder conexión y retira el listener al terminar", async () => {
    const ventana = new EventTarget();
    const quitar = vi.spyOn(ventana, "removeEventListener");
    vi.stubGlobal("window", ventana);
    let signal!: AbortSignal;
    const falso = vi.fn(async (_u, init) => { signal = init?.signal as AbortSignal; return new Promise<Response>(() => {}); });
    const pendiente = responderGemini("humedad", [], contexto, falso);
    const rechaza = expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
    ventana.dispatchEvent(new Event("offline"));
    await rechaza;
    expect(signal.aborted).toBe(true);
    expect(quitar).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(falso).toHaveBeenCalledTimes(1);
  });
  it("no inicia una solicitud ya cancelada", async () => {
    const c = new AbortController(); c.abort();
    const trabajo = vi.fn();
    await expect(conLimite(trabajo, 100, c.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(trabajo).not.toHaveBeenCalled();
  });
  it.each(["", "   "])("rechaza texto vacío %j", async text => {
    const falso = vi.fn(async () => new Response(JSON.stringify({ text })));
    await expect(responderGemini("hola", [], contexto, falso)).rejects.toThrow("respuesta completa");
  });
  it("no muestra diagnósticos internos del servidor al agricultor", async () => {
    const falso = vi.fn(async () => new Response(JSON.stringify({ error: "INTERNAL_JSON_FILE_ERROR" }), { status: 502 }));
    await expect(responderGemini("hola", [], contexto, falso)).rejects.toThrow("No pude completar la consulta en línea");
    expect(falso).toHaveBeenCalledTimes(1);
  });
  it("completa una respuesta sin necesitar AbortSignal.timeout y conserva preferencias", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => { throw new Error("No disponible"); });
    let cuerpo: any;
    const falso = vi.fn(async (_u, init) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ text: "Una explicación.", emotion: "neutral" }));
    });
    const preferencias = { nivel: "normal" as const, longitud: "detallada" as const };
    expect((await responderGemini("hola", [], contexto, falso, undefined, undefined, preferencias)).text).toBe("Una explicación.");
    expect(cuerpo.preferencias).toEqual(preferencias);
    expect(timeout).not.toHaveBeenCalled();
  });
});
