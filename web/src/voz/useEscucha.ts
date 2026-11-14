import { useCallback, useEffect, useRef, useState } from "react";

/** Lo mínimo de SpeechRecognition que usamos (TypeScript aún no lo trae en "DOM"). */
interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((evento: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type ConstructorReconocimiento = new () => Reconocimiento;

const constructor = (): ConstructorReconocimiento | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, ConstructorReconocimiento | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Mensajes para el agricultor según el error del navegador. */
const ERRORES: Record<string, string> = {
  "not-allowed": "Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.",
  "service-not-allowed": "Necesito permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.",
  "no-speech": "No te escuché. Toca el micrófono y habla cerca del teléfono.",
  "audio-capture": "No encuentro un micrófono en este equipo.",
  network: "Para escucharte necesito internet. Puedes escribir o usar los botones.",
};

export interface Escucha {
  /** El navegador sabe convertir voz en texto (Chrome, Edge, Chrome Android…). */
  disponible: boolean;
  escuchando: boolean;
  error: string | null;
  /** `alParcial` muestra lo que va entendiendo; `alFinal` recibe la frase completa. */
  iniciar: (alParcial: (texto: string) => void, alFinal: (texto: string) => void) => void;
  detener: () => void;
}

/**
 * Muyu escucha con el reconocimiento de voz del navegador. Ojo: en Chrome el audio
 * lo procesa un servicio en línea, así que necesita internet.
 */
export function useEscucha(idioma = "es-EC"): Escucha {
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actual = useRef<Reconocimiento | null>(null);

  useEffect(() => () => actual.current?.abort(), []);

  const detener = useCallback(() => actual.current?.stop(), []);

  const iniciar = useCallback(
    (alParcial: (texto: string) => void, alFinal: (texto: string) => void) => {
      const Clase = constructor();
      if (!Clase || actual.current) return;
      const r = new Clase();
      r.lang = idioma;
      r.interimResults = true;
      r.continuous = false;
      let texto = "";

      r.onresult = (evento) => {
        texto = Array.from(evento.results, (resultado) => resultado[0].transcript).join(" ").trim();
        alParcial(texto);
      };
      r.onerror = (evento) => {
        if (evento.error !== "aborted") setError(ERRORES[evento.error] ?? "No pude escucharte. Intenta de nuevo o escribe.");
      };
      r.onend = () => {
        actual.current = null;
        setEscuchando(false);
        if (texto) alFinal(texto);
      };

      setError(null);
      actual.current = r;
      setEscuchando(true);
      r.start();
    },
    [idioma],
  );

  return { disponible: constructor() !== null, escuchando, error, iniciar, detener };
}
