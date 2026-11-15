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

describe("responderOffline", () => {
  it("rotación: recomienda soya tras arroz en Neutro, con margen y fuente", () => {
    const r = responderOffline(paquete, daule, "", "rotacion");
    expect(r.text).toContain("soya");
    expect(r.text).toContain("750 USD/ha");
    expect(r.text).toContain("INIAP");
    expect(r.emotion).toBe("happy");
  });

  it("urea: calcula el ahorro por hectárea sin asumir el tamaño de la parcela", () => {
    const r = responderOffline(paquete, daule, "", "urea");

    expect(r.text).toContain("290 USD");
    expect(r.text).toContain("por hectárea");
    expect(r.text).toContain("cuántas hectáreas tienes");
    expect(r.text).not.toContain("1.450 USD");
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

  it("pregunta desconocida: ofrece 3 sugerencias sin inventar", () => {
    const r = responderOffline(paquete, daule, "cuéntame un chiste");
    expect(r.text).toContain("Te sugiero");
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

