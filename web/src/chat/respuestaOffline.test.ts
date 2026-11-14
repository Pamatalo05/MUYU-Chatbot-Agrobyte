import { describe, expect, it } from "vitest";
import datosJson from "../../public/data/paquete_canton.json";
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
  it("rotación: recomienda soya tras arroz en Neutro, con cifras", () => {
    const respuesta = responderOffline(paquete, daule, "", "rotacion");
    expect(respuesta.text).toContain("soya");
    expect(respuesta.text).toContain("85");
    expect(respuesta.emotion).toBe("happy");
  });

  it("urea: calcula el ahorro por hectárea y en 5 hectáreas", () => {
    const respuesta = responderOffline(paquete, daule, "", "urea");
    expect(respuesta.text).toContain("85 USD");
    expect(respuesta.text).toContain("425 USD");
  });

  it("ENSO: compara lluvia y humedad con cifras del paquete", () => {
    const respuesta = responderOffline(paquete, daule, "", "enso");
    expect(respuesta.text).toContain("enero");
    expect(respuesta.text).toContain("340 mm");
    expect(respuesta.text).toContain("+160");
    expect(respuesta.text).toContain("cae");
  });

  it("resumen: usa el escenario y mes del contexto", () => {
    const respuesta = responderOffline(paquete, { ...daule, escenario: "la_nina" }, "", "resumen");
    expect(respuesta.text).toContain("Daule");
    expect(respuesta.text).toContain("La Niña");
    expect(respuesta.text).toContain("70 mm");
  });

  it("Sierra: avisa que faltan cultivos en lugar de inventar", () => {
    const respuesta = responderOffline(paquete, { ...daule, cantonId: "latacunga" }, "", "rotacion");
    expect(respuesta.text).toContain("Sierra");
    expect(respuesta.emotion).toBe("neutral");
  });

  it("pregunta desconocida: ofrece los botones sin inventar", () => {
    const respuesta = responderOffline(paquete, daule, "cuéntame un chiste");
    expect(respuesta.text).toContain("botones");
  });
});
