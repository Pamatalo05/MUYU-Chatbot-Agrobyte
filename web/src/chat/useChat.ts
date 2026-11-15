import { conLimite } from "./limite";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccionRapida } from "./preguntasRapidas";
import type { ChatMessage, ChatPhase, ChatRole, Responder } from "./types";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "muyu",
  text:
    "¡Hola! Soy Muyu 🌱 Puedes preguntarme sobre tu cultivo o pedirme que te explique algo.\n" +
    "Toca una pregunta de abajo o escríbeme con tus palabras.",
};

const ERROR_TEXT = "Uy, tuve un problema al responder. ¿Intentamos otra vez?";

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
  const activa = useRef<AbortController | null>(null);
  const ultimoHistorial = useRef<ChatMessage[]>([]);
  const terminarEscritura = useRef<(() => void) | null>(null);
  const [reintento, setReintento] = useState<{ texto: string; accion?: AccionRapida } | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => () => {
    activa.current?.abort();
    clearTimers();
    terminarEscritura.current?.();
  }, [clearTimers]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    timersRef.current.push(window.setTimeout(callback, delay));
  }, []);

  /** Muestra el texto de un mensaje poco a poco; resuelve al terminar. */
  const typeOut = useCallback(
    (messageId: string, fullText: string) =>
      new Promise<void>((resolve) => {
        terminarEscritura.current = resolve;
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
    async (text: string, accion?: AccionRapida, reintentar = false) => {
      const clean = text.trim();
      if (!clean || activa.current) return;
      const controlador = new AbortController();
      activa.current = controlador;
      setReintento(null);

      clearTimers();
      const history = reintentar ? ultimoHistorial.current : messagesRef.current.slice(-HISTORY_LIMIT);
      ultimoHistorial.current = history;
      if (!reintentar) setMessages((current) => [...current, createMessage("user", clean)]);
      setPhase("thinking");

      try {
        const [reply] = await Promise.all([
          conLimite(signal => responder(clean, history, accion, signal), 30_000, controlador.signal),
          wait(MIN_THINKING_MS),
        ]);
        if (controlador.signal.aborted) return;
        if (!reply.text.trim()) throw new Error("Respuesta vacía");
        const answer = { ...createMessage("muyu", ""), evidencia: reply.evidencia };
        setMessages((current) => [...current, answer]);
        setPhase("speaking");
        await typeOut(answer.id, reply.text);
        if (controlador.signal.aborted) return;
        // Las sugerencias aparecen cuando termina de escribir, no antes.
        if (reply.sugerencias?.length) {
          const sugerencias = reply.sugerencias;
          setMessages((current) => current.map((m) => (m.id === answer.id ? { ...m, sugerencias } : m)));
        }

        if (reply.emotion === "happy") {
          setPhase("happy");
          schedule(() => setPhase("idle"), HAPPY_MS);
        } else {
          setPhase("idle");
        }
      } catch {
        if (controlador.signal.aborted) return;
        setReintento({ texto: clean, accion });
        setMessages((current) => [...current, createMessage("muyu", ERROR_TEXT)]);
        setPhase("error");
        schedule(() => setPhase("idle"), ERROR_MS);
      } finally {
        if (activa.current === controlador) activa.current = null;
        terminarEscritura.current = null;
      }
    },
    [responder, clearTimers, schedule, typeOut],
  );

  const retry = useCallback(() => {
    if (reintento) return send(reintento.texto, reintento.accion, true);
  }, [reintento, send]);
  return { messages, phase, isBusy, send, retry, canRetry: reintento !== null };
}
