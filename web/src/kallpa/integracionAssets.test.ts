import { afterEach, describe, expect, it, vi } from "vitest";
import datos from "../../public/datos/paquete_canton.json";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("rutas del paquete Android existente", () => {
  it("ambos lectores cargan el JSON científico de assets/datos, sin Internet", async () => {
    vi.stubEnv("MODE", "kallpa");
    vi.resetModules();
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify(datos)));
    vi.stubGlobal("fetch", fetchFalso);
    const { cargarPaquete } = await import("../knowledge/cargarPaquete");
    const { cargarKallpaNuevo } = await import("../knowledge/adaptadorKallpa");
    const [uno, dos] = await Promise.all([cargarPaquete(), cargarKallpaNuevo()]);
    expect(fetchFalso.mock.calls).toEqual([["../datos/paquete_canton.json"], ["../datos/paquete_canton.json"]]);
    expect(uno.cantones).toEqual(dos.cantones);
    expect(dos.fuentes_metodologia).toEqual(datos.fuentes_metodologia);
  });
  it("usa el backend HTTPS real en Android aunque no haya .env.kallpa", async () => {
    vi.stubEnv("MODE", "kallpa");
    vi.stubEnv("VITE_MUYU_API_BASE", undefined);
    vi.resetModules();
    expect((await import("../chat/responderGemini")).RUTA_CHAT).toBe("https://muyu-agrobyte.netlify.app/api/chat");
  });
  it("mantiene las rutas de la web normal", async () => {
    vi.stubEnv("MODE", "test");
    vi.stubEnv("BASE_URL", "/");
    vi.stubEnv("VITE_MUYU_API_BASE", undefined);
    vi.resetModules();
    expect((await import("../knowledge/cargarPaquete")).RUTA_PAQUETE).toBe("/datos/paquete_canton.json");
    expect((await import("../chat/responderGemini")).RUTA_CHAT).toBe("/api/chat");
  });
});
