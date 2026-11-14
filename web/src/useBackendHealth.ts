import { useEffect, useState } from "react";
import { API_URL } from "./config";

export type BackendStatus = "checking" | "ok" | "no-key" | "offline";

interface HealthResponse {
  status: string;
  gemini_key_configured: boolean;
}

/** Consulta GET /health una vez al cargar la página. */
export function useBackendHealth(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<HealthResponse>;
      })
      .then((data) => setStatus(data.gemini_key_configured ? "ok" : "no-key"))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("offline");
      });

    return () => controller.abort();
  }, []);

  return status;
}
