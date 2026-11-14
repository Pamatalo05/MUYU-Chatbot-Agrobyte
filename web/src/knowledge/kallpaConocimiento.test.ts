import { describe, expect, it } from "vitest";
import datosJson from "../../public/datos/paquete_canton.json";
import {
  balanceHidrico,
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
const rotacion = (cantonId: string, cultivoPrevioId: string, escenario: "neutro" | "el_nino" | "la_nina", mes = 1) =>
  recomendarRotacion(paquete, { cantonId, cultivoPrevioId, escenario, mes });

describe("validarPaquete", () => {
  it("acepta el paquete del repo de Kallpa", () => {
    expect(Object.keys(paquete.cantones)).toHaveLength(8);
    expect(paquete.cultivos).toHaveLength(11);
  });

  it("señala la ruta exacta del campo que falla", () => {
    const roto = leerJson() as { cantones: { daule: { terreno: Record<string, unknown> } } };
    roto.cantones.daule.terreno.elevacion_msnm = "cinco";
    expect(() => validarPaquete(roto)).toThrow(PaqueteInvalidoError);
    expect(() => validarPaquete(roto)).toThrow("cantones.daule.terreno.elevacion_msnm");
  });

  it("rechaza regiones guardadas como texto en vez de lista", () => {
    const roto = leerJson() as { cultivos: Record<string, unknown>[] };
    roto.cultivos[0].regiones = "['costa_humeda']";
    expect(() => validarPaquete(roto)).toThrow("cultivos[0].regiones");
  });
});

describe("resumenCanton", () => {
  it("une clima del escenario, NDVI y la predicción de ML", () => {
    const r = resumenCanton(paquete, "daule", "la_nina", 1);
    expect(r.piso).toBe("costa");
    expect(r.lluvia_mm_mes).toBe(115.05);
    expect(r.ndvi_modis).toBe(0.434);
    expect(r.humedad_raiz_ml).toBe(0.637);
    expect(resumenCanton(paquete, "latacunga", "neutro", 1).piso).toBe("sierra");
  });

  it("rechaza cantones o meses inválidos con un mensaje claro", () => {
    expect(() => resumenCanton(paquete, "guayaquil", "neutro", 1)).toThrow(ConsultaInvalidaError);
    expect(() => resumenCanton(paquete, "daule", "neutro", 13)).toThrow("entre 1 y 12");
  });
});

describe("balanceHidrico", () => {
  it("usa la lluvia real del cantón, no un factor fijo por escenario", () => {
    expect(balanceHidrico(paquete, "daule", "el_nino", 1).balance).toBe("exceso");
    expect(balanceHidrico(paquete, "daule", "la_nina", 1).balance).toBe("deficit");
    // En Latacunga, El Niño casi no cambia la lluvia de enero a marzo.
    expect(balanceHidrico(paquete, "latacunga", "el_nino", 1).balance).toBe("normal");
  });
});

describe("recomendarRotacion", () => {
  it("nunca recomienda repetir el cultivo previo", () => {
    for (const escenario of ["neutro", "el_nino", "la_nina"] as const) {
      expect(rotacion("daule", "arroz", escenario).recomendaciones.map((r) => r.id)).not.toContain("arroz");
    }
  });

  it("solo recomienda cultivos de la región del cantón", () => {
    for (const r of rotacion("latacunga", "papa", "neutro").recomendaciones) {
      expect(paquete.cultivos.find((c) => c.id === r.id)?.regiones).toContain("sierra_centro");
    }
    expect(rotacion("daule", "arroz", "neutro").descartados.find((d) => d.id === "mani")?.motivo).toContain("costa húmeda");
  });

  it("en Neutro prioriza leguminosas y desempata por margen neto", () => {
    const { recomendaciones } = rotacion("daule", "arroz", "neutro");
    expect(recomendaciones[0].id).toBe("soya");
    expect(recomendaciones[0].margen_neto_ha).toBe(1190 - 620 + 180);
  });

  it("con déficit de lluvia empieza por un cultivo de baja demanda de agua", () => {
    const { recomendaciones } = rotacion("daule", "arroz", "la_nina");
    expect(paquete.cultivos.find((c) => c.id === recomendaciones[0].id)?.demanda_agua).toBe("baja");
  });

  it("con exceso de lluvia descarta los que no toleran encharcamiento y lo avisa", () => {
    const { recomendaciones, descartados, avisos } = rotacion("daule", "arroz", "el_nino");
    for (const r of recomendaciones) {
      expect(paquete.cultivos.find((c) => c.id === r.id)?.tolera_encharcamiento).toBe(true);
    }
    expect(descartados.some((d) => d.id === "soya")).toBe(true);
    expect(avisos[0]).toContain("Solo 1");
  });

  it("rechaza un cultivo previo inexistente", () => {
    expect(() => rotacion("daule", "cacao", "neutro")).toThrow(ConsultaInvalidaError);
  });
});

describe("compararEscenarios", () => {
  it("compara los 3 escenarios contra Neutro", () => {
    const [neutro, nino, nina] = compararEscenarios(paquete, "daule", 1);
    expect(neutro.diferencia.lluvia_mm_mes).toBe(0);
    expect(nino.diferencia.lluvia_mm_mes).toBe(22.23);
    expect(nina.escenario).toBe("la_nina");
  });
});
