import { useEffect, useState } from "react";
import { RUTA_CHAT } from "./responderGemini";

const INTERVALO_MS = 15_000;
const TIMEOUT_MS = 4_000;

/** Comprueba acceso al backend de Muyu; la disponibilidad de Gemini se evalúa al conversar. */
export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  useEffect(() => {
    let activo = true;
    let pendiente: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    function cancelarComprobacion() {
      const anterior = pendiente;
      pendiente = null;
      clearTimeout(timeout);
      timeout = undefined;
      anterior?.abort();
    }

    const desconectado = () => {
      cancelarComprobacion();
      if (activo) setEnLinea(false);
    };

    async function comprobarConexion() {
      if (!activo) return;
      if (!navigator.onLine) {
        desconectado();
        return;
      }
      if (pendiente) return;

      const controlador = new AbortController();
      pendiente = controlador;
      // La identidad invalida resultados anteriores incluso si fetch ignora el aborto.
      const vigente = () => activo && pendiente === controlador;
      timeout = setTimeout(() => {
        if (!vigente()) return;
        cancelarComprobacion();
        setEnLinea(false);
      }, TIMEOUT_MS);

      try {
        // HEAD no ejecuta el agente: tanto Vite como Netlify responden 405.
        // Cualquier respuesta HTTP confirma conectividad con nuestro servidor;
        // los errores de Gemini se gestionan al enviar POST en responderHibrido.
        await fetch(RUTA_CHAT, {
          method: "HEAD",
          cache: "no-store",
          signal: controlador.signal,
        });
        if (vigente() && navigator.onLine) setEnLinea(true);
      } catch {
        if (vigente()) setEnLinea(false);
      } finally {
        // Una solicitud vieja no debe limpiar el temporizador de la nueva.
        if (vigente()) {
          clearTimeout(timeout);
          pendiente = null;
        }
      }
    }

    const conectado = () => {
      cancelarComprobacion();
      void comprobarConexion();
    };

    window.addEventListener("offline", desconectado);
    window.addEventListener("online", conectado);
    const intervalo = setInterval(comprobarConexion, INTERVALO_MS);
    void comprobarConexion();

    return () => {
      activo = false;
      cancelarComprobacion();
      clearInterval(intervalo);
      window.removeEventListener("offline", desconectado);
      window.removeEventListener("online", conectado);
    };
  }, []);

  return enLinea;
}
