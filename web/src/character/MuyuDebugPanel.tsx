import { MUYU_STATES, type MuyuState } from "./Muyu";
import "./MuyuDebugPanel.css";

const LABELS: Record<MuyuState, string> = {
  idle: "Esperando",
  attentive: "Atento",
  thinking: "Pensando",
  speaking: "Hablando",
  happy: "Feliz",
  error: "Error",
};

interface MuyuDebugPanelProps {
  /** Estado forzado; null = Muyu sigue al chat. */
  value: MuyuState | null;
  onChange: (state: MuyuState | null) => void;
}

/** Panel para probar los estados. Solo se muestra en desarrollo (npm run dev). */
export default function MuyuDebugPanel({ value, onChange }: MuyuDebugPanelProps) {
  return (
    <div className="muyu-debug" role="group" aria-label="Probar estados de Muyu">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
        Auto
      </button>
      {MUYU_STATES.map((state) => (
        <button
          key={state}
          type="button"
          aria-pressed={value === state}
          onClick={() => onChange(state)}
        >
          {LABELS[state]}
        </button>
      ))}
    </div>
  );
}
