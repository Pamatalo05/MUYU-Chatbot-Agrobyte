import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { explicarSemaforo } from "./explicarSemaforo";
import SemaforoRiesgo from "./SemaforoRiesgo";
describe("semáforo comprensible sin nuevas condiciones", () => {
  it("el exceso da revisiones de drenaje sin afirmar que hay inundación", () => {
    const r = explicarSemaforo({ color: "rojo", motivo: "exceso de lluvia (+40 % frente a un año normal)" });
    expect(r.estado).toBe("Condiciones desfavorables");
    expect(r.explicacion).toContain("no confirma");
    expect(r.acciones).toHaveLength(2);
    expect(r.acciones.join(" ")).toContain("agua pueda salir");
  });
  it("el déficit no inventa una humedad medida", () => {
    const r = explicarSemaforo({ color: "amarillo", motivo: "sequía (-20 % frente a un año normal)" });
    expect(r.explicacion).toContain("no es una medición");
    expect(r.acciones.join(" ")).not.toContain("drenaje");
  });
  it("no asigna acciones personalizadas a un motivo desconocido", () => {
    expect(explicarSemaforo({ color: "verde", motivo: "" }).acciones).toEqual([]);
  });
  it("el verde sigue siendo una evaluación parcial, con consulta accesible", () => {
    const html = renderToStaticMarkup(createElement(SemaforoRiesgo, { color: "verde", motivo: "lluvia cercana a lo normal", onConsultar: () => {} }));
    expect(html).toContain("no evalúa por completo");
    expect(html).toContain("Preguntar a Muyu");
    expect(html).not.toMatch(/paquete|JSON|Reglas de/);
  });
});
