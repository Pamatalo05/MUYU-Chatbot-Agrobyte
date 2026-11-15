import { describe, expect, it } from "vitest";
import { elegirVoz, partirEnFrases, prosodia, textoParaVoz } from "./textoParaVoz";

describe("textoParaVoz", () => {
  it("quita emojis y dice las unidades con palabras", () => {
    const texto = "⚠️ Cuidado\n🌧️ Lluvia: 152 mm (+22 %).\nMargen estimado: unos 750 USD/ha (fuente: INIAP / FAO GAEZ).";
    expect(textoParaVoz(texto)).toBe(
      "Cuidado. Lluvia: 152 milímetros (más 22 por ciento). Margen estimado: unos 750 dólares por hectárea (fuente: INIAP o FAO GAEZ).",
    );
  });

  it("lee temperaturas, alturas y el NDVI", () => {
    expect(textoParaVoz("🌡️ de 21 a 38 °C, a 5 m de altura, verdor (NDVI) de 43")).toBe(
      "de 21 a 38 grados, a 5 metros de altura, verdor de 43.",
    );
    expect(textoParaVoz("En 5 ha la lluvia ha bajado")).toBe("En 5 hectáreas la lluvia ha bajado.");
  });
});

describe("números en voz", () => {
  it("lee miles sin punto y los signos con palabras", () => {
    expect(textoParaVoz("Ganancia: unos 1.250 USD; lluvia (−34 %) y temperatura +2 °C")).toBe(
      "Ganancia: unos 1250 dólares; lluvia (menos 34 por ciento) y temperatura más 2 grados.",
    );
  });
});

describe("partirEnFrases", () => {
  it("deja sola la exclamación para que conserve su entonación", () => {
    expect(partirEnFrases("¡Hey, muy buena pregunta! Te recomiendo soya. Gana bien.")).toEqual([
      "¡Hey, muy buena pregunta!",
      "Te recomiendo soya. Gana bien.",
    ]);
  });

  it("agrupa frases cortas sin pasar el máximo", () => {
    expect(partirEnFrases("Hola. Soy Muyu. ¿Qué siembro?", 20)).toEqual(["Hola. Soy Muyu.", "¿Qué siembro?"]);
  });
});

describe("elegirVoz", () => {
  const voz = (lang: string, localService = true) => ({ lang, localService });

  it("prefiere español de Ecuador o latino, y voces locales", () => {
    expect(elegirVoz([voz("en-US"), voz("es-ES"), voz("es-MX")])?.lang).toBe("es-MX");
    expect(elegirVoz([voz("es-US", false), voz("es-US", true)])?.localService).toBe(true);
    expect(elegirVoz([voz("es-ES"), voz("es-EC")])?.lang).toBe("es-EC");
  });

  it("prefiere una voz natural y femenina latina con internet, y solo locales sin internet", () => {
    const voces = [
      { lang: "es-MX", localService: true, name: "Microsoft Raul - Spanish (Mexico)" },
      { lang: "es-MX", localService: false, name: "Microsoft Dalia Online (Natural) - Spanish (Mexico)" },
      { lang: "es-ES", localService: false, name: "Microsoft Elvira Online (Natural) - Spanish (Spain)" },
      { lang: "es-MX", localService: true, name: "Microsoft Sabina - Spanish (Mexico)" },
    ];
    expect(elegirVoz(voces, true)?.name).toContain("Dalia");
    expect(elegirVoz(voces, false)?.name).toContain("Sabina");
  });

  it("devuelve null si no hay voces en español", () => {
    expect(elegirVoz([voz("en-US")])).toBe(null);
  });
});

describe("prosodia", () => {
  it("más alegre en exclamaciones y calmada en avisos de riesgo", () => {
    const normal = prosodia("Te recomiendo soya.", false);
    expect(prosodia("¡Hey, muy buena pregunta!", false).pitch).toBeGreaterThan(normal.pitch);
    expect(prosodia("Cuidado, el riesgo es alto.", false).pitch).toBeLessThan(normal.pitch);
    expect(prosodia("Te recomiendo soya.", true).pitch).toBeLessThan(normal.pitch);
  });
});
