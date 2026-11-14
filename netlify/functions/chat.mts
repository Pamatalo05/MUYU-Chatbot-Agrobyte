/**
 * POST /api/chat — Muyu en vivo con Gemini (plan gratis).
 * La clave GEMINI_API_KEY vive solo en las variables de entorno de Netlify;
 * nunca llega al navegador. La lógica está en web/src/agent/manejarChat.ts.
 */
import { manejarChat } from "../../web/src/agent/manejarChat";

declare const process: { env: Record<string, string | undefined> };

export default async (req: Request): Promise<Response> => {
  const { status, cuerpo } =
    req.method === "POST"
      ? await manejarChat(await req.text(), process.env)
      : { status: 405, cuerpo: { error: "Usa POST" } };
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
};

export const config = { path: "/api/chat" };
