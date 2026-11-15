import type { Preferencias } from "./estilo";
import { etiquetaContexto } from "../knowledge/consultaAgricola";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { MuyuState } from "../character/Muyu";
import MuyuAvatar from "../character/MuyuAvatar";
import { useEscucha } from "../voz/useEscucha";
import { PREGUNTAS_RAPIDAS, type AccionRapida } from "./preguntasRapidas";
import type { ChatMessage } from "./types";
import "./ChatPanel.css";

interface ChatPanelProps {
  messages: ChatMessage[];
  preferencias?: Preferencias;
  onPreferencias?: (p: Preferencias) => void;
  onRetry?: () => void;
  canRetry?: boolean;
  /** Muestra la burbuja "Muyu está pensando…". */
  isThinking: boolean;
  /** Muyu está pensando o escribiendo: no se puede enviar. */
  isBusy: boolean;
  onSend: (text: string, accion?: AccionRapida) => void;
  /** Avisa si el usuario tiene texto escrito (Muyu se pone atento). */
  onTypingChange?: (isTyping: boolean) => void;
  /** Aviso discreto sobre la conexión; no se mezcla con las respuestas. */
  aviso?: string | null;
  /** Hay internet: el reconocimiento de voz del navegador lo necesita. */
  puedeEscuchar?: boolean;
  /** Si existe, cada respuesta de Muyu tiene un botón para oírla. */
  onEscuchar?: (texto: string) => void;
  /** Se llama antes de abrir el micrófono (p. ej. para que Muyu deje de hablar). */
  onAntesDeEscuchar?: () => void;
  /** Estado de Muyu en vivo: lo replica el mini Muyu del mensaje actual. */
  estadoMuyu?: MuyuState;
}

const MAX_LENGTH = 500;
/** Desde aquí se muestra cuántos caracteres quedan. */
const AVISO_LARGO = 400;

export default function ChatPanel({
  messages,
  preferencias,
  onPreferencias,
  onRetry,
  canRetry,
  isThinking,
  isBusy,
  onSend,
  onTypingChange,
  aviso,
  puedeEscuchar = false,
  onEscuchar,
  onAntesDeEscuchar,
  estadoMuyu = "idle",
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const escucha = useEscucha();
  const microfono = escucha.disponible && puedeEscuchar;
  // Solo el mini Muyu del último mensaje se mueve (o el de "pensando", si aparece).
  const ultimoDeMuyu = messages.map((m) => m.role).lastIndexOf("muyu");
  const listEndRef = useRef<HTMLDivElement>(null);
  const hasText = draft.trim().length > 0;
  const canSend = hasText && !isBusy;

  // "auto" (sin animación) para que el efecto de escritura no dé tirones.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isThinking]);

  // Muyu se pone atento mientras escribes o mientras te escucha.
  useEffect(() => {
    onTypingChange?.(hasText || escucha.escuchando);
  }, [hasText, escucha.escuchando, onTypingChange]);

  const alternarMicrofono = () => {
    if (escucha.escuchando) return escucha.detener();
    onAntesDeEscuchar?.();
    escucha.iniciar(setDraft, (texto) => {
      // Lo dicho se envía solo, como en una conversación.
      if (isBusy) return;
      onSend(texto);
      setDraft("");
    });
  };

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  // Enter envía; Shift + Enter hace salto de línea.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat">
      {/* aria-busy evita que el lector de pantalla lea la respuesta a medias. */}
      <div className="chat__messages" aria-live="polite" aria-busy={isBusy}>
        {messages.map((message, indice) => (
          <div key={message.id} className={`chat__row chat__row--${message.role}`}>
            {message.role === "muyu" && (
              <MuyuAvatar estado={!isThinking && indice === ultimoDeMuyu ? estadoMuyu : undefined} />
            )}
            <div className="chat__burbuja">
              <p className={`bubble bubble--${message.role}`}>
                <span className="visually-hidden">
                  {message.role === "muyu" ? "Muyu dice:" : "Tú dices:"}
                </span>
                {message.text}
              </p>
              {message.evidencia && (
                <details className="chat__evidencia">
                  <summary>{etiquetaContexto(message.evidencia)}</summary>
                  <p>{message.evidencia.tipo} · {message.evidencia.periodo}</p>
                  <p>Fuentes y detalles:</p>
                  <ul>{message.evidencia.fuentesDocumentadas.map((fuente, i) => <li key={i}>{fuente}</li>)}</ul>
                </details>
              )}
              {message.sugerencias && message.sugerencias.length > 0 && (
                <div className="chat__sugerencias" role="group" aria-label="Preguntas sugeridas">
                  {message.sugerencias.map((sugerencia) => (
                    <button
                      key={sugerencia.texto}
                      type="button"
                      className="chat__sugerencia"
                      disabled={isBusy}
                      onClick={() => onSend(sugerencia.texto, sugerencia.accion)}
                    >
                      {sugerencia.texto}
                    </button>
                  ))}
                </div>
              )}
              {message.role === "muyu" && onEscuchar && (
                <button type="button" className="chat__oir" onClick={() => onEscuchar(message.text)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor" />
                  </svg>
                  Escuchar
                </button>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="chat__row chat__row--muyu">
            <MuyuAvatar estado={estadoMuyu} />
            <p className="bubble bubble--muyu bubble--thinking" role="status">
              Muyu está pensando
              <span className="dots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {escucha.error && (
        <p className="chat__aviso" role="alert">
          {escucha.error}
        </p>
      )}

      {aviso && (
        <p className="chat__aviso" role="status">
          {aviso}
        </p>
      )}

      {preferencias && onPreferencias && <details className="chat__preferencias">
        <summary>Cómo prefieres las respuestas</summary>
        <label>Explicación <select value={preferencias.nivel} onChange={e => onPreferencias({ ...preferencias, nivel: e.target.value as Preferencias["nivel"] })}>
          <option value="sencillo">Sencilla</option><option value="normal">Normal</option><option value="tecnico">Técnica</option>
        </select></label>
        <label>Extensión <select value={preferencias.longitud} onChange={e => onPreferencias({ ...preferencias, longitud: e.target.value as Preferencias["longitud"] })}>
          <option value="breve">Breve</option><option value="detallada">Detallada</option>
        </select></label>
      </details>}
      {canRetry && <button type="button" className="chat__sugerencia" disabled={isBusy} onClick={onRetry}>Intentar otra vez</button>}

      <div className="chat__quick" role="group" aria-label="Preguntas rápidas">
        {PREGUNTAS_RAPIDAS.map(({ accion, texto, etiqueta, icono }) => (
          <button
            key={accion}
            type="button"
            className="chat__quick-button"
            disabled={isBusy}
            title={texto}
            onClick={() => onSend(texto, accion)}
          >
            <span aria-hidden="true">{icono}</span> {etiqueta}
          </button>
        ))}
      </div>

      <form className="chat__form" onSubmit={handleSubmit}>
        <label htmlFor="chat-input" className="visually-hidden">
          Escribe tu mensaje para Muyu
        </label>
        <textarea
          id="chat-input"
          className="chat__input"
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder={escucha.escuchando ? "Te escucho…" : microfono ? "Escribe o toca el micrófono…" : "Escribe tu pregunta…"}
          aria-describedby={draft.length >= AVISO_LARGO ? "chat-restantes" : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {microfono && (
          <button
            type="button"
            className={`chat__mic${escucha.escuchando ? " chat__mic--activo" : ""}`}
            onClick={alternarMicrofono}
            disabled={isBusy && !escucha.escuchando}
            aria-pressed={escucha.escuchando}
            aria-label={escucha.escuchando ? "Dejar de escuchar" : "Hablarle a Muyu"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9h-2z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}
        <button type="submit" className="chat__send" disabled={!canSend} aria-label="Enviar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" fill="currentColor" />
          </svg>
        </button>
      </form>
      {escucha.escuchando && (
        <p className="chat__restantes" role="status">
          Escuchando… habla y espera un momento. Tu voz la procesa el servicio de voz del navegador.
        </p>
      )}
      {draft.length >= AVISO_LARGO && (
        <p id="chat-restantes" className="chat__restantes">
          Te quedan {MAX_LENGTH - draft.length} caracteres
        </p>
      )}
    </div>
  );
}
