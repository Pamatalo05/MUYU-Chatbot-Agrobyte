import { describe, it, expect } from "vitest";
import { MemoriaConversacional, resolverConsulta } from "./contextoConversacion";
import type { MuyuContexto } from "./contexto";

const parcela: MuyuContexto = { cantonId: "babahoyo", mes: 5, escenario: "la_nina", cultivoPrevioId: "arroz" };
const catalogo = ["daule", "babahoyo", "latacunga"];
const pregunta = "¿Cuál es la humedad de raíz en Daule durante enero bajo El Niño?";
describe("contexto conversacional compartido", () => {
  it("prioriza cada campo explícito sin modificar la parcela", () => {
    const r = resolverConsulta(pregunta, parcela, null, catalogo);
    expect(r).toEqual({ contexto: { ...parcela, cantonId: "daule", mes: 1, escenario: "el_nino" }, tema: "humedad_raiz" });
    expect(parcela).toEqual({ cantonId: "babahoyo", mes: 5, escenario: "la_nina", cultivoPrevioId: "arroz" });
  });
  it("retiene tema y campos entre continuaciones", () => {
    const uno = resolverConsulta(pregunta, parcela, null, catalogo);
    const memoria = { contexto: uno.contexto, tema: uno.tema! };
    const dos = resolverConsulta("¿Y en noviembre?", parcela, memoria, catalogo);
    expect(dos.contexto).toEqual({ ...uno.contexto, mes: 11 });
    expect(dos.tema).toBe("humedad_raiz");
    const tres = resolverConsulta("¿Y en Babahoyo?", parcela, { contexto: dos.contexto, tema: dos.tema! }, catalogo);
    expect(tres.contexto).toEqual({ ...dos.contexto, cantonId: "babahoyo" });
    expect(tres.tema).toBe("humedad_raiz");
    expect(parcela.mes).toBe(5);
  });
  it("retiene el tema al cambiar solamente el escenario", () => {
    const memoria = { contexto: parcela, tema: "humedad_raiz" as const };
    expect(resolverConsulta("¿Y con El Niño?", parcela, memoria).tema).toBe("humedad_raiz");
    expect(resolverConsulta("¿Y en neutro?", parcela, { contexto: parcela, tema: "enso" }).tema).toBe("humedad_raiz");
    expect(resolverConsulta("Compara El Niño y neutro", parcela).error).toContain("por separado");
  });
  it("usa la memoria para una pregunta sin contexto y permite volver a mi parcela", () => {
    const memoria = { contexto: { ...parcela, mes: 11, cantonId: "daule" }, tema: "lluvia" as const };
    expect(resolverConsulta("¿Qué temperatura?", parcela, memoria).contexto).toEqual(memoria.contexto);
    expect(resolverConsulta("¿Y en mi parcela?", parcela, memoria).contexto).toEqual(parcela);
  });
  it("bloquea lugares desconocidos, comparaciones ambiguas y fechas no disponibles", () => {
    for (const texto of ["Humedad en Quito", "Humedad en enero y noviembre", "Humedad en Daule y Babahoyo", "Humedad hoy", "Humedad en enero de 2027"]) {
      expect(resolverConsulta(texto, parcela, null, catalogo).error).toBeTruthy();
    }
  });
  it("respeta el cultivo previo explícito", () => {
    expect(resolverConsulta("¿Qué siembro después del maíz?", parcela).contexto.cultivoPrevioId).toBe("maiz");
    expect(resolverConsulta("¿Qué siembro después de cosechar maíz?", parcela).contexto.cultivoPrevioId).toBe("maiz");
    expect(resolverConsulta("¿Qué siembro después del café?", parcela).error).toContain("cultivo previo");
  });
  it("un selector invalida respuestas pendientes sin cambiar respuestas previas", async () => {
    const memoria = new MemoriaConversacional();
    const contextoAnterior = { ...parcela, mes: 1 };
    const respuesta = { contexto: contextoAnterior, tema: "humedad_raiz" as const };
    memoria.aceptar(memoria.version(), respuesta);
    const versionPendiente = memoria.version();
    memoria.reiniciar();
    const aceptada = await Promise.resolve().then(() => memoria.aceptar(versionPendiente, respuesta));
    expect(aceptada).toBe(false);
    expect(memoria.leer()).toBeNull();
    expect(respuesta.contexto.mes).toBe(1);
    expect(resolverConsulta("Humedad", { ...parcela, mes: 9 }, memoria.leer()).contexto.mes).toBe(9);
  });
});
