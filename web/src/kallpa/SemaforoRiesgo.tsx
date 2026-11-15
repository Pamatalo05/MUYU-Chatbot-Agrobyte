import type { ColorSemaforo, Semaforo } from "../knowledge/semaforo";
import "./SemaforoRiesgo.css";

/** Titular en lenguaje del agricultor; el detalle técnico va debajo, sin cortarse. */
const TITULAR: Record<ColorSemaforo, string> = {
  verde: "Indicador orientativo: verde",
  amarillo: "Indicador orientativo: amarillo",
  rojo: "Indicador orientativo: rojo",
};

const primeraMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Semáforo de siembra. El texto no depende solo del color (accesible para daltonismo). */
export default function SemaforoRiesgo({ color, motivo }: Semaforo) {
  return (
    <div className={`semaforo semaforo--${color}`} role="status">
      <span className="semaforo__luz" aria-hidden="true" />
      <p className="semaforo__texto">
        <strong>{TITULAR[color]}</strong>
        <span>{primeraMayuscula(motivo)}</span>
        <small>Reglas de Kallpa del paquete original; no garantiza resultados de siembra.</small>
      </p>
    </div>
  );
}
