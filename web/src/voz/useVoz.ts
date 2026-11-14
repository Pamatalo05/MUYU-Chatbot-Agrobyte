import { useCallback, useEffect, useRef, useState } from "react";
import { elegirVoz, partirEnFrases, textoParaVoz } from "./textoParaVoz";

export interface Voz {
  /** El navegador puede hablar en español. */
  disponible: boolean;
  hablando: boolean;
  hablar: (texto: string) => void;
  callar: () => void;
}

const sintesis = (): SpeechSynthesis | null =>
  typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

/**
 * Muyu habla con la voz del propio equipo (Web Speech API): gratis y sin internet,
 * porque usa las voces instaladas. Si no hay voz en español, `disponible` es false.
 */
export function useVoz(): Voz {
  const [voz, setVoz] = useState<SpeechSynthesisVoice | null>(null);
  const [hablando, setHablando] = useState(false);
  // Cada lectura tiene un id: si se pide otra, los eventos de la anterior se ignoran.
  const lectura = useRef(0);

  useEffect(() => {
    const s = sintesis();
    if (!s) return;
    // Las voces llegan tarde en Chrome: se vuelven a leer cuando cambian.
    const cargar = () => setVoz(elegirVoz(s.getVoices()));
    cargar();
    s.addEventListener("voiceschanged", cargar);
    return () => {
      s.removeEventListener("voiceschanged", cargar);
      s.cancel();
    };
  }, []);

  const callar = useCallback(() => {
    lectura.current += 1;
    sintesis()?.cancel();
    setHablando(false);
  }, []);

  const hablar = useCallback(
    (texto: string) => {
      const s = sintesis();
      if (!s || !voz) return;
      s.cancel();
      const id = ++lectura.current;
      const frases = partirEnFrases(textoParaVoz(texto));
      if (frases.length === 0) return;

      frases.forEach((frase, i) => {
        const enunciado = new SpeechSynthesisUtterance(frase);
        enunciado.voice = voz;
        enunciado.lang = voz.lang;
        enunciado.rate = 0.95; // un poco más pausado: se entiende mejor en el campo
        if (i === 0) enunciado.onstart = () => id === lectura.current && setHablando(true);
        if (i === frases.length - 1) {
          enunciado.onend = () => id === lectura.current && setHablando(false);
        }
        enunciado.onerror = () => id === lectura.current && setHablando(false);
        s.speak(enunciado);
      });
    },
    [voz],
  );

  return { disponible: voz !== null, hablando, hablar, callar };
}
