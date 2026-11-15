import type { Semaforo } from "../knowledge/semaforo";
import { explicarSemaforo } from "./explicarSemaforo";
import "./SemaforoRiesgo.css";
export default function SemaforoRiesgo({ color, motivo, onConsultar }: Semaforo & { onConsultar?: () => void }) {
  const detalle = explicarSemaforo({ color, motivo });
  return <div className={`semaforo semaforo--${color}`} role="status">
    <span className="semaforo__luz" aria-hidden="true" />
    <div className="semaforo__texto">
      <strong>{detalle.estado}</strong>
      <span>{detalle.explicacion}</span>
      <details><summary>Qué puedo revisar</summary>
        <ul>{detalle.acciones.map(a => <li key={a}>{a}</li>)}</ul>
        <small>{detalle.limite}</small>
      </details>
      {onConsultar && <button type="button" onClick={onConsultar}>Preguntar a Muyu</button>}
    </div>
  </div>;
}
