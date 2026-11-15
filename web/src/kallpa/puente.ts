import type { MuyuContexto } from "../knowledge/contexto";

/**
 * Puente entre la app Android de Kallpa y Muyu.
 *
 * Kallpa abre a Muyu en un WebView y le expone `window.KallpaAndroid`:
 *  - contexto(): JSON con la parcela activa (cantón, cultivo, hectáreas, riego…)
 *  - hablar(texto) / callar(): voz nativa del teléfono (el WebView no trae voz)
 *  - cerrar(): vuelve a Kallpa
 *
 * Para probar en el navegador sin Android: ?embebido=kallpa&canton=babahoyo&cultivo=Maíz
 */
export interface PuenteKallpa {
  contexto(): string;
  hablar?(texto: string): void;
  callar?(): void;
  cerrar?(): void;
}

declare global {
  interface Window {
    KallpaAndroid?: PuenteKallpa;
  }
}

/** Lo que Kallpa cuenta de la parcela activa. */
export interface ParcelaKallpa {
  cantonId: string;
  cultivoPrevioId: string;
  nombreParcela?: string;
  hectareas?: number;
  conRiego?: boolean;
  mes?: number;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "Maíz duro", "maiz", "MAÍZ" -> "maiz_duro"; lo demás se trata como arroz (el caso más común). */
export function cultivoDesdeKallpa(cultivo: unknown): string {
  return typeof cultivo === "string" && sinTildes(cultivo).startsWith("maiz") ? "maiz_duro" : "arroz";
}

/**
 * Convierte lo que manda Kallpa (objeto o JSON) en una parcela válida.
 * Devuelve null si falta el cantón: así Muyu sigue con su contexto por defecto.
 */
export function interpretarParcela(crudo: unknown): ParcelaKallpa | null {
  let dato: unknown = crudo;
  if (typeof crudo === "string") {
    try {
      dato = JSON.parse(crudo);
    } catch {
      return null;
    }
  }
  if (!dato || typeof dato !== "object") return null;
  const d = dato as Record<string, unknown>;
  const canton = typeof d.cantonId === "string" ? d.cantonId : typeof d.canton === "string" ? d.canton : "";
  if (!canton.trim()) return null;
  const hectareas = Number(d.hectareas);
  const mes = Number(d.mes);
  return {
    cantonId: sinTildes(canton),
    cultivoPrevioId: cultivoDesdeKallpa(d.cultivo ?? d.cultivoActual),
    nombreParcela: typeof d.nombreParcela === "string" ? d.nombreParcela : undefined,
    hectareas: Number.isFinite(hectareas) && hectareas > 0 ? hectareas : undefined,
    conRiego: typeof d.conRiego === "boolean" ? d.conRiego : d.conRiego === "1" || d.conRiego === "true",
    mes: Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : undefined,
  };
}

/** Lee la parcela desde el puente Android o, para pruebas, desde la URL. */
export function leerParcelaKallpa(w: Window = window): ParcelaKallpa | null {
  try {
    if (w.KallpaAndroid) return interpretarParcela(w.KallpaAndroid.contexto());
  } catch {
    return null;
  }
  const q = new URLSearchParams(w.location.search);
  if (q.get("embebido") !== "kallpa") return null;
  return interpretarParcela({
    canton: q.get("canton") ?? "daule",
    cultivo: q.get("cultivo") ?? "arroz",
    nombreParcela: q.get("parcela") ?? undefined,
    hectareas: q.get("ha") ?? undefined,
    conRiego: q.get("riego") ?? undefined,
  });
}

/** Muyu está dentro de Kallpa (o se está probando como si lo estuviera). */
export const estaEnKallpa = (w: Window = window) =>
  Boolean(w.KallpaAndroid) || new URLSearchParams(w.location.search).get("embebido") === "kallpa";

/** Aplica la parcela de Kallpa al contexto de Muyu, solo con cantones que existen en el paquete. */
export function contextoDesdeKallpa(
  base: MuyuContexto,
  parcela: ParcelaKallpa | null,
  cantonesValidos: readonly string[],
): MuyuContexto {
  if (!parcela) return base;
  return {
    ...base,
    cantonId: cantonesValidos.includes(parcela.cantonId) ? parcela.cantonId : base.cantonId,
    cultivoPrevioId: parcela.cultivoPrevioId,
    mes: parcela.mes ?? base.mes,
  };
}

/** Vuelve a la pantalla de Kallpa desde la que se abrió Muyu. */
export function volverAKallpa(w: Window = window): void {
  if (w.KallpaAndroid?.cerrar) w.KallpaAndroid.cerrar();
  else w.history.back();
}
