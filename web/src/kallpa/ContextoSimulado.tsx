import type { MuyuContexto } from "../knowledge/contexto";
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

  // Solo cultivos de la zona del cantón (no se cosecha papa en Daule).
  const cultivosDeZona = (cantonId: string) =>
    paquete.cultivos.filter((c) => c.regiones.includes(paquete.cantones[cantonId].region));

  const cambiarCanton = (cantonId: string) => {
    const zona = cultivosDeZona(cantonId);
    const previo = zona.some((c) => c.id === contexto.cultivoPrevioId) ? contexto.cultivoPrevioId : zona[0]?.id;
    onChange({ ...contexto, cantonId, cultivoPrevioId: previo ?? contexto.cultivoPrevioId });
  };

  const canton = paquete.cantones[contexto.cantonId].nombre.split(",")[0];
  const cultivo = paquete.cultivos.find((c) => c.id === contexto.cultivoPrevioId)?.nombre.split(" (")[0] ?? "";
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
        <select value={contexto.cantonId} onChange={(e) => cambiarCanton(e.target.value)}>
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
          {cultivosDeZona(contexto.cantonId).map((cultivo) => (
            <option key={cultivo.id} value={cultivo.id}>
              {cultivo.nombre.split(" (")[0]}
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
