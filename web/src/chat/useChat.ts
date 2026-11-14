import { useCallback, useState } from "react";
import { mockReply } from "./mockReply";
import type { ChatMessage, ChatRole } from "./types";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "muyu",
  text: "¡Hola! Soy Muyu, una semilla curiosa. ¿En qué te ayudo hoy?",
};

const createMessage = (role: ChatRole, text: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  text,
});

/** Estado de la conversación. En el Bloque 6, mockReply se cambia por la API. */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [isThinking, setIsThinking] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || isThinking) return;

      setMessages((current) => [...current, createMessage("user", clean)]);
      setIsThinking(true);
      try {
        const reply = await mockReply(clean);
        setMessages((current) => [...current, createMessage("muyu", reply)]);
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking],
  );

  return { messages, isThinking, send };
}
