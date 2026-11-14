import Muyu from "./character/Muyu";
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

  return (
    <main className="layout">
      <section className="character-area" aria-label="Personaje Muyu">
        {/* Bloques 7 y 8: los estados de Muyu se conectarán al chat */}
        <Muyu eyes={isThinking ? "open" : "happy"} size={340} />
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
