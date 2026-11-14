import { useState } from "react";
import Muyu, { type MuyuState } from "./character/Muyu";
import MuyuDebugPanel from "./character/MuyuDebugPanel";
import ChatPanel from "./chat/ChatPanel";
import { useChat } from "./chat/useChat";
import { useBackendHealth, type BackendStatus } from "./useBackendHealth";

const STATUS_TEXT: Record<BackendStatus, string> = {
  checking: "Comprobando el backend…",
  ok: "Backend conectado",
  "no-key": "Backend conectado, pero falta GEMINI_API_KEY en api/.env",
  offline: "No hay conexión con el backend (¿está corriendo uvicorn?)",
};

export default function App() {
  const status = useBackendHealth();
  const { messages, isThinking, send } = useChat();
  // Solo en desarrollo: permite forzar un estado desde el panel de prueba.
  const [forcedState, setForcedState] = useState<MuyuState | null>(null);

  // Bloque 8 conectará el resto de estados (attentive, speaking, happy, error).
  const chatState: MuyuState = isThinking ? "thinking" : "idle";
  const muyuState = forcedState ?? chatState;

  return (
    <main className="layout">
      <section className="character-area" aria-label="Personaje Muyu">
        <Muyu state={muyuState} size={340} />
        {import.meta.env.DEV && (
          <MuyuDebugPanel value={forcedState} onChange={setForcedState} />
        )}
      </section>

      <section className="chat-area" aria-label="Conversación">
        <header className="chat-header">
          <h1>Muyu</h1>
          <p className={`status status--${status}`} role="status">
            {STATUS_TEXT[status]}
          </p>
        </header>
        <ChatPanel messages={messages} isThinking={isThinking} onSend={send} />
      </section>
    </main>
  );
}
