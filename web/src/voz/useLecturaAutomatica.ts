import { useState } from "react";

const CLAVE = "muyu.lecturaAutomatica";

/** Preferencia "Muyu lee sus respuestas en voz alta". Se recuerda en este navegador. */
export function useLecturaAutomatica(): [boolean, (activa: boolean) => void] {
  const [activa, setActiva] = useState(() => {
    try {
      return localStorage.getItem(CLAVE) !== "no";
    } catch {
      return true; // sin almacenamiento (modo privado): activada por defecto
    }
  });

  const cambiar = (valor: boolean) => {
    setActiva(valor);
    try {
      localStorage.setItem(CLAVE, valor ? "si" : "no");
    } catch {
      // Si no se puede guardar, solo dura esta sesión.
    }
  };

  return [activa, cambiar];
}
