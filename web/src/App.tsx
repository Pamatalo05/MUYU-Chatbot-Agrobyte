import { useCallback, useMemo, useRef, useState } from "react";
import Muyu, { type MuyuState } from "./character/Muyu";
import MuyuDebugPanel from "./character/MuyuDebugPanel";
import ChatPanel from "./chat/ChatPanel";
import { elegirModo, responderHibrido, type ModoConexion } from "./chat/hibrido";
import { responderGemini } from "./chat/responderGemini";
import { responderOffline } from "./chat/respuestaOffline";
import type { ChatReply, Responder } from "./chat/types";
import { useChat } from "./chat/useChat";
import { useEnLinea } from "./chat/useEnLinea";
import ContextoSimulado from "./kallpa/ContextoSimulado";
import SemaforoRiesgo from "./kallpa/SemaforoRiesgo";
import { CONTEXTO_INICIAL, type MuyuContexto } from "./knowledge/contexto";
import { evaluarSemaforo } from "./knowledge/semaforo";
import { usePaquete } from "./knowledge/usePaquete";
import { deriveMuyuState } from "./state/assistant";

export default function App() {
  const paquete = usePaquete();
  const [contexto, setContexto] = useState<MuyuContexto>(CONTEXTO_INICIAL);

  const enLinea = useEnLinea();
  const [modo, setModo] = useState<ModoConexion>("en_vivo");
  const ultimoFallo = useRef<number | null>(null);
  const [falloReciente, setFalloReciente] = useState(false);

  // K4: Gemini si hay internet; si no hay o falla, el modo campo responde con los mismos datos.
  const responder = useCallback<Responder>(
    async (pregunta, historial, accion) => {
      const campo = (): ChatReply => {
        if (paquete.estado === "cargando") {
          return { text: "Estoy cargando los datos de tu cantón, pregúntame en un momento.", emotion: "neutral" };
        }
        if (paquete.estado === "error") throw new Error(paquete.mensaje);
        return responderOffline(paquete.paquete, contexto, pregunta, accion);
      };
      const elegido = elegirModo({ enLinea, accion, ultimoFalloMs: ultimoFallo.current, ahoraMs: Date.now() });
      const resultado = await responderHibrido(
        elegido,
        () => responderGemini(pregunta, historial, contexto),
        campo,
      );
      if (resultado.fallo) ultimoFallo.current = Date.now();
      else if (resultado.modo === "en_vivo") ultimoFallo.current = null;
      if (resultado.fallo || resultado.modo === "en_vivo") setFalloReciente(resultado.fallo);
      // Los botones siempre van a campo: no cambian la etiqueta de conexión.
      if (!accion) setModo(resultado.modo);
      return resultado.reply;
    },
    [paquete, contexto, enLinea],
  );
  const modoVisible: ModoConexion = enLinea ? modo : "campo";
  const aviso = !enLinea
    ? "Estás sin internet. Te respondo con los datos guardados de tu cantón."
    : falloReciente
      ? "No pude conectarme con Muyu en línea. Te respondo con los datos guardados y lo intento de nuevo en un minuto."
      : null;

  const { messages, phase, isBusy, send } = useChat(responder);
  const [isUserTyping, setIsUserTyping] = useState(false);
  // Solo en desarrollo: permite forzar un estado desde el panel de prueba.
  const [forcedState, setForcedState] = useState<MuyuState | null>(null);

  const semaforo = useMemo(
    () => (paquete.estado === "listo" ? evaluarSemaforo(paquete.paquete, contexto) : null),
    [paquete, contexto],
  );
  const muyuState = forcedState ?? deriveMuyuState(phase, isUserTyping, semaforo?.color === "rojo");

  return (
    <main className="layout">
      <section className="character-area" aria-label="Muyu y tu parcela">
        <Muyu state={muyuState} size={300} />
        <div className="finca">
          {paquete.estado === "listo" && (
            <ContextoSimulado paquete={paquete.paquete} contexto={contexto} onChange={setContexto} />
          )}
          {semaforo && <SemaforoRiesgo {...semaforo} />}
        </div>
        {import.meta.env.DEV && (
          <details className="debug-toggle">
            <summary>Probar estados</summary>
            <MuyuDebugPanel value={forcedState} onChange={setForcedState} />
          </details>
        )}
      </section>

      <section className="chat-area" aria-label="Conversación">
        <header className="chat-header">
          <div>
            <h1>Muyu</h1>
            <p className="chat-header__sub">Tu asistente de siembra</p>
          </div>
          <p className={`conexion conexion--${modoVisible}`} role="status">
            <span className="conexion__punto" aria-hidden="true" />
            {modoVisible === "en_vivo" ? "En línea" : "Datos guardados"}
          </p>
        </header>
        {paquete.estado === "error" && (
          <p className="chat__error" role="alert">
            No pude cargar los datos de los cantones. Recarga la página; si sigue, avisa al equipo.
          </p>
        )}

        <ChatPanel
          messages={messages}
          isThinking={phase === "thinking"}
          isBusy={isBusy}
          onSend={send}
          onTypingChange={setIsUserTyping}
          aviso={aviso}
        />
      </section>
    </main>
  );
}
