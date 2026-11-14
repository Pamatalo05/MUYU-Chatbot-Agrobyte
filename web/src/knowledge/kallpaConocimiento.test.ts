import { describe, expect, it } from "vitest";
import datosJson from "../../public/datos/paquete_canton.json";
import {
  ConsultaInvalidaError,
  compararEscenarios,
  cultivosDelPaquete,
  humedadVentana,
  precioUrea,
  recomendarRotacion,
  resumenCanton,
} from "./kallpaConocimiento";
import { validarPaquete } from "./validarPaquete";

const paquete = validarPaquete(structuredClone(datosJson));

describe("paquete de Kallpa", () => {
  it("solo trae los cantones que define el repo de Kallpa", () => {
    expect(Object.keys(paquete.cantones)).toEqual(["daule", "babahoyo"]);
  });

  it("reúne los 4 cultivos de rotación sin repetir", () => {
    expect(cultivosDelPaquete(paquete).map((c) => c.id).sort()).toEqual([
      "frejol_caupi_iniap_463",
      "mani_iniap_381",
      "mucuna_pruriens",
      "soya_iniap_308",
    ]);
  });

  it("lee el precio de referencia de la urea del texto de fuentes", () => {
    expect(precioUrea(paquete)).toEqual({ usdSaco: 38, kgSaco: 50 });
  });
});

describe("resumenCanton", () => {
  it("une la climatología del mes con la humedad que predice el modelo para el escenario", () => {
    const r = resumenCanton(paquete, "daule", "la_nina", 1);
    expect(r.lluvia_mm).toBe(136.6);
    expect(r.ndvi_modis).toBe(0.63);
    expect(r.humedad_raiz).toBe(0.639);
  });

  it("rechaza cantones o meses inválidos con un mensaje claro", () => {
    expect(() => resumenCanton(paquete, "latacunga", "neutro", 1)).toThrow(ConsultaInvalidaError);
    expect(() => resumenCanton(paquete, "daule", "neutro", 13)).toThrow("entre 1 y 12");
  });
});

describe("recomendarRotacion", () => {
  it("sigue el orden de Kallpa para cada fase ENSO", () => {
    const primero = (escenario: "neutro" | "el_nino" | "la_nina") =>
      recomendarRotacion(paquete, { cantonId: "daule", escenario }).recomendaciones[0].id;
    expect(primero("neutro")).toBe("soya_iniap_308");
    expect(primero("el_nino")).toBe("frejol_caupi_iniap_463");
    expect(primero("la_nina")).toBe("mani_iniap_381");
  });

  it("calcula ganancia y ahorro de urea en sacos y dólares", () => {
    const [soya] = recomendarRotacion(paquete, { cantonId: "daule", escenario: "neutro" }).recomendaciones;
    expect(soya.ganancia_ha).toBe(660);
    expect(soya.ahorro_urea_sacos).toBe(3.7);
    expect(soya.ahorro_urea_usd).toBe(141);
    expect(soya.fuente).toBe("INIAP Estación Experimental Boliche");
  });
});

describe("humedad y escenarios", () => {
  it("promedia la humedad predicha de los próximos 3 meses", () => {
    expect(humedadVentana(paquete, "daule", "el_nino", 3)).toBe(0.852);
    // La ventana da la vuelta al año: noviembre, diciembre y enero.
    expect(humedadVentana(paquete, "daule", "neutro", 11)).toBe(0.554);
  });

  it("compara la humedad de cada escenario contra Neutro", () => {
    const [neutro, nino, nina] = compararEscenarios(paquete, "daule", 1);
    expect(neutro.diferencia_humedad).toBe(0);
    expect(nino.diferencia_humedad).toBe(0.033);
    expect(nina.diferencia_humedad).toBe(-0.029);
  });
});
