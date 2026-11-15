import { describe, expect, it } from "vitest";
import datosJson from "../../public/datos/paquete_canton.json";
import datosNuevos from "../../public/datos/nuevo/paquete_canton.json";
import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";
import type { MuyuContexto } from "../knowledge/contexto";
import { validarPaquete } from "../knowledge/validarPaquete";
import { detectarAccion } from "../chat/preguntasRapidas";
import { responderOffline } from "./respuestaOffline";

const paquete = validarPaquete(structuredClone(datosJson));
const paqueteNuevo = datosNuevos as PaqueteKallpa;
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

  it("urea: ahorro por hectárea en kilos, sacos y dólares, sin asumir el tamaño de la parcela", () => {
    const r = responderOffline(paquete, daule, "", "urea");
    // La opción que más urea ahorra en Daule (año normal) es la mucuna.
    expect(r.text).toContain("mucuna");
    expect(r.text).toContain("235 kg");
    expect(r.text).toContain("4,7 sacos");
    expect(r.text).toContain("179 USD por hectárea"); // 235/50 × 38
    expect(r.text).toContain("cuántas hectáreas tienes");
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

describe("Kallpa ML - modo offline", () => {
  it("usa las rotaciones nuevas", () => {
    const r = responderOffline(
      paquete, daule, "", "rotacion", paqueteNuevo
    );
    const esperado =
      paqueteNuevo.cantones.daule.top_rotaciones_por_enso.neutro[0].cultivo;

    expect(r.text).toContain(esperado);
    expect(r.text).toContain("Margen parcial");
  });

  it("muestra el ahorro de urea en kg", () => {
    const r = responderOffline(
      paquete, daule, "", "urea", paqueteNuevo
    );

    expect(r.text).toContain("kg de urea por hectárea");
    expect(r.text).not.toContain("290 USD");
  });

  it("compara El Niño y La Niña", () => {
    const r = responderOffline(
      paquete, daule, "", "enso", paqueteNuevo
    );

    expect(r.text).toContain("70,1 %");
    expect(r.text).toContain("63,9 %");
  });

  it("usa los valores ML en el resumen", () => {
    const r = responderOffline(
      paquete,
      { ...daule, escenario: "el_nino" },
      "",
      "resumen",
      paqueteNuevo
    );

    expect(r.text).toContain("136,6 mm");
    expect(r.text).toContain("70,1 %");
    expect(r.text).toContain("34,7 %");
  });

  it("funciona también con Babahoyo", () => {
    const r = responderOffline(
      paquete,
      { ...daule, cantonId: "babahoyo" },
      "",
      "resumen",
      paqueteNuevo
    );

    expect(r.text).toContain("Babahoyo");
  });
});



describe("definiciones y conversación sencilla en modo campo", () => {
  it.each([
    ["¿Qué es la urea?", "nitrógeno"],
    ["PERO QUÉ ES UREA", "nitrógeno"],
    ["¿Qué es la humedad del suelo?", "cantidad de agua"],
    ["¿Qué significa NDVI?", "imágenes satelitales"],
    ["¿Qué es la mucuna?", "abono verde"],
    ["Hola", "Hola"],
    ["Gracias", "Con gusto"],
  ])("responde %s sin recomendaciones ni fuentes innecesarias", (pregunta, esperado) => {
    const r = responderOffline(paquete, daule, pregunta, undefined, paqueteNuevo, "urea");
    expect(r.text).toContain(esperado);
    expect(r.evidencia).toBeUndefined();
    expect(r.text).not.toMatch(/USD|kg\/ha|Fuente:|Opción orientativa/);
  });
});
