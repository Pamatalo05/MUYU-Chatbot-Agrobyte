/** POST /api/chat. La clave de Gemini se lee exclusivamente en el servidor. */
import { manejarChat } from "../../web/src/agent/manejarChat";

declare const process: { env: Record<string, string | undefined> };

// El puente Java de Kallpa solo se expone a los assets locales de este origen HTTPS.
const ORIGEN_KALLPA = "https://appassets.androidplatform.net";
const METODOS = "POST, OPTIONS";

export default async (req: Request): Promise<Response> => {
  const origen = req.headers.get("Origin");
  const permitido = !origen || origen === ORIGEN_KALLPA || origen === new URL(req.url).origin;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origen && permitido) {
    headers["Access-Control-Allow-Origin"] = origen;
    headers["Access-Control-Allow-Methods"] = METODOS;
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  const error = (status: number, mensaje: string) => new Response(JSON.stringify({ error: mensaje }), { status, headers });
  if (!permitido) return error(403, "Origen no permitido");

  // El preflight termina antes de leer el cuerpo, las variables privadas o el agente.
  if (req.method === "OPTIONS") {
    const metodo = req.headers.get("Access-Control-Request-Method");
    if (metodo && metodo !== "POST") {
      headers["Allow"] = METODOS;
      return error(405, "Método no permitido");
    }
    const solicitadas = (req.headers.get("Access-Control-Request-Headers") ?? "")
      .split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
    if (solicitadas.some(h => h !== "content-type")) return error(403, "Cabeceras no permitidas");
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    headers["Allow"] = METODOS;
    // HEAD sigue sin consultar Gemini; su respuesta confirma conectividad al frontend.
    return error(405, "Usa POST");
  }
  try {
    const { status, cuerpo } = await manejarChat(await req.text(), process.env);
    return new Response(JSON.stringify(cuerpo), { status, headers });
  } catch {
    // También los fallos inesperados conservan CORS, sin revelar diagnósticos privados.
    return error(500, "No pude completar la consulta en línea. Inténtalo nuevamente.");
  }
};

// Netlify enruta todos los métodos de /api/chat a esta función, incluido OPTIONS.
export const config = { path: "/api/chat" };
