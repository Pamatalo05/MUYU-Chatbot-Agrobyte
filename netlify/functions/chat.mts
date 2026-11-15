/**
 * POST /api/chat — Muyu en vivo con Gemini (plan gratis).
 * La clave GEMINI_API_KEY vive solo en las variables de entorno de Netlify;
 * nunca llega al navegador. La lógica está en web/src/agent/manejarChat.ts.
 */
import { manejarChat } from "../../web/src/agent/manejarChat";

declare const process: { env: Record<string, string | undefined> };

/**
 * Muyu dentro de la app Kallpa se abre desde el teléfono (WebViewAssetLoader), con este origen.
 * Solo a él se le permite llamar a la función desde otro sitio.
 */
const ORIGEN_KALLPA = "https://appassets.androidplatform.net";

function cabeceras(req: Request): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (req.headers.get("Origin") === ORIGEN_KALLPA) {
    base["Access-Control-Allow-Origin"] = ORIGEN_KALLPA;
    base["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    base["Access-Control-Allow-Headers"] = "Content-Type";
    base["Vary"] = "Origin";
  }
  return base;
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabeceras(req) });
  const { status, cuerpo } =
    req.method === "POST"
      ? await manejarChat(await req.text(), process.env)
      : { status: 405, cuerpo: { error: "Usa POST" } };
  return new Response(JSON.stringify(cuerpo), { status, headers: cabeceras(req) });
};

export const config = { path: "/api/chat" };
