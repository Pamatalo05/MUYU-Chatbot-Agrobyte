import { CULTIVOS_PREVIOS, type MuyuContexto } from "../knowledge/contexto";
import { ESCENARIOS, type Escenario, type PaqueteCanton } from "../knowledge/types";
import "./ContextoSimulado.css";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Cómo lo dice un agricultor: "año normal", no "escenario Neutro". */
const CLIMA: Record<Escenario, string> = {
  neutro: "Año normal",
  el_nino: "Año de El Niño",
  la_nina: "Año de La Niña",
};

interface ContextoSimuladoProps {
  paquete: PaqueteCanton;
  contexto: MuyuContexto;
  onChange: (contexto: MuyuContexto) => void;
}

/**
 * Selector temporal del contexto de Muyu, mientras esta app vive fuera de Kallpa.
 * Se reemplaza por el mapa, el cultivo cosechado y los botones ENSO de Kallpa.
 */
export default function ContextoSimulado({ paquete, contexto, onChange }: ContextoSimuladoProps) {
  const cambiar = <K extends keyof MuyuContexto>(campo: K, valor: MuyuContexto[K]) =>
    onChange({ ...contexto, [campo]: valor });

  // Los cantones salen del paquete de Kallpa: si el equipo agrega uno, aparece solo.
  const canton = paquete.cantones[contexto.cantonId].nombre.split(",")[0];
  const cultivo = CULTIVOS_PREVIOS.find((c) => c.id === contexto.cultivoPrevioId)?.nombre ?? "";
  const resumen = `${canton} · ${cultivo} · ${CLIMA[contexto.escenario]} · ${MESES[contexto.mes - 1]}`;

  // Plegado: se ve el resumen y se abre solo para cambiar algo.
  return (
    <details className="parcela">
      <summary className="parcela__resumen">
        <span className="parcela__titulo">Tu parcela</span>
        <span className="parcela__datos">{resumen}</span>
        <span className="parcela__cambiar" aria-hidden="true">Cambiar</span>
      </summary>
    <fieldset className="contexto">
      <legend className="visually-hidden">Datos de tu parcela</legend>

      <label>
        Cantón
        <select value={contexto.cantonId} onChange={(e) => cambiar("cantonId", e.target.value)}>
          {Object.entries(paquete.cantones).map(([id, canton]) => (
            <option key={id} value={id}>
              {canton.nombre.replace(", ", " · ")}
            </option>
          ))}
        </select>
      </label>

      <label>
        Cosechaste
        <select value={contexto.cultivoPrevioId} onChange={(e) => cambiar("cultivoPrevioId", e.target.value)}>
          {CULTIVOS_PREVIOS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label>
        Clima esperado
        <select value={contexto.escenario} onChange={(e) => cambiar("escenario", e.target.value as Escenario)}>
          {ESCENARIOS.map((escenario) => (
            <option key={escenario} value={escenario}>
              {CLIMA[escenario]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Mes de siembra
        <select value={contexto.mes} onChange={(e) => cambiar("mes", Number(e.target.value))}>
          {MESES.map((nombre, indice) => (
            <option key={nombre} value={indice + 1}>
              {nombre}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
    </details>
  );
}
