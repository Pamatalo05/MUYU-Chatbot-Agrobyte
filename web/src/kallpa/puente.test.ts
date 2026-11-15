import { describe, expect, it } from "vitest";
import { CONTEXTO_INICIAL } from "../knowledge/contexto";
import { contextoDesdeKallpa, cultivoDesdeKallpa, interpretarParcela } from "./puente";

describe("puente con Kallpa", () => {
  it("entiende el cultivo como lo escribe Kallpa", () => {
    expect(cultivoDesdeKallpa("Maíz duro")).toBe("maiz_duro");
    expect(cultivoDesdeKallpa("MAIZ")).toBe("maiz_duro");
    expect(cultivoDesdeKallpa("Arroz")).toBe("arroz");
    expect(cultivoDesdeKallpa(undefined)).toBe("");
  });

  it("lee el JSON del puente Android", () => {
    const p = interpretarParcela('{"cantonId":"Babahoyo","cultivo":"Maíz","hectareas":2.5,"conRiego":true,"mes":3}');
    expect(p).toEqual({
      cantonId: "babahoyo",
      cultivoPrevioId: "maiz_duro",
      nombreParcela: undefined,
      hectareas: 2.5,
      conRiego: true,
      mes: 3,
    });
  });

  it("ignora datos rotos o sin cantón", () => {
    expect(interpretarParcela("{no es json")).toBe(null);
    expect(interpretarParcela({ cultivo: "Arroz" })).toBe(null);
  });

  it("solo usa cantones que existen en el paquete", () => {
    const base = { ...CONTEXTO_INICIAL, mes: 1 };
    const fuera = contextoDesdeKallpa(base, { cantonId: "quito", cultivoPrevioId: "arroz" }, ["daule", "babahoyo"]);
    expect(fuera.cantonId).toBe("daule");
    const ok = contextoDesdeKallpa(base, { cantonId: "babahoyo", cultivoPrevioId: "maiz_duro", mes: 5 }, ["daule", "babahoyo"]);
    expect(ok).toEqual({ ...base, cantonId: "babahoyo", cultivoPrevioId: "maiz_duro", mes: 5 });
  });
});

it("no sustituye un cultivo desconocido por arroz", () => {
  expect(cultivoDesdeKallpa("Mucuna")).toBe("");
  expect(interpretarParcela({ cantonId: "Daule", cultivo: "Mucuna" })).toBeNull();
});
it("un cantón sin datos no altera silenciosamente otros campos de la parcela", () => {
  const base = { ...CONTEXTO_INICIAL, cultivoPrevioId: "arroz", mes: 1 };
  expect(contextoDesdeKallpa(base, { cantonId: "quito", cultivoPrevioId: "maiz_duro", mes: 5 }, ["daule", "babahoyo"])).toEqual(base);
});
