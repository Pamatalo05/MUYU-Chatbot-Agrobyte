/** Incluye conexión y lectura del cuerpo; compatible con WebView sin AbortSignal.timeout. */
export async function conLimite<T>(trabajo: (signal: AbortSignal) => Promise<T>, ms: number, externa?: AbortSignal): Promise<T> {
  const controlador = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let cancelar = () => {};
  const limite = new Promise<never>((_, reject) => {
    cancelar = () => {
      controlador.abort();
      reject(new DOMException("Solicitud cancelada", "AbortError"));
    };
    temporizador = setTimeout(cancelar, ms);
    externa?.addEventListener("abort", cancelar, { once: true });
  });
  try {
    if (externa?.aborted) cancelar();
    return await Promise.race([limite, externa?.aborted ? limite : trabajo(controlador.signal)]);
  } finally {
    clearTimeout(temporizador);
    externa?.removeEventListener("abort", cancelar);
  }
}
