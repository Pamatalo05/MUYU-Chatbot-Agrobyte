import Muyu, { type MuyuState } from "./Muyu";
import "./MuyuAvatar.css";

interface MuyuAvatarProps {
  /** Estado en vivo (último mensaje). Sin estado, Muyu queda quieto (mensajes anteriores). */
  estado?: MuyuState;
}

/** Mini Muyu junto a sus mensajes: el del mensaje actual se mueve igual que el grande. */
export default function MuyuAvatar({ estado }: MuyuAvatarProps) {
  return (
    <span className={`muyu-avatar${estado ? " muyu-avatar--vivo" : ""}`}>
      <Muyu state={estado ?? "idle"} size={56} decorativo className={estado ? "" : "muyu--quieto"} />
    </span>
  );
}
