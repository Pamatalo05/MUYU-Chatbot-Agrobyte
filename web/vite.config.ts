import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { manejarChat, type EntornoServidor } from "./src/agent/manejarChat";

/**
 * Sirve POST /api/chat dentro de `npm run dev`, con la misma lógica que la Netlify
 * Function. La clave se lee del .env de la raíz del repo (sin prefijo VITE_), así
 * que nunca se incluye en el código del navegador.
 */
function apiChatLocal(entorno: EntornoServidor): Plugin {
  return {
    name: "muyu-api-chat-local",
    configureServer(server) {
      if (!entorno.GEMINI_API_KEY) {
        server.config.logger.warn("[muyu] Falta GEMINI_API_KEY en el .env de la raíz: Muyu responderá en modo campo.");
      }
      server.middlewares.use("/api/chat", async (req, res) => {
        let cuerpo = "";
        const decodificador = new TextDecoder();
        for await (const parte of req) cuerpo += decodificador.decode(parte, { stream: true });

        const { status, cuerpo: respuesta } =
          req.method === "POST"
            ? await manejarChat(cuerpo, entorno)
            : { status: 405, cuerpo: { error: "Usa POST" } };
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(respuesta));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // "" = carga todas las variables del .env de la raíz, no solo las VITE_*.
  const env = loadEnv(mode, "..", "");
  return {
    plugins: [react(), apiChatLocal({ GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_MODEL: env.GEMINI_MODEL })],
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
