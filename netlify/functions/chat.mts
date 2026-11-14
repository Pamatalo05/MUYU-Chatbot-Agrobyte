/**
 * POST /api/chat — Muyu en vivo con Gemini (plan gratis).
 * La clave GEMINI_API_KEY vive solo aquí, en las variables de entorno de Netlify;
 * nunca llega al navegador.
 */
import datos from "../../web/public/data/paquete_canton.json";
import { AgenteError, conversar, MODELOS_GEMINI } from "../../web/src/agent/agente";
import { PeticionInvalidaError, validarPeticion } from "../../web/src/agent/peticion";
import { validarPaquete } from "../../web/src/knowledge/validarPaquete";

declare const process: { env: Record<string, string | undefined> };

const paquete = validarPaquete(datos);
const MAX_BYTES = 16_000;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "El servidor no tiene GEMINI_API_KEY" }, 500);

  try {
    const cuerpo = await req.text();
    if (cuerpo.length > MAX_BYTES) return json({ error: "Petición demasiado grande" }, 413);

    const peticion = validarPeticion(JSON.parse(cuerpo));
    const modelos = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELOS_GEMINI] : MODELOS_GEMINI;
    return json(await conversar(peticion, { apiKey, paquete, modelos }));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof PeticionInvalidaError) {
      return json({ error: error.message }, 400);
    }
    // El detalle va al log de Netlify, no al usuario.
    console.error("[api/chat]", error);
    const saturado = error instanceof AgenteError && /429|503/.test(error.message);
    return json({ error: saturado ? "Gemini está ocupado, intenta en un minuto" : "Error del agente" }, saturado ? 503 : 502);
  }
};

export const config = { path: "/api/chat" };
