import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Prueba el ciclo del hook sin incorporar dependencias DOM.
const react = vi.hoisted(() => ({ celdas: [] as any[], indice: 0, limpiezas: [] as (() => void)[] }));
vi.mock("react", () => ({
  useState: (inicial: any) => {
    const i = react.indice++;
    if (!(i in react.celdas)) react.celdas[i] = typeof inicial === "function" ? inicial() : inicial;
    return [react.celdas[i], (valor: any) => { react.celdas[i] = typeof valor === "function" ? valor(react.celdas[i]) : valor; }];
  },
  useRef: (inicial: any) => { const i = react.indice++; return react.celdas[i] ?? (react.celdas[i] = { current: inicial }); },
  useCallback: (fn: any) => fn,
  useEffect: (fn: () => any) => { const limpiar = fn(); if (typeof limpiar === "function") react.limpiezas.push(limpiar); },
}));
import { useChat } from "./useChat";
import type { ChatReply, Responder } from "./types";
const respuesta: ChatReply = { text: "Una respuesta breve.", emotion: "neutral" };
const render = (responder: Responder) => { react.indice = 0; return useChat(responder); };
beforeEach(() => {
  react.celdas = []; react.indice = 0; react.limpiezas = [];
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout, matchMedia: () => ({ matches: true }) });
});
afterEach(() => {
  react.limpiezas.forEach(limpiar => limpiar());
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
describe("useChat: solicitudes y recuperación", () => {
  it("bloquea dos envíos síncronos antes del siguiente render", async () => {
    const responder = vi.fn<Responder>().mockResolvedValue(respuesta);
    const chat = render(responder);
    const primera = chat.send("Hola");
    await chat.send("Hola otra vez");
    expect(responder).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500); await primera;
    expect(react.celdas[0].filter((m: any) => m.role === "user")).toHaveLength(1);
    expect(react.celdas[1]).toBe("idle");
  });
  it("libera una carga indefinida y ofrece reintento sin repetir automáticamente", async () => {
    const responder = vi.fn<Responder>().mockImplementation(() => new Promise(() => {}));
    const chat = render(responder);
    const pendiente = chat.send("Humedad");
    await vi.advanceTimersByTimeAsync(30_001); await pendiente;
    const actual = render(responder);
    expect(actual.isBusy).toBe(false);
    expect(actual.canRetry).toBe(true);
    expect(responder).toHaveBeenCalledTimes(1);
    expect(actual.messages.at(-1)?.text).toContain("Intentamos otra vez");
  });
  it("cancela al desmontar y descarta una respuesta posterior", async () => {
    let resolver!: (r: ChatReply) => void;
    let signal!: AbortSignal;
    const responder: Responder = (_p, _h, _a, s) => { signal = s!; return new Promise(si => { resolver = si; }); };
    const chat = render(responder);
    const pendiente = chat.send("Hola");
    react.limpiezas.forEach(limpiar => limpiar());
    resolver(respuesta);
    await pendiente;
    expect(signal.aborted).toBe(true);
    expect(react.celdas[0].at(-1).role).toBe("user");
  });
  it("resuelve la escritura pendiente al desmontar", async () => {
    const chat = render(vi.fn<Responder>().mockResolvedValue(respuesta));
    const pendiente = chat.send("Hola");
    await vi.advanceTimersByTimeAsync(401);
    expect(react.celdas[1]).toBe("speaking");
    react.limpiezas.forEach(limpiar => limpiar());
    await pendiente;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("reintenta únicamente al pulsar y no duplica la pregunta en el historial", async () => {
    const responder = vi.fn<Responder>().mockRejectedValueOnce(new Error("Fallo de red")).mockResolvedValue(respuesta);
    const pendiente = render(responder).send("Hola");
    await vi.advanceTimersByTimeAsync(401); await pendiente;
    const actual = render(responder);
    const segundo = actual.retry();
    await vi.advanceTimersByTimeAsync(1500); await segundo;
    expect(responder).toHaveBeenCalledTimes(2);
    expect(react.celdas[0].filter((m: any) => m.role === "user")).toHaveLength(1);
    expect(responder.mock.calls[1][1].filter(m => m.role === "user")).toHaveLength(0);
    expect(render(responder).canRetry).toBe(false);
  });
});
