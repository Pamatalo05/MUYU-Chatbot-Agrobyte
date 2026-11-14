import { describe, expect, it } from "vitest";
import datos from "../../public/datos/paquete_canton.json";
import { validarPaquete } from "./validarPaquete";

// Pruebas de rangos físicos (aporte del equipo), adaptadas al paquete de Daule y Babahoyo.
const copia = () => structuredClone(datos);

describe("Validaciones climáticas de Muyu", () => {
  it("acepta el paquete del repo de Kallpa", () => {
    expect(() => validarPaquete(datos)).not.toThrow();
  });

  it("rechaza precipitaciones negativas", () => {
    const d = copia();
    d.cantones.daule.serie_satelital_ml[0].lluvia_mm = -50;
    expect(() => validarPaquete(d)).toThrow("serie_satelital_ml[0].lluvia_mm");
  });

  it("rechaza humedad del suelo negativa", () => {
    const d = copia();
    d.cantones.daule.serie_satelital_ml[0].humedad_raiz_predicha.neutro = -0.5;
    expect(() => validarPaquete(d)).toThrow("humedad_raiz_predicha");
  });

  it("rechaza NDVI fuera de rango", () => {
    const d = copia();
    d.cantones.daule.serie_satelital_ml[0].ndvi_modis = 2;
    expect(() => validarPaquete(d)).toThrow("ndvi_modis");
  });

  it("rechaza temperaturas imposibles", () => {
    const d = copia();
    d.cantones.daule.serie_satelital_ml[0].temp_c = 100;
    expect(() => validarPaquete(d)).toThrow("temp_c");
  });

  it("rechaza un escenario ENSO sin cultivos de rotación", () => {
    const d = copia();
    d.cantones.babahoyo.top_rotaciones_por_enso.nina = [];
    expect(() => validarPaquete(d)).toThrow("top_rotaciones_por_enso.nina");
  });
});
