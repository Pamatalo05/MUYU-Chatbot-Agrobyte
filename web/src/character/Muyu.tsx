import type { CSSProperties } from "react";
import "./Muyu.css";

/** Estados de Muyu. Las animaciones de cada uno se completan en el Bloque 7. */
export type MuyuState = "idle" | "attentive" | "thinking" | "speaking" | "happy" | "error";

/** Expresión de los ojos. Coincide con las capas en public/muyu. */
export type MuyuEyes = "open" | "happy" | "joy";

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
  error: "open",
};

const EYE_LAYER: Record<MuyuEyes, string> = {
  open: "eyes-open",
  happy: "eyes-happy",
  joy: "eyes-closed-happy",
};

/** Lienzo original de las capas: 1254 × 1254 px. */
const CANVAS = 1254;
/** Boca: centrada bajo los ojos, dentro del visor (coordenadas del lienzo). */
const MOUTH = { cx: 640, cy: 632, rx: 22, ry: 7 };
const EYE_GREEN = "#b0cf2e";

const layer = (name: string) => `/muyu/${name}.png`;

/**
 * Muyu armado por capas PNG alineadas (mismo lienzo) más una boca en SVG.
 * Cada parte tiene data-part para animarla con CSS.
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
        <img className="muyu__part muyu__sprout" data-part="sprout" src={layer("sprout")} alt="" />
        <img className="muyu__part" data-part="body" src={layer("body")} alt="" />
        <img className="muyu__part muyu__chakana" data-part="chakana" src={layer("chakana")} alt="" />
        <img className="muyu__part" data-part="head" src={layer("head")} alt="" />
        <img className="muyu__part" data-part="visor" src={layer("visor")} alt="" />
        <img
          className={`muyu__part muyu__eyes muyu__eyes--${eyeExpression}`}
          data-part="eyes"
          src={layer(EYE_LAYER[eyeExpression])}
          alt=""
        />
        <svg
          className="muyu__part muyu__mouth"
          data-part="mouth"
          viewBox={`0 0 ${CANVAS} ${CANVAS}`}
          aria-hidden="true"
        >
          <ellipse cx={MOUTH.cx} cy={MOUTH.cy} rx={MOUTH.rx} ry={MOUTH.ry} fill={EYE_GREEN} />
        </svg>
        <img className="muyu__part muyu__arm-right" data-part="arm-right" src={layer("arm-right")} alt="" />
      </div>
    </div>
  );
}
