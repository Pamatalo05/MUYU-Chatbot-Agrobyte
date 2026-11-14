import { describe, expect, it } from "vitest";
import datosJson from "../../public/data/paquete_canton.json";
import {
  ConsultaInvalidaError,
  compararEscenarios,
  recomendarRotacion,
  resumenCanton,
} from "./kallpaConocimiento";
import type { PaqueteCanton } from "./types";
import { PaqueteInvalidoError, validarPaquete } from "./validarPaquete";

/** Copia nueva del JSON en cada uso, para que una prueba no altere a otra. */
const leerJson = (): unknown => structuredClone(datosJson);
const paquete: PaqueteCanton = validarPaquete(leerJson());

describe("validarPaquete", () => {
  it("acepta el paquete actual", () => {
    expect(Object.keys(paquete.cantones)).toHaveLength(8);
    expect(paquete.cultivos.length).toBeGreaterThan(0);
  });

  it("señala la ruta exacta del campo que falla", () => {
    const roto = leerJson() as PaqueteCanton;
    (roto.cantones.daule as unknown as Record<string, unknown>).altitud_m = "ocho";
    expect(() => validarPaquete(roto)).toThrow(PaqueteInvalidoError);
    expect(() => validarPaquete(roto)).toThrow("cantones.daule.altitud_m");
  });
});

describe("resumenCanton", () => {
  it("devuelve los datos del mes y escenario pedidos", () => {
    const resumen = resumenCanton(paquete, "daule", "la_nina", 1);
    expect(resumen.canton).toBe("Daule");
    expect(resumen.region).toBe("costa");
    expect(resumen.lluvia_mm_mes).toBe(70);
    expect(resumen.humedad_raiz).toBe(0.17);
    expect(resumen.escenarioNombre).toBe("La Niña");
  });

  it("rechaza cantones o meses inválidos con un mensaje claro", () => {
    expect(() => resumenCanton(paquete, "guayaquil", "neutro", 1)).toThrow(ConsultaInvalidaError);
    expect(() => resumenCanton(paquete, "daule", "neutro", 13)).toThrow("entre 1 y 12");
  });
});

describe("recomendarRotacion", () => {
  it("nunca recomienda repetir el cultivo previo", () => {
    for (const escenario of ["neutro", "el_nino", "la_nina"] as const) {
      const { recomendaciones } = recomendarRotacion(paquete, {
        cantonId: "daule",
        cultivoPrevioId: "arroz",
        escenario,
      });
      expect(recomendaciones.map((r) => r.id)).not.toContain("arroz");
    }
  });

  it("con La Niña empieza por un cultivo de baja demanda de agua", () => {
    const { recomendaciones } = recomendarRotacion(paquete, {
      cantonId: "daule",
      cultivoPrevioId: "arroz",
      escenario: "la_nina",
    });
    const primero = paquete.cultivos.find((c) => c.id === recomendaciones[0].id);
    expect(primero?.demanda_agua).toBe("baja");
    expect(recomendaciones).toHaveLength(3);
  });

  it("con El Niño descarta los que no toleran encharcamiento", () => {
    const { recomendaciones, descartados } = recomendarRotacion(paquete, {
      cantonId: "daule",
      cultivoPrevioId: "arroz",
      escenario: "el_nino",
    });
    for (const r of recomendaciones) {
      expect(paquete.cultivos.find((c) => c.id === r.id)?.tolera_encharcamiento).toBe(true);
    }
    expect(descartados.some((d) => d.id === "soya")).toBe(true);
  });

  it("en Neutro prioriza leguminosas que fijan nitrógeno", () => {
    const { recomendaciones } = recomendarRotacion(paquete, {
      cantonId: "daule",
      cultivoPrevioId: "arroz",
      escenario: "neutro",
    });
    expect(paquete.cultivos.find((c) => c.id === recomendaciones[0].id)?.fija_nitrogeno).toBe(true);
    expect(recomendaciones[0].razones.join(" ")).toContain("urea");
  });

  it("avisa que no hay cultivos de Sierra en cantones de altura", () => {
    const { recomendaciones, avisos } = recomendarRotacion(paquete, {
      cantonId: "latacunga",
      cultivoPrevioId: "arroz",
      escenario: "neutro",
    });
    expect(recomendaciones).toHaveLength(0);
    expect(avisos[0]).toContain("Sierra");
  });

  it("rechaza un cultivo previo inexistente", () => {
    expect(() =>
      recomendarRotacion(paquete, { cantonId: "daule", cultivoPrevioId: "cacao", escenario: "neutro" }),
    ).toThrow(ConsultaInvalidaError);
  });
});

describe("compararEscenarios", () => {
  it("compara los 3 escenarios contra Neutro", () => {
    const comparacion = compararEscenarios(paquete, "daule", 1);
    expect(comparacion.map((c) => c.escenario)).toEqual(["neutro", "el_nino", "la_nina"]);
    expect(comparacion[0].diferencia.lluvia_mm_mes).toBe(0);
    expect(comparacion[1].diferencia.lluvia_mm_mes).toBe(160);
    expect(comparacion[2].diferencia.humedad_raiz).toBe(-0.18);
  });
});
