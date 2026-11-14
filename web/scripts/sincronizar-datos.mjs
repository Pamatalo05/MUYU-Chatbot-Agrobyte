// Copia paquete_canton.json desde el repo de Kallpa (fuente única de los datos).
// Uso: npm run datos            → busca ../../Kallpa-AgroByte-2026 junto a este repo
//      npm run datos -- <ruta>  → ruta al repo de Kallpa o directamente al JSON
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RELATIVA = join("datos", "procesados", "paquete_canton.json");
const argumento = process.argv[2] ?? resolve(web, "..", "..", "Kallpa-AgroByte-2026");
const origen = argumento.endsWith(".json") ? resolve(argumento) : join(resolve(argumento), RELATIVA);
const destino = join(web, "public", "datos", "paquete_canton.json");

if (!existsSync(origen)) {
  console.error(`No encuentro ${origen}\nPasa la ruta del repo de Kallpa: npm run datos -- C:\\ruta\\Kallpa-AgroByte-2026`);
  process.exit(1);
}

// Revisión rápida; la validación completa la hacen las pruebas (npm test).
const datos = JSON.parse(readFileSync(origen, "utf-8"));
const cantones = Object.values(datos.cantones ?? {});
if (cantones.length === 0 || !cantones.every((c) => c.serie_satelital_ml && c.top_rotaciones_por_enso)) {
  console.error("El JSON no tiene 'cantones' con 'serie_satelital_ml' y 'top_rotaciones_por_enso': ¿es el paquete correcto?");
  process.exit(1);
}

mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origen, destino);
const kb = Math.round(statSync(destino).size / 1024);
const nombres = cantones.map((c) => c.nombre.split(",")[0]).join(", ");
console.log(`Copiado (${kb} KB): ${cantones.length} cantones (${nombres}).`);
console.log("Ahora ejecuta: npm test");
