import type { CSSProperties } from "react";
import "./Muyu.css";

/** Expresión de los ojos. Coincide con las capas en public/muyu. */
export type MuyuEyes = "open" | "happy" | "joy";

interface MuyuProps {
  /** Ojos a mostrar. Por defecto: abiertos. */
  eyes?: MuyuEyes;
  /** Tamaño máximo en píxeles; se achica solo si no hay espacio. */
  size?: number;
  /** Clases extra para los estados de animación de los próximos bloques. */
  className?: string;
}

const EYE_LAYER: Record<MuyuEyes, string> = {
  open: "eyes-open",
  happy: "eyes-happy",
  joy: "eyes-closed-happy",
};

const layer = (name: string) => `/muyu/${name}.png`;

/**
 * Muyu armado por capas PNG (todas del mismo tamaño y alineadas),
 * para animar cada parte por separado con CSS.
 */
export default function Muyu({ eyes = "open", size = 320, className = "" }: MuyuProps) {
  return (
    <div
      className={`muyu ${className}`.trim()}
      style={{ "--muyu-size": `${size}px` } as CSSProperties}
      role="img"
      aria-label="Muyu, un robot-semilla con un brote en la cabeza y una chakana en el pecho"
    >
      <div className="muyu__float">
        <img className="muyu__part muyu__arm-left" src={layer("arm-left")} alt="" />
        <img className="muyu__part muyu__sprout" src={layer("sprout")} alt="" />
        <img className="muyu__part" src={layer("body")} alt="" />
        <img className="muyu__part" src={layer("head")} alt="" />
        <img className="muyu__part" src={layer("visor")} alt="" />
        <img
          className={`muyu__part muyu__eyes muyu__eyes--${eyes}`}
          src={layer(EYE_LAYER[eyes])}
          alt=""
        />
        <img className="muyu__part muyu__arm-right" src={layer("arm-right")} alt="" />
      </div>
    </div>
  );
}
