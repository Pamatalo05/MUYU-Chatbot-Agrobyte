import { describe, expect, it } from "vitest";
import datos from "../../public/datos/paquete_canton.json";
import { validarPaquete } from "./validarPaquete";

describe("Validaciones climáticas de Muyu", () => {
  it("acepta el paquete original", () => {
    expect(() => validarPaquete(datos)).not.toThrow();
  });

  it("rechaza precipitaciones negativas", () => {
    const copia = structuredClone(datos);
    copia.cantones.daule.escenarios_climaticos.neutro[0].lluvia_mm_mes = -50;

    expect(() => validarPaquete(copia)).toThrow();
  });

  it("rechaza humedad del suelo negativa", () => {
    const copia = structuredClone(datos);
    copia.cantones.daule.escenarios_climaticos.neutro[0].humedad_raiz = -0.5;

    expect(() => validarPaquete(copia)).toThrow();
  });

  it("rechaza NDVI fuera de rango", () => {
    const copia = structuredClone(datos);
    copia.cantones.daule.serie_satelital_ml[0].ndvi_modis = 2;

    expect(() => validarPaquete(copia)).toThrow();
  });

  it("rechaza temperatura mínima mayor que máxima", () => {
    const copia = structuredClone(datos);
    copia.cantones.daule.escenarios_climaticos.neutro[0].temp_min_c = 100;

    expect(() => validarPaquete(copia)).toThrow();
  });
});
