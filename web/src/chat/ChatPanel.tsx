import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage } from "./types";
import "./ChatPanel.css";

interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (text: string) => void;
}

const MAX_LENGTH = 500;

export default function ChatPanel({ messages, isThinking, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);
  const canSend = draft.trim().length > 0 && !isThinking;

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

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
      <div className="chat__messages" aria-live="polite">
        {messages.map((message) => (
          <p key={message.id} className={`bubble bubble--${message.role}`}>
            <span className="visually-hidden">
              {message.role === "muyu" ? "Muyu dice:" : "Tú dices:"}
            </span>
            {message.text}
          </p>
        ))}

        {isThinking && (
          <p className="bubble bubble--muyu bubble--thinking" role="status">
            Muyu está pensando
            <span className="dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        )}
        <div ref={listEndRef} />
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
          placeholder="Escríbele a Muyu…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="chat__send" disabled={!canSend}>
          Enviar
        </button>
      </form>
    </div>
  );
}
