
import { describe, expect, it } from "vitest";
import datos from "../../public/datos/nuevo/paquete_canton.json";
import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";
import { consultarKallpaML } from "./herramientaKallpaNueva";

const paquete = datos as PaqueteKallpa;

describe("Herramienta Kallpa ML", () => {
  it("consulta datos reales de Daule", () => {
    const resultado = consultarKallpaML(paquete, {
      canton_id: "daule",
      escenario: "nino",
      mes: 1,
    });

    expect(resultado.error).toBeUndefined();
    expect(resultado.canton).toBe("Daule, Guayas");
    expect(resultado.modelo).toBe("Ridge");
    expect(Array.isArray(resultado.recomendaciones)).toBe(true);
  });

  it("rechaza cantones inexistentes", () => {
    const resultado = consultarKallpaML(paquete, {
      canton_id: "quito",
      escenario: "neutro",
      mes: 1,
    });

    expect(resultado.error).toBeDefined();
  });

  it("rechaza meses inválidos", () => {
    const resultado = consultarKallpaML(paquete, {
      canton_id: "daule",
      escenario: "neutro",
      mes: 13,
    });

    expect(resultado.error).toBeDefined();
  });

  it("rechaza escenarios desconocidos", () => {
    const resultado = consultarKallpaML(paquete, {
      canton_id: "daule",
      escenario: "huracan",
      mes: 1,
    });

    expect(resultado.error).toBeDefined();
  });
});
