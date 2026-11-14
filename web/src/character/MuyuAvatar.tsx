import "./MuyuAvatar.css";

/** Cara de Muyu (mismas capas del personaje, recortadas) para las burbujas del chat. */
export default function MuyuAvatar() {
  return (
    <span className="muyu-avatar" aria-hidden="true">
      <span className="muyu-avatar__capas">
        <img src="/muyu/sprout.png" alt="" />
        <img src="/muyu/head.png" alt="" />
        <img src="/muyu/visor.png" alt="" />
        <img src="/muyu/eyes-open.png" alt="" />
      </span>
    </span>
  );
}
