import { afterEach, describe, expect, it, vi } from "vitest";
import { conSugerencias, leerPreferencias, resolverSeguimiento, validarPreferencias } from "./estilo";
import { responderPreguntaSencilla } from "../agent/guardarrailes";
import { resolverConsulta } from "../knowledge/contextoConversacion";
import { respuestaAgricola } from "../knowledge/consultaAgricola";
import datos from "../../public/datos/nuevo/paquete_canton.json";
import type { PaqueteKallpa } from "../knowledge/adaptadorKallpa";
const parcela = { cantonId: "daule", mes: 1, escenario: "el_nino" as const, cultivoPrevioId: "arroz" };
afterEach(() => vi.unstubAllGlobals());
describe("lenguaje y continuaciones", () => {
  it("entiende eso como urea y no como una nueva recomendación de mucuna", () => {
    const historial = [{ role: "user", text: "¿Qué es la urea?" }, { role: "muyu", text: "La urea aporta nitrógeno." }];
    const pregunta = resolverSeguimiento("¿Y eso sirve para el arroz?", historial);
    const respuesta = responderPreguntaSencilla(pregunta)!;
    expect(respuesta.text).toContain("arroz");
    expect(respuesta.text).toContain("nitrógeno");
    expect(respuesta.text).not.toMatch(/mucuna|kg|USD/);
    expect(parcela.cantonId).toBe("daule");
  });
  it("amplía una definición y sus sugerencias realmente resuelven una continuación", () => {
    const pregunta = "¿Qué es la urea?";
    const breve = responderPreguntaSencilla(pregunta)!;
    const sugerencias = conSugerencias(breve).sugerencias!;
    expect(sugerencias).toHaveLength(2);
    const ampliada = responderPreguntaSencilla(resolverSeguimiento(sugerencias[0].texto, [{ role: "user", text: pregunta }]))!;
    expect(ampliada.text.length).toBeGreaterThan(breve.text.length);
    expect(ampliada.text).toContain("Por ejemplo");
  });
  it.each(["Explícamelo más fácil", "¿Por qué?", "Muéstrame las fuentes", "¿Qué significa eso?"])("conserva el contexto agrícola al preguntar %s", pregunta => {
    const c = resolverConsulta(pregunta, { ...parcela, cantonId: "babahoyo", mes: 5 }, { contexto: parcela, tema: "humedad_raiz" });
    expect(c.tema).toBe("humedad_raiz");
    expect(c.contexto).toEqual(parcela);
    expect(c.error).toBeUndefined();
  });
  it("no infiere referencias de una afirmación del asistente ni inventa memoria", () => {
    expect(resolverSeguimiento("¿Y eso sirve para el arroz?", [{ role: "muyu", text: "¿Qué es la urea?" }])).toBe("¿Y eso sirve para el arroz?");
  });
  it("sencillo es breve, técnico conserva los mismos valores y fuentes en metadatos", () => {
    const consulta = resolverConsulta("Humedad de raíz en Daule en enero bajo El Niño", parcela);
    const breve = respuestaAgricola(consulta, datos as PaqueteKallpa, "humedad")!;
    const detallada = respuestaAgricola(consulta, datos as PaqueteKallpa, "humedad", undefined, { nivel: "tecnico", longitud: "detallada" })!;
    expect(breve.text).toContain("70,1 %");
    expect(breve.text).not.toMatch(/Ridge|paquete|JSON|Fuente:/);
    expect(detallada.text).toContain("Ridge");
    expect(detallada.evidencia).toEqual(breve.evidencia);
    expect(detallada.text.length).toBeGreaterThan(breve.text.length);
    expect(breve.text.split(/[.!](?:\s|$)/).filter(Boolean).length).toBeLessThanOrEqual(4);
  });
});
describe("preferencias locales", () => {
  it("usa valores seguros ante preferencias inválidas", () => {
    expect(validarPreferencias({ nivel: "inventado", longitud: "infinita" })).toEqual({ nivel: "sencillo", longitud: "breve" });
  });
  it("recupera preferencias guardadas sin datos personales", () => {
    vi.stubGlobal("localStorage", { getItem: () => '{"nivel":"normal","longitud":"detallada"}' });
    expect(leerPreferencias()).toEqual({ nivel: "normal", longitud: "detallada" });
  });
  it("no bloquea el chat si el almacenamiento está deshabilitado", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Denegado"); } });
    expect(leerPreferencias()).toEqual({ nivel: "sencillo", longitud: "breve" });
  });
});
