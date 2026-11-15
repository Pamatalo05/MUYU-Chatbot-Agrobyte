
import { useEffect, useState } from "react";

const INTERVALO_MS = 15_000;
const TIMEOUT_MS = 4_000;

// Recurso pequeño que permite comprobar si hay acceso
// real a internet, no solamente conexión Wi-Fi.
const URL_PRUEBA = "https://www.gstatic.com/generate_204";

export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  useEffect(() => {
    let activo = true;
    let comprobando = false;

    async function comprobarConexion() {
      if (comprobando) return;

      if (!navigator.onLine) {
        if (activo) setEnLinea(false);
        return;
      }

      comprobando = true;

      const controlador = new AbortController();
      const timeout = setTimeout(
        () => controlador.abort(),
        TIMEOUT_MS
      );

      try {
        await fetch(URL_PRUEBA, {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
          signal: controlador.signal,
        });

        if (activo) setEnLinea(true);
      } catch {
        if (activo) setEnLinea(false);
      } finally {
        clearTimeout(timeout);
        comprobando = false;
      }
    }

    const desconectado = () => setEnLinea(false);
    const conectado = () => void comprobarConexion();

    window.addEventListener("offline", desconectado);
    window.addEventListener("online", conectado);

    const intervalo = setInterval(
      comprobarConexion,
      INTERVALO_MS
    );

    void comprobarConexion();

    return () => {
      activo = false;
      clearInterval(intervalo);
      window.removeEventListener("offline", desconectado);
      window.removeEventListener("online", conectado);
    };
  }, []);

  return enLinea;
}
