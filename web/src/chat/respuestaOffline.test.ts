import { describe, expect, it } from "vitest";
import datosJson from "../../public/datos/paquete_canton.json";
import type { MuyuContexto } from "../knowledge/contexto";
import { validarPaquete } from "../knowledge/validarPaquete";
import { detectarAccion } from "./preguntasRapidas";
import { responderOffline } from "./respuestaOffline";

const paquete = validarPaquete(structuredClone(datosJson));
const daule: MuyuContexto = { cantonId: "daule", cultivoPrevioId: "arroz", escenario: "neutro", mes: 1 };

describe("detectarAccion", () => {
  it("reconoce el tema de preguntas escritas", () => {
    expect(detectarAccion("¿Qué siembro después del arroz?")).toBe("rotacion");
    expect(detectarAccion("¿Cuánto ahorro en urea?")).toBe("urea");
    expect(detectarAccion("¿Qué pasa si viene El Niño?")).toBe("enso");
    expect(detectarAccion("¿Cuánta lluvia hay en mi cantón?")).toBe("resumen");
    expect(detectarAccion("cuéntame un chiste")).toBe(null);
  });
});

describe("responderOffline", () => {
  it("rotación: recomienda soya tras arroz en Neutro, con margen y fuente", () => {
    const r = responderOffline(paquete, daule, "", "rotacion");
    expect(r.text).toContain("soya");
    expect(r.text).toContain("750 USD/ha");
    expect(r.text).toContain("INIAP");
    expect(r.emotion).toBe("happy");
  });

  it("urea: calcula el ahorro por hectárea y en 5 hectáreas", () => {
    const r = responderOffline(paquete, daule, "", "urea");
    expect(r.text).toContain("290 USD");
    expect(r.text).toContain("1.450 USD");
  });

  it("ENSO: compara la lluvia y explica el riesgo para sembrar", () => {
    const r = responderOffline(paquete, daule, "", "enso");
    expect(r.text).toContain("enero");
    expect(r.text).toContain("+22");
    expect(r.text).toContain("exceso de lluvia");
    expect(r.text).toContain("sequía");
  });

  it("resumen: usa el escenario y mes del contexto", () => {
    const r = responderOffline(paquete, { ...daule, escenario: "la_nina" }, "", "resumen");
    expect(r.text).toContain("Daule");
    expect(r.text).toContain("La Niña");
    expect(r.text).toContain("115 mm");
  });

  it("Sierra: recomienda cultivos de altura", () => {
    const r = responderOffline(paquete, { ...daule, cantonId: "latacunga", cultivoPrevioId: "papa" }, "", "rotacion");
    expect(r.text).toContain("haba");
    expect(r.emotion).toBe("happy");
  });

  it("pregunta desconocida: ofrece los botones sin inventar", () => {
    expect(responderOffline(paquete, daule, "cuéntame un chiste").text).toContain("botones");
  });
});
