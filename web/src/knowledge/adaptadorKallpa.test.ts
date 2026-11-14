
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cargarKallpaNuevo,
  obtenerCantonKallpa,
  obtenerMesKallpa,
  obtenerRotacionesKallpa,
  calcularMargenParcial,
} from "./adaptadorKallpa";

const ruta = resolve(
  process.cwd(),
  "public/datos/nuevo/paquete_canton.json"
);

const datosReales = JSON.parse(readFileSync(ruta, "utf8"));

function simularDescarga() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => structuredClone(datosReales),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Integración de datos Kallpa", () => {
  it("carga el paquete real de Kallpa", async () => {
    simularDescarga();

    const paquete = await cargarKallpaNuevo();

    expect(paquete.cantones.daule).toBeDefined();
    expect(paquete.cantones.babahoyo).toBeDefined();
    expect(paquete.ml_metadata.modelo_seleccionado).toBe("Ridge");
  });

  it("consulta el clima y la humedad predicha", async () => {
    simularDescarga();

    const paquete = await cargarKallpaNuevo();
    const daule = obtenerCantonKallpa(paquete, "daule");

    expect(daule).not.toBeNull();

    const enero = obtenerMesKallpa(daule!, 1, "nino");

    expect(enero).not.toBeNull();
    expect(enero?.lluvia_mm).toBeGreaterThanOrEqual(0);
    expect(enero?.humedad_raiz_predicha).toBeGreaterThanOrEqual(0);
    expect(enero?.humedad_raiz_predicha).toBeLessThanOrEqual(1);
  });

  it("consulta rotaciones por escenario ENSO", async () => {
    simularDescarga();

    const paquete = await cargarKallpaNuevo();
    const daule = obtenerCantonKallpa(paquete, "daule");

    expect(daule).not.toBeNull();

    const rotaciones = obtenerRotacionesKallpa(daule!, "neutro");

    expect(rotaciones.length).toBeGreaterThan(0);

    const primera = rotaciones[0];

    expect(primera.ahorro_urea_kg_ha).toBeGreaterThanOrEqual(0);
    expect(calcularMargenParcial(primera)).toBe(
      primera.ingreso_bruto_ha - primera.costo_insumos_ha
    );
  });

  it("no inventa cantones ni meses inexistentes", async () => {
    simularDescarga();

    const paquete = await cargarKallpaNuevo();

    expect(obtenerCantonKallpa(paquete, "quito")).toBeNull();

    const daule = obtenerCantonKallpa(paquete, "daule");

    expect(daule).not.toBeNull();
    expect(obtenerMesKallpa(daule!, 13)).toBeNull();
  });

  it("rechaza un paquete sin cantones", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ cantones: null }),
      })
    );

    await expect(cargarKallpaNuevo()).rejects.toThrow();
  });
});
