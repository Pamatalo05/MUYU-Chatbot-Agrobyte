import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El simulador conserva solo el cuerpo público, nunca variables privadas del servidor.
const agente = vi.hoisted(() => ({ responder: vi.fn() }));
vi.mock("./manejarChat", () => ({ manejarChat: (cuerpo: string) => agente.responder(cuerpo) }));
import handler, { config } from "../../../netlify/functions/chat.mjs";

const URL_API = "https://muyu-agrobyte.netlify.app/api/chat";
const ANDROID = "https://appassets.androidplatform.net";
const peticion = (method: string, headers: Record<string, string> = {}, body?: string) => new Request(URL_API, { method, headers, body });
const preflight = (origin = ANDROID, method = "POST", headers = "content-type") => peticion("OPTIONS", {
  Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers,
});
beforeEach(() => {
  agente.responder.mockReset();
  agente.responder.mockResolvedValue({ status: 200, cuerpo: { text: "Respuesta de prueba", emotion: "neutral" } });
  vi.stubGlobal("fetch", () => { throw new Error("Las pruebas no permiten llamadas reales"); });
});
afterEach(() => vi.unstubAllGlobals());

describe("Netlify: preflight y orígenes de Android", () => {
  it("enruta /api/chat sin excluir OPTIONS", () => {
    expect(config).toEqual({ path: "/api/chat" });
  });
  it("responde 204 al preflight legítimo sin invocar el agente", async () => {
    const r = await handler(preflight());
    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(ANDROID);
    expect(r.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(r.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(r.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(r.headers.get("Vary")).toBe("Origin");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(agente.responder).not.toHaveBeenCalled();
  });
  it("acepta Content-Type sin depender de mayúsculas o espacios", async () => {
    expect((await handler(preflight(ANDROID, "POST", " Content-Type "))).status).toBe(204);
    expect(agente.responder).not.toHaveBeenCalled();
  });
  it.each(["https://evil.test", "https://appassets.androidplatform.net.evil.test", "http://appassets.androidplatform.net", "null"])("no admite el origen %s", async origin => {
    for (const req of [preflight(origin), peticion("POST", { Origin: origin }, "{}")]) {
      const r = await handler(req);
      expect(r.status).toBe(403);
      expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(r.headers.get("Vary")).toBe("Origin");
    }
    expect(agente.responder).not.toHaveBeenCalled();
  });
  it("rechaza métodos y cabeceras ajenas al contrato sin gastar cuota", async () => {
    expect((await handler(preflight(ANDROID, "DELETE"))).status).toBe(405);
    expect((await handler(preflight(ANDROID, "POST", "authorization"))).status).toBe(403);
    expect(agente.responder).not.toHaveBeenCalled();
  });
  it.each(["GET", "HEAD", "DELETE"])("%s devuelve 405 y cabeceras CORS, sin agente", async method => {
    const r = await handler(peticion(method, { Origin: ANDROID }));
    expect(r.status).toBe(405);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(ANDROID);
    expect(r.headers.get("Allow")).toBe("POST, OPTIONS");
    expect(agente.responder).not.toHaveBeenCalled();
  });
});

describe("Netlify: respuestas del agente y compatibilidad web", () => {
  it.each([ANDROID, "https://muyu-agrobyte.netlify.app", undefined])("conserva POST desde %s", async origin => {
    const r = await handler(peticion("POST", { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, '{"pregunta":"Hola"}'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: "Respuesta de prueba", emotion: "neutral" });
    expect(agente.responder).toHaveBeenCalledOnce();
    expect(agente.responder).toHaveBeenCalledWith('{"pregunta":"Hola"}');
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(origin ?? null);
  });
  it.each([400, 500, 502, 503])("mantiene CORS en HTTP %s para que Android pueda manejar el fallo", async status => {
    agente.responder.mockResolvedValue({ status, cuerpo: { error: "Error controlado" } });
    const r = await handler(peticion("POST", { Origin: ANDROID }, "{}"));
    expect(r.status).toBe(status);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(ANDROID);
    expect(await r.json()).toEqual({ error: "Error controlado" });
  });
  it("un fallo inesperado conserva CORS y no expone el diagnóstico", async () => {
    agente.responder.mockRejectedValue(new Error("detalle-privado-de-prueba"));
    const r = await handler(peticion("POST", { Origin: ANDROID }, "{}"));
    expect(r.status).toBe(500);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(ANDROID);
    expect(await r.text()).not.toContain("detalle-privado-de-prueba");
  });
});
