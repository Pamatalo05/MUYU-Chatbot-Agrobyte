import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import MuyuAvatar from "../character/MuyuAvatar";
import { PREGUNTAS_RAPIDAS, type AccionRapida } from "./preguntasRapidas";
import type { ChatMessage } from "./types";
import "./ChatPanel.css";

interface ChatPanelProps {
  messages: ChatMessage[];
  /** Muestra la burbuja "Muyu está pensando…". */
  isThinking: boolean;
  /** Muyu está pensando o escribiendo: no se puede enviar. */
  isBusy: boolean;
  onSend: (text: string, accion?: AccionRapida) => void;
  /** Avisa si el usuario tiene texto escrito (Muyu se pone atento). */
  onTypingChange?: (isTyping: boolean) => void;
  /** Aviso discreto sobre la conexión; no se mezcla con las respuestas. */
  aviso?: string | null;
}

const MAX_LENGTH = 500;
/** Desde aquí se muestra cuántos caracteres quedan. */
const AVISO_LARGO = 400;

export default function ChatPanel({
  messages,
  isThinking,
  isBusy,
  onSend,
  onTypingChange,
  aviso,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);
  const hasText = draft.trim().length > 0;
  const canSend = hasText && !isBusy;

  // "auto" (sin animación) para que el efecto de escritura no dé tirones.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isThinking]);

  useEffect(() => {
    onTypingChange?.(hasText);
  }, [hasText, onTypingChange]);

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
        {messages.map((message) => (
          <div key={message.id} className={`chat__row chat__row--${message.role}`}>
            {message.role === "muyu" && <MuyuAvatar />}
            <p className={`bubble bubble--${message.role}`}>
              <span className="visually-hidden">
                {message.role === "muyu" ? "Muyu dice:" : "Tú dices:"}
              </span>
              {message.text}
            </p>
          </div>
        ))}

        {isThinking && (
          <div className="chat__row chat__row--muyu">
            <MuyuAvatar />
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

      {aviso && (
        <p className="chat__aviso" role="status">
          {aviso}
        </p>
      )}

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
          placeholder="Escribe tu pregunta…"
          aria-describedby={draft.length >= AVISO_LARGO ? "chat-restantes" : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="chat__send" disabled={!canSend} aria-label="Enviar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" fill="currentColor" />
          </svg>
        </button>
      </form>
      {draft.length >= AVISO_LARGO && (
        <p id="chat-restantes" className="chat__restantes">
          Te quedan {MAX_LENGTH - draft.length} caracteres
        </p>
      )}
    </div>
  );
}
