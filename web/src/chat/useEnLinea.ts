import { useEffect, useState } from "react";

/** true mientras el navegador dice tener red. Puede haber red sin internet: por eso K4 también cae ante errores. */
export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  return enLinea;
}
