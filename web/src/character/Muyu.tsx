import type { CSSProperties } from "react";
import "./Muyu.css";

export type MuyuState = "idle" | "attentive" | "thinking" | "speaking" | "happy" | "worried" | "error";

/** Expresión de los ojos. Coincide con las capas en public/muyu. */
export type MuyuEyes = "open" | "happy" | "joy";

export const MUYU_STATES: readonly MuyuState[] = [
  "idle",
  "attentive",
  "thinking",
  "speaking",
  "happy",
  "worried",
  "error",
];

interface MuyuProps {
  /** Estado actual; agrega la clase muyu--<estado>. */
  state?: MuyuState;
  /** Fuerza una expresión de ojos; si no se indica, se deduce del estado. */
  eyes?: MuyuEyes;
  /** Tamaño máximo en píxeles; se achica solo si no hay espacio. */
  size?: number;
  className?: string;
}

const EYES_BY_STATE: Record<MuyuState, MuyuEyes> = {
  idle: "open",
  attentive: "open",
  thinking: "open",
  speaking: "happy",
  happy: "joy",
  worried: "open",
  error: "open",
};

const EYE_LAYER: Record<MuyuEyes, string> = {
  open: "eyes-open",
  happy: "eyes-happy",
  joy: "eyes-closed-happy",
};

/** Lienzo original de las capas: 1254 × 1254 px. Coordenadas SVG en ese lienzo. */
const CANVAS = 1254;
const VIEW_BOX = `0 0 ${CANVAS} ${CANVAS}`;
const MOUTH = { cx: 640, cy: 632, rx: 22, ry: 7 };
const EYE_GREEN = "#b0cf2e";
const SPARKLE_YELLOW = "#f5c518";
const DROP_BLUE = "#6ec6ff";

const layer = (name: string) => `/muyu/${name}.png`;

/**
 * Muyu armado por capas PNG alineadas (mismo lienzo) más boca y destellos en SVG.
 * Grupos: cuerpo · cabeza (brote, visor, ojos, gota, boca) · brazo derecho (con destellos).
 */
export default function Muyu({ state = "idle", eyes, size = 320, className = "" }: MuyuProps) {
  const eyeExpression = eyes ?? EYES_BY_STATE[state];

  return (
    <div
      className={`muyu muyu--${state} ${className}`.trim()}
      style={{ "--muyu-size": `${size}px` } as CSSProperties}
      role="img"
      aria-label="Muyu, un robot-semilla con un brote en la cabeza y una chakana en el pecho"
    >
      <div className="muyu__float">
        <img className="muyu__part muyu__arm-left" data-part="arm-left" src={layer("arm-left")} alt="" />
        <img className="muyu__part" data-part="body" src={layer("body")} alt="" />
        <img className="muyu__part muyu__chakana" data-part="chakana" src={layer("chakana")} alt="" />

        <div className="muyu__part muyu__head" data-part="head-group">
          <img className="muyu__part muyu__sprout" data-part="sprout" src={layer("sprout")} alt="" />
          <img className="muyu__part" data-part="head" src={layer("head")} alt="" />
          <img className="muyu__part" data-part="visor" src={layer("visor")} alt="" />
          <img
            className={`muyu__part muyu__eyes muyu__eyes--${eyeExpression}`}
            data-part="eyes"
            src={layer(EYE_LAYER[eyeExpression])}
            alt=""
          />
          <svg className="muyu__part muyu__drop" data-part="drop" viewBox={VIEW_BOX} aria-hidden="true">
            <path d="M835 300 C 815 335, 805 355, 805 372 a 30 30 0 0 0 60 0 c 0 -17 -10 -37 -30 -72 Z" fill={DROP_BLUE} />
          </svg>
          <svg className="muyu__part muyu__mouth" data-part="mouth" viewBox={VIEW_BOX} aria-hidden="true">
            <ellipse cx={MOUTH.cx} cy={MOUTH.cy} rx={MOUTH.rx} ry={MOUTH.ry} fill={EYE_GREEN} />
          </svg>
        </div>

        <div className="muyu__part muyu__arm-right" data-part="arm-right-group">
          <img className="muyu__part" data-part="arm-right" src={layer("arm-right")} alt="" />
          <svg className="muyu__part muyu__sparkles" data-part="sparkles" viewBox={VIEW_BOX} aria-hidden="true">
            <g stroke={SPARKLE_YELLOW} strokeWidth="16" strokeLinecap="round">
              <line x1="985" y1="545" x2="995" y2="500" />
              <line x1="1015" y1="575" x2="1050" y2="545" />
              <line x1="1025" y1="618" x2="1068" y2="612" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
