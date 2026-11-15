import { responderOffline } from "../chat/respuestaOffline";
import { describe, expect, it } from "vitest";
import datosJson from "../../public/datos/paquete_canton.json";
import { deriveMuyuState } from "../state/assistant";
import type { MuyuContexto } from "./contexto";
import { evaluarSemaforo } from "./semaforo";
import { validarPaquete } from "./validarPaquete";

const paquete = validarPaquete(structuredClone(datosJson));
const daule: MuyuContexto = { cantonId: "daule", cultivoPrevioId: "arroz", escenario: "neutro", mes: 1 };

describe("evaluarSemaforo (humedad del suelo predicha por el modelo)", () => {
  it("verde en Daule, enero, año normal (74 %)", () => {
    expect(evaluarSemaforo(paquete, daule).color).toBe("verde");
  });

  it("rojo por encharcamiento con El Niño en Daule desde marzo (85 %)", () => {
    const s = evaluarSemaforo(paquete, { ...daule, escenario: "el_nino", mes: 3 });
    expect(s.color).toBe("rojo");
    expect(s.motivo).toContain("encharcamiento");
  });

  it("rojo por suelo seco en la época seca de Daule (septiembre)", () => {
    const s = evaluarSemaforo(paquete, { ...daule, mes: 9 });
    expect(s.color).toBe("rojo");
    expect(s.motivo).toContain("seco");
  });

  it("usa los datos de cada cantón: Babahoyo en septiembre solo es amarillo", () => {
    expect(evaluarSemaforo(paquete, { ...daule, cantonId: "babahoyo", mes: 9 }).color).toBe("amarillo");
  });
});

describe("Muyu preocupado", () => {
  it("solo en reposo y con semáforo rojo", () => {
    expect(deriveMuyuState("idle", false, true)).toBe("worried");
    expect(deriveMuyuState("idle", true, true)).toBe("attentive");
    expect(deriveMuyuState("speaking", false, true)).toBe("speaking");
    expect(deriveMuyuState("idle", false, false)).toBe("idle");
  });
});

// Conserva la comprobación del aviso prioritario con el esquema vigente.
it("la rotación avisa primero del riesgo alto de humedad, sin saludo previo", () => {
  const r = responderOffline(paquete, { ...daule, escenario: "el_nino", mes: 3 }, "", "rotacion");
  expect(r.text.startsWith("⚠️ Cuidado, el riesgo para sembrar es alto:")).toBe(true);
  expect(r.text).toContain("encharcamiento");
  expect(r.emotion).toBe("neutral");
});
