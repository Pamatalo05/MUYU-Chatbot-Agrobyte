import type { MuyuState } from "../character/Muyu";
import type { ChatPhase } from "../chat/types";

/**
 * Traduce lo que pasa en el chat al estado de Muyu.
 * Prioridad: error > feliz > hablando > pensando > atento (escribiendo) > preocupado > esperando.
 * "Preocupado" solo aparece en reposo, cuando el semáforo de siembra está en rojo.
 */
export function deriveMuyuState(phase: ChatPhase, isUserTyping: boolean, riesgoAlto = false): MuyuState {
  switch (phase) {
    case "error":
      return "error";
    case "happy":
      return "happy";
    case "speaking":
      return "speaking";
    case "thinking":
      return "thinking";
    case "idle":
      if (isUserTyping) return "attentive";
      return riesgoAlto ? "worried" : "idle";
  }
}
