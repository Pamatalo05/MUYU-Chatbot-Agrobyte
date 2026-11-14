/** Configuración del frontend leída de web/.env */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";
