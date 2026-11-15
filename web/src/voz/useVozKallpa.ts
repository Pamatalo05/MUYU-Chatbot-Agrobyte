import { useCallback, useMemo } from "react";
import { textoParaVoz } from "./textoParaVoz";
import type { Voz } from "./useVoz";

/**
 * Dentro de Kallpa (WebView de Android) el navegador no trae voz: se usa la voz
 * nativa del teléfono a través del puente. Fuera de Kallpa se usa la voz web.
 */
export function useVozKallpa(vozWeb: Voz): Voz {
  const puente = typeof window !== "undefined" ? window.KallpaAndroid : undefined;
  const nativa = Boolean(puente?.hablar);

  const hablar = useCallback((texto: string) => puente?.hablar?.(textoParaVoz(texto)), [puente]);
  const callar = useCallback(() => puente?.callar?.(), [puente]);

  return useMemo(
    () => (nativa ? { disponible: true, hablando: false, nombreVoz: "Voz del teléfono", hablar, callar } : vozWeb),
    [nativa, hablar, callar, vozWeb],
  );
}
