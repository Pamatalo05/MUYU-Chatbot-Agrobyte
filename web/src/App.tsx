import { useCallback, useState } from "react";
import Muyu, { type MuyuState } from "./character/Muyu";
import MuyuDebugPanel from "./character/MuyuDebugPanel";
import ChatPanel from "./chat/ChatPanel";
import { responderOffline } from "./chat/respuestaOffline";
import type { Responder } from "./chat/types";
import { useChat } from "./chat/useChat";
import ContextoSimulado from "./kallpa/ContextoSimulado";
import { CONTEXTO_INICIAL, type MuyuContexto } from "./knowledge/contexto";
import { usePaquete } from "./knowledge/usePaquete";
import { deriveMuyuState } from "./state/assistant";

export default function App() {
  const paquete = usePaquete();
  const [contexto, setContexto] = useState<MuyuContexto>(CONTEXTO_INICIAL);

  // K2: Muyu responde en modo campo. En K4 se elegirá entre esto y Gemini.
  const responder = useCallback<Responder>(
    async (pregunta, _historial, accion) => {
      if (paquete.estado === "cargando") {
        return { text: "Estoy cargando los datos de tu cantón, pregúntame en un momento.", emotion: "neutral" };
      }
      if (paquete.estado === "error") throw new Error(paquete.mensaje);
      return responderOffline(paquete.paquete, contexto, pregunta, accion);
    },
    [paquete, contexto],
  );

  const { messages, phase, isBusy, send } = useChat(responder);
  const [isUserTyping, setIsUserTyping] = useState(false);
  // Solo en desarrollo: permite forzar un estado desde el panel de prueba.
  const [forcedState, setForcedState] = useState<MuyuState | null>(null);

  const muyuState = forcedState ?? deriveMuyuState(phase, isUserTyping);

  return (
    <main className="layout">
      <section className="character-area" aria-label="Personaje Muyu">
        <Muyu state={muyuState} size={340} />
        {import.meta.env.DEV && (
          <details className="debug-toggle">
            <summary>Probar estados</summary>
            <MuyuDebugPanel value={forcedState} onChange={setForcedState} />
          </details>
        )}
      </section>

      <section className="chat-area" aria-label="Conversación">
        <header className="chat-header">
          <h1>Muyu</h1>
          {paquete.estado === "error" ? (
            <p className="status status--offline" role="status">
              No se pudo cargar paquete_canton.json: {paquete.mensaje}
            </p>
          ) : (
            <p className="badge" role="status">
              Modo campo · Paquete NASA/NOAA
            </p>
          )}
        </header>

        {paquete.estado === "listo" && (
          <ContextoSimulado paquete={paquete.paquete} contexto={contexto} onChange={setContexto} />
        )}

        <ChatPanel
          messages={messages}
          isThinking={phase === "thinking"}
          isBusy={isBusy}
          onSend={send}
          onTypingChange={setIsUserTyping}
        />
      </section>
    </main>
  );
}
