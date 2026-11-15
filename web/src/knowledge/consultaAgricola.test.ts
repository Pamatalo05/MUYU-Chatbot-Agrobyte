import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SemaforoRiesgo from "../kallpa/SemaforoRiesgo";
import { describe, it, expect } from "vitest";
import datos from "../../public/datos/nuevo/paquete_canton.json";
import original from "../../public/datos/paquete_canton.json";
import { respuestaAgricola, validarRedaccion, fundamentarRespuesta, contextoHerramientaValido } from "./consultaAgricola";
import { resolverConsulta } from "./contextoConversacion";
import type { PaqueteKallpa } from "./adaptadorKallpa";
import { validarPaquete } from "./validarPaquete";
import { consultarKallpaML } from "../agent/herramientaKallpaNueva";
import { responderOffline } from "../chat/respuestaOffline";
import { responderGemini } from "../chat/responderGemini";
import { conversar } from "../agent/agente";

const paquete = datos as PaqueteKallpa;
const previo = validarPaquete(structuredClone(original));
const parcela = { cantonId: "babahoyo", mes: 5, escenario: "neutro" as const, cultivoPrevioId: "arroz" };
const pregunta = "¿Cuál es la humedad de raíz en Daule durante enero bajo El Niño?";
const consulta = resolverConsulta(pregunta, parcela);
const factual = respuestaAgricola(consulta, paquete, pregunta)!;
const correcto = "La humedad de raíz predicha en Daule para enero bajo El Niño es 70,1 %. Es una estimación del modelo, no una medición directa.";
function simular(texto: string, args = { canton_id: "daule", mes: 1, escenario: "nino" }) {
  const solicitudes: any[] = [];
  const fetchImpl = (async (_url, init) => {
    solicitudes.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: solicitudes.length === 1 ? [{ functionCall: { id: "call-1", name: "consultar_kallpa_ml", args }, thoughtSignature: "opaque-signature" }] : [{ text: texto }] } }] }), { status: 200 });
  }) as typeof fetch;
  return { solicitudes, fetchImpl };
}

describe("respuestas científicas y trazabilidad", () => {
  it("enero produce 70,1 y la continuación de noviembre produce 49,9", () => {
    expect(factual.text).toContain("70,1 %");
    const siguiente = resolverConsulta("¿Y en noviembre?", parcela, { contexto: consulta.contexto, tema: consulta.tema! });
    const r = respuestaAgricola(siguiente, paquete, "¿Y en noviembre?")!;
    expect(r.text).toContain("49,9 %");
    expect(r.evidencia?.contexto).toEqual({ ...consulta.contexto, mes: 11 });
  });
  it("atribuye Ridge a Kallpa y conserva las fuentes y período documentados", () => {
    expect(factual.evidencia?.tipo).toContain("Ridge");
    expect(factual.evidencia?.periodo).toBe(datos.meta.periodo_analizado);
    expect(factual.evidencia?.fuentesDocumentadas).toEqual(Object.values(datos.fuentes_metodologia));
    expect(factual.evidencia?.datos[0]).toMatchObject({ valor: 0.701, unidad: "m³/m³", tipo: "estimación de Ridge" });
    expect(factual.text).toContain("no mediciones actuales");
    expect(factual.text).not.toMatch(/Ridge|NASA|paquete|JSON/);
    const herramienta = consultarKallpaML(paquete, { canton_id: "daule", mes: 1, escenario: "nino" });
    expect(herramienta.trazabilidad).toMatchObject({ periodo: "2005-2025", unidad_humedad: "m³/m³ (fracción volumétrica)", fuentes_documentadas: datos.fuentes_metodologia });
  });
  it("conserva una explicación natural cuando las cifras y el contexto coinciden", () => {
    expect(validarRedaccion(correcto, factual.evidencia!)).toBe(true);
    expect(fundamentarRespuesta(correcto, factual).text).toBe(correcto);
    const estiloNatural = "70,1 % es la humedad de raíz predicha para enero en Daule bajo el escenario El Niño.\nRecuerda que este valor es una estimación del modelo y no una medición directa.";
    expect(fundamentarRespuesta(estiloNatural, factual).text).toBe(estiloNatural);
  });
  it.each([
    "La humedad de raíz predicha para enero es 49,9 %.",
    "La humedad de raíz predicha es 70,1 %. Esta cifra proviene de un sensor.",
    "La humedad de raíz predicha es 70,1 % según un sensor.",
    "La humedad de raíz predicha en Guayaquil es 70,1 %.",
    "La humedad de raíz predicha es 70,1 %. El suelo está saturado.",
    "La humedad de raíz predicha para noviembre es 70,1 %.",
    "La humedad de raíz predicha en Babahoyo es 70,1 %.",
    "La humedad de raíz predicha bajo La Niña es 70,1 %.",
    "La humedad superficial predicha es 70,1 %.",
    "La humedad de raíz predicha es 70,1 mm.",
    "La humedad de raíz predicha es 70,1 %. La lluvia es 70,1 mm.",
    "La humedad de raíz predicha es 70,1 %. La probabilidad de germinación es 90 %.",
    "La humedad de raíz estimada según NASA es 70,1 %.",
    "La humedad de raíz predicha es 70,1 %. Conviene sembrar arroz.",
    "La humedad de raíz predicha es 70,1 %. La lluvia será cien mm.",
    "La humedad de raíz observada es 70,1 %, según el modelo.",
    "NASA predice la humedad de raíz en 70,1 %.",
    "La humedad de raíz predicha es 70,1 % de capacidad de campo.",
  ])("rechaza una cifra, unidad, atribución o contexto contradictorio: %s", texto => {
    expect(fundamentarRespuesta(texto, factual)).toEqual(factual);
  });
  it("relaciona las variables disponibles sin convertirlas en garantía de siembra", () => {
    const q = "Humedad y lluvia en Daule durante enero bajo El Niño para sembrar";
    const c = resolverConsulta(q, parcela);
    const r = respuestaAgricola(c, paquete, q)!;
    expect(c.tema).toBe("resumen");
    expect(r.text).toContain("70,1 %");
    expect(r.text).toContain("136,6 mm");
    expect(r.text).toContain("por sí solas no permiten recomendar");
    expect(r.evidencia?.datos.some(d => d.campo === "lluvia_mm")).toBe(true);
  });
  it("no acepta intercambiar las dos humedades aunque ambas cifras aparezcan en la evidencia", () => {
    const c = resolverConsulta("Resumen en Daule durante enero bajo El Niño", parcela);
    const resumen = respuestaAgricola(c, paquete, "Resumen")!;
    const incorrecto = "La humedad de raíz predicha es 34,7 % y la humedad superficial es 70,1 %. La lluvia es 136,6 mm. La temperatura es 37,7 °C. El NDVI es 0,63.";
    expect(fundamentarRespuesta(incorrecto, resumen)).toEqual(resumen);
  });
  it("no confunde humedad superficial con raíz", () => {
    const c = resolverConsulta("Humedad superficial en Daule durante enero bajo El Niño", parcela);
    expect(respuestaAgricola(c, paquete, "Humedad superficial")!.text).toContain("34,7 %");
    expect(respuestaAgricola(c, paquete, "Humedad superficial")!.evidencia?.datos[0].tipo).toContain("SMAP");
  });
  it("el semáforo visible identifica sus reglas sin prometer una siembra segura", () => {
    const html = renderToStaticMarkup(createElement(SemaforoRiesgo, { color: "verde", motivo: "lluvia cercana a lo normal" }));
    expect(html).toContain("Condiciones favorables");
    expect(html).toContain("solo considera lluvia y opciones de rotación");
    expect(html).not.toMatch(/Indicador orientativo|paquete original/);
    expect(html).not.toContain("Buen momento para sembrar");
  });
  it("no convierte datos ausentes o de relleno en observaciones", () => {
    const roto = structuredClone(paquete);
    (roto.cantones.daule.serie_satelital_ml[0].humedad_raiz_predicha as any).nino = null;
    expect(respuestaAgricola(consulta, roto, pregunta)?.evidencia).toBeUndefined();
    roto.cantones.daule.serie_satelital_ml[0].smap_humedad_superficial = -9999;
    const r = consultarKallpaML(roto, { canton_id: "daule", mes: 1, escenario: "nino" });
    expect((r.clima as any).humedad_superficial_smap).toBeNull();
    expect(respuestaAgricola(consulta, undefined, pregunta)?.text).toContain("No están disponibles");
  });
  it("un indicador calculado se presenta como regla orientativa y no como probabilidad", () => {
    const c = resolverConsulta("¿Qué riesgo hay?", consulta.contexto);
    const r = respuestaAgricola(c, paquete, "riesgo", previo)!;
    expect(r.text).toContain("solo considera humedad de raíz estimada");
    expect(r.evidencia?.fuentesDocumentadas).toEqual(Object.values(original.fuentes_metodologia));
    expect(r.text).not.toMatch(/probabilidad de|% de riesgo/);
    expect(r.evidencia?.fuente).toContain("original");
  });
  it("valida argumentos de la herramienta y conserva el mismo contexto en ambos modos", async () => {
    expect(contextoHerramientaValido({ canton_id: "daule", mes: 11, escenario: "nino" }, consulta.contexto)).toBe(false);
    const { fetchImpl, solicitudes } = simular(correcto);
    const enLinea = await conversar({ pregunta, historial: [], contexto: parcela }, { apiKey: "fake", paquete: previo, paqueteNuevo: paquete, fetchImpl });
    const campo = responderOffline(previo, parcela, pregunta, undefined, paquete);
    expect(enLinea.evidencia).toEqual(campo.evidencia);
    expect(enLinea.text).toBe(correcto);
    expect(solicitudes[1].contents.at(-2).parts[0].thoughtSignature).toBe("opaque-signature");
    expect(solicitudes[1].contents.at(-1).parts[0].functionResponse.id).toBe("call-1");
    expect(solicitudes[0].systemInstruction.parts[0].text).not.toContain("0.499");
  });
  it("un contexto equivocado de Gemini no ejecuta una consulta de otro mes", async () => {
    const { fetchImpl, solicitudes } = simular("La humedad de raíz predicha es 49,9 %.", { canton_id: "daule", mes: 11, escenario: "nino" });
    const r = await conversar({ pregunta, historial: [], contexto: parcela }, { apiKey: "fake", paquete: previo, paqueteNuevo: paquete, fetchImpl });
    expect(r.text).toContain("70,1 %");
    expect(solicitudes[1].contents.at(-1).parts[0].functionResponse.response.error).toContain("contexto efectivo");
  });
  it("el transporte conserva tema y evidencia sin enviarlos como texto generado", async () => {
    let cuerpo: any;
    const r = await responderGemini("¿Y en noviembre?", [], { ...consulta.contexto, mes: 11 }, (async (_url, init) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(factual), { status: 200 });
    }) as typeof fetch, "humedad_raiz");
    expect(cuerpo.tema).toBe("humedad_raiz");
    expect(cuerpo.contexto.mes).toBe(11);
    expect(r.evidencia).toEqual(factual.evidencia);
  });
});
