import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ejecuta el efecto del hook sin incorporar un entorno DOM adicional.
const react = vi.hoisted(() => ({
  efecto: undefined as undefined | (() => () => void),
  setEstado: vi.fn(),
}));
vi.mock("react", () => ({
  useState: (inicial: boolean) => [inicial, react.setEstado],
  useEffect: (efecto: () => () => void) => { react.efecto = efecto; },
}));
import { useEnLinea } from "./useEnLinea";

function diferida() {
  let resolve!: (respuesta: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((si, no) => { resolve = si; reject = no; });
  return { promise, resolve, reject };
}

let ventana: EventTarget;
let red: { onLine: boolean };
let limpiar: (() => void) | undefined;
const peticion = vi.fn<typeof fetch>();
const vaciar = async () => { await Promise.resolve(); await Promise.resolve(); };
function iniciar() {
  useEnLinea();
  limpiar = react.efecto!();
}
function evento(tipo: "online" | "offline") {
  red.onLine = tipo === "online";
  ventana.dispatchEvent(new Event(tipo));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  peticion.mockReset();
  ventana = new EventTarget();
  red = { onLine: true };
  vi.stubGlobal("window", ventana);
  vi.stubGlobal("navigator", red);
  vi.stubGlobal("fetch", peticion);
});
afterEach(() => {
  limpiar?.();
  limpiar = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useEnLinea", () => {
  it.each([204, 405, 500, 503])("HTTP %s indica conectividad sin consultar Gemini", async (status) => {
    peticion.mockResolvedValue(new Response(null, { status }));
    iniciar();
    await vaciar();
    expect(peticion).toHaveBeenCalledWith("/api/chat", {
      method: "HEAD", cache: "no-store", signal: expect.any(AbortSignal),
    });
    expect(react.setEstado).toHaveBeenLastCalledWith(true);
  });

  it("no consulta sin red y recupera la conexión al recibir online", async () => {
    red.onLine = false;
    peticion.mockResolvedValue(new Response(null, { status: 405 }));
    iniciar();
    expect(peticion).not.toHaveBeenCalled();
    expect(react.setEstado).toHaveBeenLastCalledWith(false);
    evento("online");
    await vaciar();
    expect(react.setEstado).toHaveBeenLastCalledWith(true);
  });

  it("cancela al perder red e ignora un éxito anterior", async () => {
    const vieja = diferida();
    peticion.mockReturnValue(vieja.promise);
    iniciar();
    const signal = peticion.mock.calls[0][1]!.signal!;
    evento("offline");
    expect(signal.aborted).toBe(true);
    vieja.resolve(new Response(null, { status: 405 }));
    await vaciar();
    expect(react.setEstado).toHaveBeenCalledTimes(1);
    expect(react.setEstado).toHaveBeenLastCalledWith(false);
  });

  it("un fallo antiguo no sobrescribe la reconexión", async () => {
    const vieja = diferida();
    peticion.mockReturnValueOnce(vieja.promise)
      .mockResolvedValue(new Response(null, { status: 405 }));
    iniciar();
    evento("offline");
    evento("online");
    await vaciar();
    vieja.reject(new Error("tardío"));
    await vaciar();
    expect(react.setEstado).toHaveBeenLastCalledWith(true);
    expect(react.setEstado).toHaveBeenCalledTimes(2);
  });

  it("vence el timeout, ignora el resultado tardío y reintenta", async () => {
    const lenta = diferida();
    peticion.mockReturnValueOnce(lenta.promise)
      .mockResolvedValue(new Response(null, { status: 405 }));
    iniciar();
    const signal = peticion.mock.calls[0][1]!.signal!;
    await vi.advanceTimersByTimeAsync(4_000);
    expect(signal.aborted).toBe(true);
    expect(react.setEstado).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(11_000);
    lenta.resolve(new Response(null, { status: 405 }));
    await vaciar();
    expect(react.setEstado).toHaveBeenLastCalledWith(true);
    expect(peticion).toHaveBeenCalledTimes(2);
  });

  it("un resultado antiguo no limpia el timeout de la petición nueva", async () => {
    const vieja = diferida();
    const nueva = diferida();
    peticion.mockReturnValueOnce(vieja.promise).mockReturnValueOnce(nueva.promise);
    iniciar();
    evento("offline");
    evento("online");
    const signalNueva = peticion.mock.calls[1][1]!.signal!;
    vieja.resolve(new Response(null, { status: 405 }));
    await vaciar();
    expect(react.setEstado).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(signalNueva.aborted).toBe(true);
    expect(react.setEstado).toHaveBeenLastCalledWith(false);
    nueva.resolve(new Response(null, { status: 405 }));
    await vaciar();
    expect(react.setEstado).toHaveBeenCalledTimes(2);
  });

  it("online repetido cancela la comprobación anterior", async () => {
    const vieja = diferida();
    peticion.mockReturnValueOnce(vieja.promise)
      .mockResolvedValue(new Response(null, { status: 405 }));
    iniciar();
    const signal = peticion.mock.calls[0][1]!.signal!;
    evento("online");
    expect(signal.aborted).toBe(true);
    await vaciar();
    vieja.reject(new Error("tardío"));
    await vaciar();
    expect(react.setEstado).toHaveBeenCalledTimes(1);
    expect(react.setEstado).toHaveBeenLastCalledWith(true);
  });

  it("detecta errores de red", async () => {
    peticion.mockRejectedValue(new TypeError("Failed to fetch"));
    iniciar();
    await vaciar();
    expect(react.setEstado).toHaveBeenLastCalledWith(false);
  });

  it("desmontar cancela la petición, los eventos y el intervalo", async () => {
    const pendiente = diferida();
    peticion.mockReturnValue(pendiente.promise);
    iniciar();
    const signal = peticion.mock.calls[0][1]!.signal!;
    limpiar!();
    expect(signal.aborted).toBe(true);
    pendiente.resolve(new Response(null, { status: 405 }));
    evento("offline");
    evento("online");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(react.setEstado).not.toHaveBeenCalled();
    expect(peticion).toHaveBeenCalledTimes(1);
  });
});
