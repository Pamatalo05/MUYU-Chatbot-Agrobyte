
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RELATIVA = join(
  "datos",
  "procesados",
  "paquete_canton.json"
);

const argumento =
  process.argv[2] ??
  resolve(web, "..", "..", "Kallpa-AgroByte-2026");

const origen = argumento.toLowerCase().endsWith(".json")
  ? resolve(argumento)
  : join(resolve(argumento), RELATIVA);

const destino = join(
  web,
  "public",
  "datos",
  "nuevo",
  "paquete_canton.json"
);

function fallar(mensaje) {
  console.error(`[Muyu] ${mensaje}`);
  process.exit(1);
}

if (!existsSync(origen)) {
  fallar(
    `No encuentro ${origen}\n` +
    "Usa: npm run datos -- C:\\ruta\\paquete_canton.json"
  );
}

let datos;

try {
  datos = JSON.parse(readFileSync(origen, "utf-8"));
} catch (error) {
  fallar(`El JSON no se puede leer: ${error.message}`);
}

if (
  !datos ||
  typeof datos !== "object" ||
  !datos.ml_metadata ||
  typeof datos.ml_metadata.modelo_seleccionado !== "string" ||
  !datos.cantones ||
  typeof datos.cantones !== "object" ||
  Array.isArray(datos.cantones)
) {
  fallar("El archivo no tiene la estructura de Kallpa ML.");
}

const escenarios = ["neutro", "nino", "nina"];
const cantones = Object.entries(datos.cantones);

if (cantones.length === 0) {
  fallar("El paquete no contiene cantones.");
}

for (const [id, canton] of cantones) {
  if (
    !canton ||
    typeof canton.nombre !== "string" ||
    !Array.isArray(canton.serie_satelital_ml) ||
    canton.serie_satelital_ml.length !== 12 ||
    !Array.isArray(canton.top_rotaciones_ml) ||
    !canton.top_rotaciones_por_enso
  ) {
    fallar(`Datos incompletos para ${id}.`);
  }

  for (const escenario of escenarios) {
    if (
      !Array.isArray(
        canton.top_rotaciones_por_enso[escenario]
      )
    ) {
      fallar(`Faltan rotaciones ${escenario} en ${id}.`);
    }
  }

  const meses = new Set();

  for (const fila of canton.serie_satelital_ml) {
    if (
      !Number.isInteger(fila.mes) ||
      fila.mes < 1 ||
      fila.mes > 12 ||
      meses.has(fila.mes) ||
      !Number.isFinite(fila.lluvia_mm) ||
      !Number.isFinite(fila.temp_c) ||
      !Number.isFinite(fila.ndvi_modis) ||
      !Number.isFinite(fila.smap_humedad_superficial) ||
      !fila.humedad_raiz_predicha
    ) {
      fallar(`Serie mensual inválida en ${id}.`);
    }

    for (const escenario of escenarios) {
      const humedad = fila.humedad_raiz_predicha[escenario];

      if (
        !Number.isFinite(humedad) ||
        humedad < 0 ||
        humedad > 1
      ) {
        fallar(`Humedad inválida en ${id}, mes ${fila.mes}.`);
      }
    }

    meses.add(fila.mes);
  }
}

mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origen, destino);

const kb = Math.round(statSync(destino).size / 1024);

console.log(
  `[Muyu] Sincronizados ${cantones.length} cantones (${kb} KB).`
);
console.log(`Destino: ${destino}`);
console.log("Ejecuta: npm test && npm run build");
