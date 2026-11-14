import type { ColorSemaforo, Semaforo } from "../knowledge/semaforo";
import "./SemaforoRiesgo.css";

const ETIQUETA: Record<ColorSemaforo, string> = {
  verde: "Riesgo bajo",
  amarillo: "Riesgo medio",
  rojo: "Riesgo alto",
};

/** Semáforo de siembra para el contexto actual. El texto no depende solo del color (accesible). */
export default function SemaforoRiesgo({ color, motivo }: Semaforo) {
  return (
    <p className={`semaforo semaforo--${color}`} role="status">
      <span className="semaforo__luz" aria-hidden="true" />
      <strong>{ETIQUETA[color]}</strong>
      <span className="semaforo__motivo">· {motivo}</span>
    </p>
  );
}
