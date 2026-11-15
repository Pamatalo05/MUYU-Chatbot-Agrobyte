import { describe, expect, it } from "vitest";
import datosJson from "../../public/datos/paquete_canton.json";
import { responderOffline } from "../chat/respuestaOffline";
import { deriveMuyuState } from "../state/assistant";
import type { MuyuContexto } from "./contexto";
import { evaluarSemaforo } from "./semaforo";
import { validarPaquete } from "./validarPaquete";

const paquete = validarPaquete(structuredClone(datosJson));
const daule: MuyuContexto = { cantonId: "daule", cultivoPrevioId: "arroz", escenario: "neutro", mes: 1 };

describe("evaluarSemaforo", () => {
  it("verde con lluvias normales y opciones suficientes", () => {
    expect(evaluarSemaforo(paquete, daule).color).toBe("verde");
  });

  it("rojo con exceso de lluvia alto (El Niño en Daule, +39 %)", () => {
    const s = evaluarSemaforo(paquete, { ...daule, escenario: "el_nino" });
    expect(s.color).toBe("rojo");
    expect(s.motivo).toContain("exceso de lluvia");
    expect(s.motivo).toContain("+39 %");
  });

  it("amarillo con riesgo moderado de sequía (La Niña en Daule, −34 %)", () => {
    const s = evaluarSemaforo(paquete, { ...daule, escenario: "la_nina" });
    expect(s.color).toBe("amarillo");
    expect(s.motivo).toContain("sequía");
  });

  it("usa los datos de cada cantón: El Niño no es rojo en Latacunga", () => {
    const s = evaluarSemaforo(paquete, { ...daule, cantonId: "latacunga", cultivoPrevioId: "papa", escenario: "el_nino" });
    expect(s.color).toBe("verde");
  });
});

describe("Muyu preocupado", () => {
  it("solo en reposo y con semáforo rojo", () => {
    expect(deriveMuyuState("idle", false, true)).toBe("worried");
    expect(deriveMuyuState("idle", true, true)).toBe("attentive");
    expect(deriveMuyuState("speaking", false, true)).toBe("speaking");
    expect(deriveMuyuState("idle", false, false)).toBe("idle");
  });

  it("la respuesta de rotación avisa primero el riesgo alto", () => {
    const r = responderOffline(paquete, { ...daule, escenario: "el_nino" }, "", "rotacion");
    expect(r.text.startsWith("Cuidado, el riesgo para sembrar es alto: exceso de lluvia")).toBe(true);
    expect(r.emotion).toBe("neutral");
  });
});
