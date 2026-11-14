import { useCallback, useEffect, useRef, useState } from "react";
import type { AccionRapida } from "./preguntasRapidas";
import type { ChatMessage, ChatPhase, ChatRole, Responder } from "./types";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "muyu",
  text: "¡Hola! Soy Muyu, una semilla curiosa. ¿En qué te ayudo hoy?",
};

const ERROR_TEXT = "Ups, mis raíces perdieron la conexión. ¿Lo intentamos de nuevo?";

/** Ritmo del efecto de escritura y duración de las emociones. */
const TYPE_INTERVAL_MS = 30;
const MAX_TYPE_MS = 3000;
const REDUCED_MOTION_SPEAK_MS = 800;
const HAPPY_MS = 2000;
/** Las respuestas offline son instantáneas; Muyu "piensa" un instante para que se note. */
const MIN_THINKING_MS = 400;
const ERROR_MS = 3000;
/** Mensajes que se envían como contexto (Bloque 6). */
const HISTORY_LIMIT = 10;

const createMessage = (role: ChatRole, text: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  text,
});

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Conversación con Muyu y su fase actual:
 * thinking (espera) → speaking (la respuesta aparece letra a letra)
 * → happy 2 s si la emoción es feliz → idle. Si algo falla: error 3 s → idle.
 */
export function useChat(responder: Responder) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const messagesRef = useRef(messages);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    timersRef.current.push(window.setTimeout(callback, delay));
  }, []);

  /** Muestra el texto de un mensaje poco a poco; resuelve al terminar. */
  const typeOut = useCallback(
    (messageId: string, fullText: string) =>
      new Promise<void>((resolve) => {
        const setText = (text: string) =>
          setMessages((current) =>
            current.map((message) => (message.id === messageId ? { ...message, text } : message)),
          );

        if (prefersReducedMotion()) {
          setText(fullText);
          schedule(resolve, REDUCED_MOTION_SPEAK_MS);
          return;
        }

        const ticks = MAX_TYPE_MS / TYPE_INTERVAL_MS;
        const step = Math.max(1, Math.ceil(fullText.length / ticks));
        let shown = 0;

        const tick = () => {
          shown = Math.min(fullText.length, shown + step);
          setText(fullText.slice(0, shown));
          if (shown < fullText.length) schedule(tick, TYPE_INTERVAL_MS);
          else resolve();
        };
        tick();
      }),
    [schedule],
  );

  const isBusy = phase === "thinking" || phase === "speaking";

  const send = useCallback(
    async (text: string, accion?: AccionRapida) => {
      const clean = text.trim();
      if (!clean || isBusy) return;

      clearTimers();
      const history = messagesRef.current.slice(-HISTORY_LIMIT);
      setMessages((current) => [...current, createMessage("user", clean)]);
      setPhase("thinking");

      try {
        const [reply] = await Promise.all([responder(clean, history, accion), wait(MIN_THINKING_MS)]);
        const answer = createMessage("muyu", "");
        setMessages((current) => [...current, answer]);
        setPhase("speaking");
        await typeOut(answer.id, reply.text);

        if (reply.emotion === "happy") {
          setPhase("happy");
          schedule(() => setPhase("idle"), HAPPY_MS);
        } else {
          setPhase("idle");
        }
      } catch {
        setMessages((current) => [...current, createMessage("muyu", ERROR_TEXT)]);
        setPhase("error");
        schedule(() => setPhase("idle"), ERROR_MS);
      }
    },
    [isBusy, responder, clearTimers, schedule, typeOut],
  );

  return { messages, phase, isBusy, send };
}
