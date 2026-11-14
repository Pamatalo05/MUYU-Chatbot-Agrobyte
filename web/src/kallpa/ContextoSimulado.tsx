import type { MuyuContexto } from "../knowledge/contexto";
import { ESCENARIOS, ESCENARIO_NOMBRE, type Escenario, type PaqueteCanton } from "../knowledge/types";
import "./ContextoSimulado.css";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface ContextoSimuladoProps {
  paquete: PaqueteCanton;
  contexto: MuyuContexto;
  onChange: (contexto: MuyuContexto) => void;
}

/**
 * Selector temporal del contexto de Muyu, mientras esta app vive fuera de Kallpa.
 * En K5 se reemplaza por el mapa, el cultivo cosechado y los botones ENSO de Kallpa.
 */
export default function ContextoSimulado({ paquete, contexto, onChange }: ContextoSimuladoProps) {
  const cambiar = <K extends keyof MuyuContexto>(campo: K, valor: MuyuContexto[K]) =>
    onChange({ ...contexto, [campo]: valor });

  return (
    <fieldset className="contexto">
      <legend className="visually-hidden">Contexto de la consulta</legend>

      <label>
        Cantón
        <select value={contexto.cantonId} onChange={(e) => cambiar("cantonId", e.target.value)}>
          {Object.entries(paquete.cantones).map(([id, canton]) => (
            <option key={id} value={id}>
              {canton.nombre}
            </option>
          ))}
        </select>
      </label>

      <label>
        Cosechado
        <select value={contexto.cultivoPrevioId} onChange={(e) => cambiar("cultivoPrevioId", e.target.value)}>
          {paquete.cultivos.map((cultivo) => (
            <option key={cultivo.id} value={cultivo.id}>
              {cultivo.nombre.split(" (")[0]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Escenario
        <select value={contexto.escenario} onChange={(e) => cambiar("escenario", e.target.value as Escenario)}>
          {ESCENARIOS.map((escenario) => (
            <option key={escenario} value={escenario}>
              {ESCENARIO_NOMBRE[escenario]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Mes
        <select value={contexto.mes} onChange={(e) => cambiar("mes", Number(e.target.value))}>
          {MESES.map((nombre, indice) => (
            <option key={nombre} value={indice + 1}>
              {nombre}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
