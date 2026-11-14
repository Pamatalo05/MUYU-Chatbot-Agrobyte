import { describe, expect, it } from "vitest";
import { elegirModo, PAUSA_TRAS_FALLO_MS, responderHibrido } from "./hibrido";
import type { ChatReply } from "./types";

const base = { enLinea: true, ultimoFalloMs: null, ahoraMs: 1_000_000 };
const campo = (): ChatReply => ({ text: "Siembra soya.", emotion: "happy" });

describe("elegirModo", () => {
  it("usa Gemini con red y sin fallos recientes", () => {
    expect(elegirModo(base)).toBe("en_vivo");
  });

  it("usa modo campo sin red o con botones de pregunta rápida", () => {
    expect(elegirModo({ ...base, enLinea: false })).toBe("campo");
    expect(elegirModo({ ...base, accion: "rotacion" })).toBe("campo");
  });

  it("espera una pausa tras un fallo antes de reintentar Gemini", () => {
    const ultimoFalloMs = base.ahoraMs - 1_000;
    expect(elegirModo({ ...base, ultimoFalloMs })).toBe("campo");
    expect(elegirModo({ ...base, ultimoFalloMs: base.ahoraMs - PAUSA_TRAS_FALLO_MS })).toBe("en_vivo");
  });
});

describe("responderHibrido", () => {
  it("devuelve la respuesta en vivo cuando funciona", async () => {
    const r = await responderHibrido("en_vivo", async () => ({ text: "Gemini", emotion: "neutral" }), campo);
    expect(r).toEqual({ reply: { text: "Gemini", emotion: "neutral" }, modo: "en_vivo", fallo: false });
  });

  it("cae al modo campo si Gemini falla, sin ensuciar la respuesta", async () => {
    const r = await responderHibrido("en_vivo", async () => { throw new Error("503"); }, campo);
    expect(r.modo).toBe("campo");
    expect(r.fallo).toBe(true);
    expect(r.reply.text).toBe("Siembra soya.");
  });

  it("en modo campo no llama a Gemini", async () => {
    let llamado = false;
    const r = await responderHibrido("campo", async () => { llamado = true; return campo(); }, campo);
    expect(llamado).toBe(false);
    expect(r.reply.text).toBe("Siembra soya.");
  });
});
