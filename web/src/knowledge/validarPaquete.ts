import { ESCENARIOS, type PaqueteCanton } from "./types";

/** Error con la ruta exacta del campo que falla, p. ej. "cantones.daule.terreno.elevacion_msnm". */
export class PaqueteInvalidoError extends Error {
  constructor(ruta: string, detalle: string) {
    super(`paquete_canton.json inválido en "${ruta}": ${detalle}`);
    this.name = "PaqueteInvalidoError";
  }
}

type Objeto = Record<string, unknown>;

const esObjeto = (valor: unknown): valor is Objeto =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

function objeto(valor: unknown, ruta: string): Objeto {
  if (!esObjeto(valor)) throw new PaqueteInvalidoError(ruta, "se esperaba un objeto");
  return valor;
}

function numeros(o: Objeto, campos: readonly string[], ruta: string): void {
  for (const campo of campos) {
    if (typeof o[campo] !== "number" || !Number.isFinite(o[campo])) {
      throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba un número (sin NaN)");
    }
  }
}

function textos(o: Objeto, campos: readonly string[], ruta: string): void {
  for (const campo of campos) {
    if (typeof o[campo] !== "string" || o[campo] === "") {
      throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba un texto");
    }
  }
}

function booleanos(o: Objeto, campos: readonly string[], ruta: string): void {
  for (const campo of campos) {
    if (typeof o[campo] !== "boolean") throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba true o false");
  }
}

/** Lista de 12 meses en orden, cada uno revisado con `validarMes`. */
function doceMeses(valor: unknown, ruta: string, validarMes: (mes: Objeto, ruta: string) => void): void {
  if (!Array.isArray(valor) || valor.length !== 12) throw new PaqueteInvalidoError(ruta, "se esperaban 12 meses");
  valor.forEach((crudo, i) => {
    const rutaMes = `${ruta}[${i}]`;
    const mes = objeto(crudo, rutaMes);
    if (mes.mes !== i + 1) throw new PaqueteInvalidoError(`${rutaMes}.mes`, `se esperaba el mes ${i + 1}`);
    validarMes(mes, rutaMes);
  });
}

const CAMPOS_CLIMA = [
  "lluvia_mm_mes",
  "humedad_raiz",
  "humedad_superficial",
  "temp_max_c",
  "temp_min_c",
  "radiacion_mj_m2",
  "humedad_relativa_pct",
] as const;

function validarCanton(valor: unknown, ruta: string): void {
  const canton = objeto(valor, ruta);
  textos(canton, ["nombre", "region", "suelo_referencia"], ruta);
  numeros(objeto(canton.coordenadas, `${ruta}.coordenadas`), ["lat", "lon"], `${ruta}.coordenadas`);
  numeros(objeto(canton.terreno, `${ruta}.terreno`), ["elevacion_msnm", "pendiente_srtm_pct"], `${ruta}.terreno`);

  const escenarios = objeto(canton.escenarios_climaticos, `${ruta}.escenarios_climaticos`);
  for (const escenario of ESCENARIOS) {
    doceMeses(escenarios[escenario], `${ruta}.escenarios_climaticos.${escenario}`, (mes, r) =>
      numeros(mes, CAMPOS_CLIMA, r),
    );
  }
  doceMeses(canton.serie_satelital_ml, `${ruta}.serie_satelital_ml`, (mes, r) => {
    numeros(mes, ["lluvia_mm", "temp_c", "ndvi_modis"], r);
    const rutaMl = `${r}.humedad_raiz_predicha`;
    numeros(objeto(mes.humedad_raiz_predicha, rutaMl), ["neutro", "nino", "nina"], rutaMl);
  });
}

function validarCultivo(valor: unknown, ruta: string): void {
  const cultivo = objeto(valor, ruta);
  textos(cultivo, ["id", "nombre", "tipo", "fuente"], ruta);
  numeros(cultivo, ["dias_ciclo", "protege_suelo", "costo_insumos_ha", "ingreso_bruto_ha", "ahorro_urea_ha"], ruta);
  booleanos(cultivo, ["fija_nitrogeno", "tolera_encharcamiento"], ruta);
  if (!["baja", "media", "alta"].includes(cultivo.demanda_agua as string)) {
    throw new PaqueteInvalidoError(`${ruta}.demanda_agua`, 'se esperaba "baja", "media" o "alta"');
  }
  const regiones = cultivo.regiones;
  if (!Array.isArray(regiones) || regiones.length === 0 || !regiones.every((r) => typeof r === "string")) {
    throw new PaqueteInvalidoError(`${ruta}.regiones`, 'se esperaba una lista, p. ej. ["costa_humeda"]');
  }
}

/**
 * Comprueba la forma del JSON antes de usarlo, para fallar con un mensaje claro
 * en vez de mostrar "undefined" en una respuesta de Muyu.
 */
export function validarPaquete(datos: unknown): PaqueteCanton {
  const raiz = objeto(datos, "raíz");
  const meta = objeto(raiz.meta, "meta");
  if (!Array.isArray(meta.fuentes_datos)) throw new PaqueteInvalidoError("meta.fuentes_datos", "se esperaba una lista");
  numeros(objeto(raiz.ml_metadata, "ml_metadata"), ["r2_test", "mae_test"], "ml_metadata");

  const cantones = objeto(raiz.cantones, "cantones");
  if (Object.keys(cantones).length === 0) throw new PaqueteInvalidoError("cantones", "no hay cantones");
  for (const [id, canton] of Object.entries(cantones)) validarCanton(canton, `cantones.${id}`);

  if (!Array.isArray(raiz.cultivos) || raiz.cultivos.length === 0) {
    throw new PaqueteInvalidoError("cultivos", "se esperaba una lista con al menos un cultivo");
  }
  raiz.cultivos.forEach((cultivo, i) => validarCultivo(cultivo, `cultivos[${i}]`));

  return datos as PaqueteCanton;
}
