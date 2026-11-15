import { useCallback, useEffect, useRef, useState } from "react";
import { esNeuronal, ordenarVoces, partirEnFrases, prosodia, textoParaVoz } from "./textoParaVoz";

export interface Voz {
  /** El navegador puede hablar en español. */
  disponible: boolean;
  hablando: boolean;
  /** Nombre de la voz elegida (para mostrarlo o depurar). */
  nombreVoz: string | null;
  hablar: (texto: string) => void;
  callar: () => void;
}

const sintesis = (): SpeechSynthesis | null =>
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

/** Errores por los que conviene pasar a una voz instalada en el equipo. */
const FALLO_DE_VOZ_REMOTA = new Set(["network", "synthesis-failed", "synthesis-unavailable", "voice-unavailable"]);

/**
 * Voz de Muyu (Web Speech API, gratis). Elige la voz más dulce y natural disponible,
 * le da entonación por frase y, si una voz en línea falla, sigue con una local.
 */
export function useVoz(enLinea = true): Voz {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [hablando, setHablando] = useState(false);
  // Si una voz en línea falló en esta sesión, se usan solo voces locales.
  const [soloLocales, setSoloLocales] = useState(false);
  // Cada lectura tiene un id: si se pide otra, los eventos de la anterior se ignoran.
  const lectura = useRef(0);

  useEffect(() => {
    const s = sintesis();
    if (!s) return;
    // Las voces llegan tarde en Chrome y Android: se vuelven a leer cuando cambian.
    const cargar = () => setVoces(s.getVoices());
    cargar();
    s.addEventListener("voiceschanged", cargar);
    return () => {
      s.removeEventListener("voiceschanged", cargar);
      s.cancel();
    };
  }, []);

  const ordenadas = ordenarVoces(voces, enLinea && !soloLocales);
  const voz = ordenadas[0] ?? null;

  const callar = useCallback(() => {
    lectura.current += 1;
    sintesis()?.cancel();
    setHablando(false);
  }, []);

  // Si el usuario cambia de pestaña o bloquea el teléfono, Muyu deja de hablar.
  useEffect(() => {
    const alOcultar = () => document.hidden && callar();
    document.addEventListener("visibilitychange", alOcultar);
    return () => document.removeEventListener("visibilitychange", alOcultar);
  }, [callar]);

  const leer = useCallback(
    (frases: string[], desde: number, elegida: SpeechSynthesisVoice, id: number, alternativa: SpeechSynthesisVoice | null) => {
      const s = sintesis();
      if (!s) return;
      const neuronal = esNeuronal(elegida);
      frases.slice(desde).forEach((frase, k) => {
        const i = desde + k;
        const enunciado = new SpeechSynthesisUtterance(frase);
        const { pitch, rate } = prosodia(frase, neuronal);
        enunciado.voice = elegida;
        enunciado.lang = elegida.lang;
        enunciado.pitch = pitch;
        enunciado.rate = rate;
        enunciado.onstart = () => id === lectura.current && setHablando(true);
        if (i === frases.length - 1) enunciado.onend = () => id === lectura.current && setHablando(false);
        enunciado.onerror = (evento) => {
          if (id !== lectura.current || evento.error === "interrupted" || evento.error === "canceled") return;
          // Voz en línea sin conexión: se repite desde esta frase con una voz del equipo.
          if (!elegida.localService && alternativa && FALLO_DE_VOZ_REMOTA.has(evento.error)) {
            setSoloLocales(true);
            s.cancel();
            leer(frases, i, alternativa, id, null);
            return;
          }
          setHablando(false);
        };
        s.speak(enunciado);
      });
    },
    [],
  );

  const hablar = useCallback(
    (texto: string) => {
      const s = sintesis();
      if (!s || !voz) return;
      s.cancel();
      const id = ++lectura.current;
      const frases = partirEnFrases(textoParaVoz(texto));
      if (frases.length === 0) return;
      const local = ordenarVoces(voces, false)[0] ?? null;
      leer(frases, 0, voz, id, local && local !== voz ? local : null);
    },
    [voz, voces, leer],
  );

  return { disponible: voz !== null, hablando, nombreVoz: voz?.name ?? null, hablar, callar };
}
