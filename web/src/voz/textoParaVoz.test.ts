import { describe, expect, it } from "vitest";
import { elegirVoz, partirEnFrases, textoParaVoz } from "./textoParaVoz";

describe("textoParaVoz", () => {
  it("quita emojis y dice las unidades con palabras", () => {
    const texto = "⚠️ Cuidado\n🌧️ Lluvia: 152 mm (+22 %).\nMargen estimado: unos 750 USD/ha (fuente: INIAP / FAO GAEZ).";
    expect(textoParaVoz(texto)).toBe(
      "Cuidado. Lluvia: 152 milímetros (+22 por ciento). Margen estimado: unos 750 dólares por hectárea (fuente: INIAP o FAO GAEZ).",
    );
  });

  it("lee temperaturas, alturas y el NDVI", () => {
    expect(textoParaVoz("🌡️ de 21 a 38 °C, a 5 m de altura, verdor (NDVI) de 43")).toBe(
      "de 21 a 38 grados, a 5 metros de altura, verdor de 43.",
    );
    expect(textoParaVoz("En 5 ha la lluvia ha bajado")).toBe("En 5 hectáreas la lluvia ha bajado.");
  });
});

describe("partirEnFrases", () => {
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

  it("devuelve null si no hay voces en español", () => {
    expect(elegirVoz([voz("en-US")])).toBe(null);
  });
});
