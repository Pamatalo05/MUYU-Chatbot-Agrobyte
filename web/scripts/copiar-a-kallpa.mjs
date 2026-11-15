/**
 * Copia el Muyu compilado (dist-kallpa) dentro de la app Android de Kallpa:
 *   ../../Kallpa-AgroByte-2026/app/src/main/assets/muyu/
 * No copia datos/: Muyu lee el paquete_canton.json que ya trae Kallpa.
 * Uso: npm run build:kallpa   (o KALLPA_DIR=ruta/al/repo npm run build:kallpa)
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(web, "dist-kallpa");
const kallpa = resolve(process.env.KALLPA_DIR ?? join(web, "..", "..", "Kallpa-AgroByte-2026"));
const destino = join(kallpa, "app", "src", "main", "assets", "muyu");

if (!existsSync(origen)) {
  console.error("No existe dist-kallpa. Corre primero: npm run build:kallpa");
  process.exit(1);
}
if (!existsSync(join(kallpa, "app", "src", "main", "assets"))) {
  console.error(`No encontré la app Kallpa en ${kallpa}. Usa KALLPA_DIR=ruta/al/repo.`);
  process.exit(1);
}

rmSync(destino, { recursive: true, force: true });
cpSync(origen, destino, {
  recursive: true,
  filter: (ruta) => !ruta.includes(`${join(origen, "datos")}`),
});
console.log(`Muyu copiado en ${destino}`);
