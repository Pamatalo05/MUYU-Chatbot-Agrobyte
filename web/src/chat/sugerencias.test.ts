import { describe, expect, it } from "vitest";
import { esTemaVetado } from "../agent/guardarrailes";
import { sugerirPreguntas } from "./sugerencias";

describe("sugerirPreguntas", () => {
  it("siempre devuelve 3 preguntas distintas con acción para funcionar sin internet", () => {
    const s = sugerirPreguntas("¿qué opinas del movimiento político?");
    expect(s).toHaveLength(3);
    expect(new Set(s.map((x) => x.texto)).size).toBe(3);
    expect(s.every((x) => x.accion !== undefined)).toBe(true);
  });

  it("pone primero la más parecida a lo que escribió", () => {
    expect(sugerirPreguntas("¿cuánto gano si vendo maíz?")[0].texto).toBe("¿Qué cultivo me deja más plata?");
    expect(sugerirPreguntas("este invierno llueve demasiado")[0].texto).toBe("¿Cómo me afecta El Niño o La Niña?");
    expect(sugerirPreguntas("mi tierra está cansada, qué abono uso")[0].texto).toBe("¿Cuánto ahorro en urea?");
  });

  it("sin parecido, ofrece las más preguntadas", () => {
    expect(sugerirPreguntas("cuéntame un chiste").map((x) => x.accion)).toEqual(["rotacion", "enso", "rotacion"]);
  });
});

describe("esTemaVetado", () => {
  it("detecta política y religión, también en plural o con otra terminación", () => {
    for (const p of ["¿Qué opinas de los políticos?", "¿Por quién voto?", "¿Eres católico?", "Háblame de la Biblia", "¿Qué piensas de la religión?"]) {
      expect(esTemaVetado(p)).toBe(true);
    }
  });

  it("no bloquea preguntas del campo", () => {
    for (const p of ["¿Qué siembro después del arroz?", "¿Cuánto llueve en marzo?", "Dios quiera que llueva, ¿qué siembro?"]) {
      expect(esTemaVetado(p)).toBe(false);
    }
  });
});
