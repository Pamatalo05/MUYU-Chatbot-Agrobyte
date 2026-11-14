import Muyu from "./character/Muyu";
import { useBackendHealth, type BackendStatus } from "./useBackendHealth";

const STATUS_TEXT: Record<BackendStatus, string> = {
  checking: "Comprobando el backend…",
  ok: "Backend conectado",
  "no-key": "Backend conectado, pero falta GEMINI_API_KEY en api/.env",
  offline: "No hay conexión con el backend (¿está corriendo uvicorn?)",
};

export default function App() {
  const status = useBackendHealth();

  return (
    <main className="layout">
      <section className="character-area" aria-label="Personaje Muyu">
        {/* Bloques 7 y 8: los ojos y animaciones cambiarán según el chat */}
        <Muyu eyes={status === "ok" ? "happy" : "open"} size={340} />
      </section>

      <section className="chat-area" aria-label="Conversación">
        <header className="chat-header">
          <h1>Muyu</h1>
          <p className={`status status--${status}`} role="status">
            {STATUS_TEXT[status]}
          </p>
        </header>
        {/* Bloque 3: aquí irá el panel del chat */}
        <p className="chat-placeholder">El chat aparecerá aquí.</p>
      </section>
    </main>
  );
}
