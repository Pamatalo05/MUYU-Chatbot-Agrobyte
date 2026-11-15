import { CLAVE_ML, ESCENARIOS, type PaqueteCanton } from "./types";

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

/** Número dentro de un rango físico posible (p. ej. humedad entre 0 y 1). */
function validarRango(datos: Objeto, campo: string, minimo: number, maximo: number, ruta: string): void {
  const valor = datos[campo];
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new PaqueteInvalidoError(`${ruta}.${campo}`, `valor ${String(valor)} fuera del rango [${minimo}, ${maximo}]`);
  }
}

function textos(o: Objeto, campos: readonly string[], ruta: string): void {
  for (const campo of campos) {
    if (typeof o[campo] !== "string" || o[campo] === "") {
      throw new PaqueteInvalidoError(`${ruta}.${campo}`, "se esperaba un texto");
    }
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

function validarMesSatelital(mes: Objeto, ruta: string): void {
  validarRango(mes, "lluvia_mm", 0, 2000, ruta);
  validarRango(mes, "temp_c", -10, 50, ruta);
  validarRango(mes, "ndvi_modis", -1, 1, ruta);
  validarRango(mes, "smap_humedad_superficial", 0, 1, ruta);
  const rutaMl = `${ruta}.humedad_raiz_predicha`;
  const prediccion = objeto(mes.humedad_raiz_predicha, rutaMl);
  for (const clave of Object.values(CLAVE_ML)) validarRango(prediccion, clave, 0, 1, rutaMl);
}

function validarRotacion(valor: unknown, ruta: string): void {
  const r = objeto(valor, ruta);
  textos(r, ["id", "cultivo", "fuente_tecnica"], ruta);
  numeros(r, ["ciclo_dias", "fijacion_n_kg_ha"], ruta);
  for (const campo of ["ahorro_urea_kg_ha", "costo_insumos_ha", "ingreso_bruto_ha"]) validarRango(r, campo, 0, 100_000, ruta);
}

function validarCanton(valor: unknown, ruta: string): void {
  const canton = objeto(valor, ruta);
  textos(canton, ["nombre", "region", "suelo_referencia"], ruta);
  numeros(objeto(canton.coordenadas, `${ruta}.coordenadas`), ["lat", "lon"], `${ruta}.coordenadas`);
  numeros(objeto(canton.terreno, `${ruta}.terreno`), ["elevacion_msnm", "pendiente_srtm_pct"], `${ruta}.terreno`);
  doceMeses(canton.serie_satelital_ml, `${ruta}.serie_satelital_ml`, validarMesSatelital);

  const rutaRot = `${ruta}.top_rotaciones_por_enso`;
  const porEnso = objeto(canton.top_rotaciones_por_enso, rutaRot);
  for (const escenario of ESCENARIOS) {
    const lista = porEnso[CLAVE_ML[escenario]];
    const rutaLista = `${rutaRot}.${CLAVE_ML[escenario]}`;
    if (!Array.isArray(lista) || lista.length === 0) throw new PaqueteInvalidoError(rutaLista, "se esperaba al menos un cultivo");
    lista.forEach((r, i) => validarRotacion(r, `${rutaLista}[${i}]`));
  }
}

/**
 * Comprueba la forma del JSON antes de usarlo, para fallar con un mensaje claro
 * en vez de mostrar "undefined" en una respuesta de Muyu.
 */
export function validarPaquete(datos: unknown): PaqueteCanton {
  const raiz = objeto(datos, "raíz");
  objeto(raiz.meta, "meta");
  objeto(raiz.fuentes_metodologia, "fuentes_metodologia");
  numeros(objeto(raiz.ml_metadata, "ml_metadata"), ["r2_test", "mae_test"], "ml_metadata");

  const cantones = objeto(raiz.cantones, "cantones");
  if (Object.keys(cantones).length === 0) throw new PaqueteInvalidoError("cantones", "no hay cantones");
  for (const [id, canton] of Object.entries(cantones)) validarCanton(canton, `cantones.${id}`);

  return datos as PaqueteCanton;
}
