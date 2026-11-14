import type { MuyuState } from "../character/Muyu";
import type { ChatPhase } from "../chat/types";

/**
 * Traduce lo que pasa en el chat al estado de Muyu.
 * Prioridad: error > feliz > hablando > pensando > atento (escribiendo) > esperando.
 */
export function deriveMuyuState(phase: ChatPhase, isUserTyping: boolean): MuyuState {
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
      return isUserTyping ? "attentive" : "idle";
  }
}
