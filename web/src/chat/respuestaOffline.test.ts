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

describe("responderOffline fuera de tema", () => {
  it("política sin internet: mismo mensaje fijo y sugerencias", () => {
    const r = responderOffline(paquete, daule, "¿qué opinas de la política?");
    expect(r.text).toContain("No estoy diseñado");
    expect(r.sugerencias).toHaveLength(3);
  });
});

describe("tono de Muyu", () => {
  it("abre con una frase cálida, salvo ante un riesgo alto", () => {
    const normal = responderOffline(paquete, daule, "¿qué siembro?", "rotacion");
    expect(/^¡.+!/.test(normal.text)).toBe(true);
    const riesgo = responderOffline(paquete, { ...daule, escenario: "el_nino", mes: 3 }, "", "rotacion");
    expect(riesgo.text.startsWith("⚠️")).toBe(true);
  });
});

describe("responderOffline", () => {
  it("rotación: sigue el orden de Kallpa (soya en año normal), con ganancia y fuente", () => {
    const r = responderOffline(paquete, daule, "", "rotacion");
    expect(r.text).toContain("soya de rotación INIAP-308");
    expect(r.text).toContain("85 kg de nitrógeno");
    expect(r.text).toContain("660 USD por hectárea"); // 1180 − 520
    expect(r.text).toContain("INIAP");
    expect(r.text).toContain("fréjol caupí y mucuna");
    expect(r.emotion).toBe("happy");
  });

  it("rotación con El Niño: fréjol caupí primero", () => {
    expect(responderOffline(paquete, { ...daule, escenario: "el_nino" }, "", "rotacion").text).toContain("fréjol caupí INIAP-463");
  });

  it("urea: kilos, sacos y dólares con el precio de referencia, sin inventar hectáreas", () => {
    const r = responderOffline(paquete, daule, "", "urea");
    expect(r.text).toContain("185 kg");
    expect(r.text).toContain("3,7 sacos");
    expect(r.text).toContain("141 USD"); // 185/50 × 38
    expect(r.text).not.toContain("5 hectáreas");
  });

  it("ENSO: compara la humedad del suelo predicha y explica el riesgo", () => {
    const r = responderOffline(paquete, daule, "", "enso");
    expect(r.text).toContain("enero");
    expect(r.text).toContain("67 %");
    expect(r.text).toContain("70 % (+3 puntos)");
    expect(r.text).toContain("siembra con precaución");
  });

  it("resumen: usa el escenario y mes del contexto", () => {
    const r = responderOffline(paquete, { ...daule, escenario: "la_nina" }, "", "resumen");
    expect(r.text).toContain("Daule");
    expect(r.text).toContain("La Niña");
    expect(r.text).toContain("137 mm");
    expect(r.text).toContain("64 %");
  });

  it("Babahoyo: usa sus propios datos", () => {
    const r = responderOffline(paquete, { ...daule, cantonId: "babahoyo" }, "", "resumen");
    expect(r.text).toContain("Babahoyo");
    expect(r.text).toContain("136 mm");
  });

  it("pregunta desconocida: ofrece 3 sugerencias sin inventar", () => {
    const r = responderOffline(paquete, daule, "cuéntame un chiste");
    expect(r.text).toContain("te sugiero");
    expect(r.sugerencias).toHaveLength(3);
  });
});
