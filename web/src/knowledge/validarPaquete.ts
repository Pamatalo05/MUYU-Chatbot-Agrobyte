import { ESCENARIOS, type PaqueteCanton } from "./types";

/** Error con la ruta exacta del campo que falla, p. ej. "cantones.daule.altitud_m". */
export class PaqueteInvalidoError extends Error {
  constructor(ruta: string, detalle: string) {
    super(`paquete_canton.json inválido en "${ruta}": ${detalle}`);
    this.name = "PaqueteInvalidoError";
  }
}

type Objeto = Record<string, unknown>;

const esObjeto = (valor: unknown): valor is Objeto =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

function exigirObjeto(valor: unknown, ruta: string): Objeto {
  if (!esObjeto(valor)) throw new PaqueteInvalidoError(ruta, "se esperaba un objeto");
  return valor;
}

function exigirNumero(objeto: Objeto, campo: string, ruta: string): void {
  const valor = objeto[campo];
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba un número (sin NaN)");
  }
}

function exigirTexto(objeto: Objeto, campo: string, ruta: string): void {
  if (typeof objeto[campo] !== "string" || objeto[campo] === "") {
    throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba un texto");
  }
}

function exigirBooleano(objeto: Objeto, campo: string, ruta: string): void {
  if (typeof objeto[campo] !== "boolean") {
    throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba true o false");
  }
}

const CAMPOS_MES = [
  "mes",
  "temp_max_c",
  "lluvia_mm_mes",
  "ndvi",
  "humedad_raiz",
  "rendimiento_predicho_rf",
] as const;

/**
 * Comprueba la forma del JSON antes de usarlo, para fallar con un mensaje claro
 * en vez de mostrar "undefined" en una respuesta de Muyu.
 */
export function validarPaquete(datos: unknown): PaqueteCanton {
  const raiz = exigirObjeto(datos, "raíz");
  exigirTexto(raiz, "version", "raíz");

  const cantones = exigirObjeto(raiz.cantones, "cantones");
  if (Object.keys(cantones).length === 0) {
    throw new PaqueteInvalidoError("cantones", "no hay cantones");
  }

  for (const [id, valor] of Object.entries(cantones)) {
    const ruta = `cantones.${id}`;
    const canton = exigirObjeto(valor, ruta);
    exigirTexto(canton, "nombre", ruta);
    exigirTexto(canton, "suelo_referencia", ruta);
    exigirNumero(canton, "altitud_m", ruta);
    const escenarios = exigirObjeto(canton.escenarios_climaticos, `${ruta}.escenarios_climaticos`);

    for (const escenario of ESCENARIOS) {
      const rutaEscenario = `${ruta}.escenarios_climaticos.${escenario}`;
      const meses = escenarios[escenario];
      if (!Array.isArray(meses) || meses.length !== 12) {
        throw new PaqueteInvalidoError(rutaEscenario, "se esperaban 12 meses");
      }
      meses.forEach((mes, indice) => {
        const rutaMes = `${rutaEscenario}[${indice}]`;
        const datosMes = exigirObjeto(mes, rutaMes);
        CAMPOS_MES.forEach((campo) => exigirNumero(datosMes, campo, rutaMes));
        if (datosMes.mes !== indice + 1) {
          throw new PaqueteInvalidoError(`${rutaMes}.mes`, `se esperaba el mes ${indice + 1}`);
        }
      });
    }
  }

  if (!Array.isArray(raiz.cultivos) || raiz.cultivos.length === 0) {
    throw new PaqueteInvalidoError("cultivos", "se esperaba una lista con al menos un cultivo");
  }
  raiz.cultivos.forEach((valor, indice) => {
    const ruta = `cultivos[${indice}]`;
    const cultivo = exigirObjeto(valor, ruta);
    ["id", "nombre", "tipo"].forEach((campo) => exigirTexto(cultivo, campo, ruta));
    ["dias_ciclo", "ahorro_urea_ha", "ingreso_bruto_ha"].forEach((campo) =>
      exigirNumero(cultivo, campo, ruta),
    );
    ["fija_nitrogeno", "tolera_encharcamiento"].forEach((campo) =>
      exigirBooleano(cultivo, campo, ruta),
    );
    if (!["baja", "media", "alta"].includes(cultivo.demanda_agua as string)) {
      throw new PaqueteInvalidoError(`${ruta}.demanda_agua`, 'se esperaba "baja", "media" o "alta"');
    }
  });

  return datos as PaqueteCanton;
}
