import { conSugerencias, leerPreferencias, resolverSeguimiento, type Preferencias } from "./chat/estilo";
import { MemoriaConversacional, resolverConsulta } from "./knowledge/contextoConversacion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  usePaquete,
  usePaqueteNuevo,
} from "./knowledge/usePaquete";
import { deriveMuyuState } from "./state/assistant";
import { useLecturaAutomatica } from "./voz/useLecturaAutomatica";
import { useVoz } from "./voz/useVoz";

export default function App() {
  const [preferencias, setPreferencias] = useState<Preferencias>(leerPreferencias);
  useEffect(() => { try { localStorage.setItem("muyu-estilo", JSON.stringify(preferencias)); } catch { /* Navegación privada: se conserva en sesión. */ } }, [preferencias]);
  const paquete = usePaquete();
  const paqueteNuevo = usePaqueteNuevo();
  const [contexto, setContexto] = useState<MuyuContexto>(CONTEXTO_INICIAL);

  const memoria = useRef(new MemoriaConversacional());
  const cambiarParcela = useCallback((nuevo: MuyuContexto) => {
    memoria.current.reiniciar();
    setContexto(nuevo);
  }, []);
  const enLinea = useEnLinea();
  const [modo, setModo] = useState<ModoConexion>("en_vivo");
  const ultimoFallo = useRef<number | null>(null);
  const [falloReciente, setFalloReciente] = useState(false);

  // K4: Gemini si hay internet; si no hay o falla, el modo campo responde con los mismos datos.
  const responder = useCallback<Responder>(
    async (pregunta, historial, accion, signal) => {
      pregunta = resolverSeguimiento(pregunta, historial);
      const version = memoria.current.version();
      const consulta = resolverConsulta(pregunta, contexto, memoria.current.leer(), paquete.estado === "listo" ? Object.keys(paquete.paquete.cantones) : undefined);
      if (accion) consulta.tema = accion;
      // El ahorro sigue pendiente aunque falte una aclaración o todavía no haya evidencia.
      if (consulta.tema === "urea") memoria.current.recordarIntencion(version, consulta);
      if (consulta.error) return { text: consulta.error, emotion: "neutral" };
      const efectivo = consulta.contexto;
      const campo = (): ChatReply => {
        if (paquete.estado === "cargando") {
          return { text: "Estoy cargando los datos de tu cantón, pregúntame en un momento.", emotion: "neutral" };
        }
        if (paquete.estado === "error") throw new Error(paquete.mensaje);
        return responderOffline(
          paquete.paquete,
          efectivo,
          pregunta,
          accion,
          paqueteNuevo ?? undefined,
          consulta.tema,
          preferencias,
        );
      };
      const elegido = elegirModo({ enLinea, accion, ultimoFalloMs: ultimoFallo.current, ahoraMs: Date.now() });
      const resultado = await responderHibrido(
        elegido,
        () => responderGemini(pregunta, historial, efectivo, undefined, consulta.tema, signal, preferencias),
        campo,
      );
      if (signal?.aborted) throw new DOMException("Cancelada", "AbortError");
      if (resultado.reply.evidencia) memoria.current.aceptar(version, {
        contexto: resultado.reply.evidencia.contexto,
        tema: resultado.reply.evidencia.tema,
      });
      if (resultado.fallo) ultimoFallo.current = Date.now();
      else if (resultado.modo === "en_vivo") ultimoFallo.current = null;
      if (resultado.fallo || resultado.modo === "en_vivo") setFalloReciente(resultado.fallo);
      // Los botones siempre van a campo: no cambian la etiqueta de conexión.
      if (!accion) setModo(resultado.modo);
      return conSugerencias(resultado.reply);
    },
[paquete, paqueteNuevo, contexto, enLinea, preferencias],
  );
  const modoVisible: ModoConexion = enLinea ? modo : "campo";
  const aviso = !enLinea
    ? "Estás sin internet. Te respondo con los datos guardados de tu cantón."
    : falloReciente
      ? "No pude conectarme con Muyu en línea. Te respondo con los datos guardados. Puedes volver a consultar en línea dentro de un minuto."
      : null;

  const { messages, phase, isBusy, send, retry, canRetry } = useChat(responder);
  const voz = useVoz();
  const [lecturaAutomatica, setLecturaAutomatica] = useLecturaAutomatica();
  const fasePrevia = useRef(phase);

  // Cuando Muyu termina de escribir una respuesta, la lee en voz alta (si está activado).
  useEffect(() => {
    const termino = fasePrevia.current === "speaking" && phase !== "speaking" && phase !== "error";
    fasePrevia.current = phase;
    const ultimo = messages[messages.length - 1];
    if (termino && lecturaAutomatica && ultimo?.role === "muyu") voz.hablar(ultimo.text);
  }, [phase, messages, lecturaAutomatica, voz]);

  // Al preguntar algo nuevo, Muyu deja de hablar.
const enviar = useCallback<typeof send>(
  async (texto, accion) => {
    voz.callar();
    await send(texto, accion);
  },
  [send, voz],
);
  const [isUserTyping, setIsUserTyping] = useState(false);
  // Solo en desarrollo: permite forzar un estado desde el panel de prueba.
  const [forcedState, setForcedState] = useState<MuyuState | null>(null);

  const semaforo = useMemo(
    () => (paquete.estado === "listo" ? evaluarSemaforo(paquete.paquete, contexto) : null),
    [paquete, contexto],
  );
  // Mientras suena su voz, Muyu mueve la boca aunque el texto ya terminó de escribirse.
  const hablaConVoz = voz.hablando && phase !== "thinking" && phase !== "error";
  const muyuState =
    forcedState ?? (hablaConVoz ? "speaking" : deriveMuyuState(phase, isUserTyping, semaforo?.color === "rojo"));

  return (
    <main className="layout">
      <section className="character-area" aria-label="Muyu y tu parcela">
        <Muyu state={muyuState} size={300} />
        <div className="finca">
          {paquete.estado === "listo" && (
            <ContextoSimulado paquete={paquete.paquete} contexto={contexto} onChange={cambiarParcela} />
          )}
          {semaforo && <SemaforoRiesgo {...semaforo} onConsultar={() => { if (!isBusy) void enviar("¿Qué significa el semáforo de mi parcela y qué puedo revisar?"); }} />}
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
          <div className="chat-header__acciones">
            {voz.disponible && (
              <button
                type="button"
                className="voz-toggle"
                aria-pressed={lecturaAutomatica}
                onClick={() => {
                  if (lecturaAutomatica) voz.callar();
                  setLecturaAutomatica(!lecturaAutomatica);
                }}
              >
                <span aria-hidden="true">{lecturaAutomatica ? "🔊" : "🔇"}</span>
                {lecturaAutomatica ? "Voz" : "Sin voz"}
              </button>
            )}
            <p className={`conexion conexion--${modoVisible}`} role="status">
              <span className="conexion__punto" aria-hidden="true" />
              {modoVisible === "en_vivo" ? "En línea" : "Datos guardados"}
            </p>
          </div>
        </header>
        {paquete.estado === "error" && (
          <p className="chat__error" role="alert">
            No pude cargar los datos de los cantones. Recarga la página; si sigue, avisa al equipo.
          </p>
        )}

        <ChatPanel
          messages={messages}
          preferencias={preferencias}
          onPreferencias={setPreferencias}
          onRetry={retry}
          canRetry={canRetry}
          isThinking={phase === "thinking"}
          isBusy={isBusy}
          onSend={enviar}
          onTypingChange={setIsUserTyping}
          aviso={aviso}
          puedeEscuchar={enLinea}
          onEscuchar={voz.disponible ? voz.hablar : undefined}
          onAntesDeEscuchar={voz.callar}
        />
      </section>
    </main>
  );
}
