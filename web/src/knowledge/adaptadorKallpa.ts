
export type EscenarioKallpa = "neutro" | "nino" | "nina";

export interface MesKallpa {
  mes: number;
  lluvia_mm: number;
  temp_c: number;
  ndvi_modis: number;
  smap_humedad_superficial: number;
  humedad_raiz_predicha: Record<EscenarioKallpa, number>;
}

export interface RotacionKallpa {
  id: string;
  cultivo: string;
  region: string;
  ciclo_dias: number;
  fijacion_n_kg_ha: number;
  ahorro_urea_kg_ha: number;
  costo_insumos_ha: number;
  ingreso_bruto_ha: number;
  fuente_tecnica: string;
}

export interface CantonKallpa {
  nombre: string;
  region: string;
  coordenadas: { lat: number; lon: number };
  terreno: {
    elevacion_msnm: number;
    pendiente_srtm_pct: number;
  };
  suelo_referencia: string;
  serie_satelital_ml: MesKallpa[];
  top_rotaciones_ml: RotacionKallpa[];
  top_rotaciones_por_enso: Record<EscenarioKallpa, RotacionKallpa[]>;
}

export interface PaqueteKallpa {
  meta: {
    proyecto: string;
    periodo_analizado: string;
    actualizado_utc?: string;
  };
  fuentes_metodologia?: Record<string, string>;
  auditoria_reproducibilidad?: Record<string, unknown>;
  ml_metadata: {
    modelo_seleccionado: string;
    r2_test: number;
    mae_test: number;
  };
  cantones: Record<string, CantonKallpa>;
}

// En Android se reutiliza el mismo paquete científico empaquetado por Kallpa.
const RUTA_NUEVA = import.meta.env?.MODE === "kallpa"
  ? "../datos/paquete_canton.json"
  : `${import.meta.env?.BASE_URL ?? "/"}datos/nuevo/paquete_canton.json`;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

export async function cargarKallpaNuevo(): Promise<PaqueteKallpa> {
  const respuesta = await fetch(RUTA_NUEVA);

  if (!respuesta.ok) {
    throw new Error(`Error cargando Kallpa: HTTP ${respuesta.status}`);
  }

  const datos: unknown = await respuesta.json();

  if (!esObjeto(datos) || !esObjeto(datos.cantones)) {
    throw new Error("El paquete nuevo no contiene cantones válidos.");
  }

  const cantones = datos.cantones;

  for (const [id, valor] of Object.entries(cantones)) {
    if (!esObjeto(valor)) {
      throw new Error(`Cantón inválido: ${id}`);
    }

    if (
      typeof valor.nombre !== "string" ||
      !Array.isArray(valor.serie_satelital_ml) ||
      valor.serie_satelital_ml.length !== 12 ||
      !Array.isArray(valor.top_rotaciones_ml) ||
      !esObjeto(valor.top_rotaciones_por_enso)
    ) {
      throw new Error(`Datos incompletos para ${id}`);
    }

    for (const escenario of ["neutro", "nino", "nina"]) {
      if (!Array.isArray(valor.top_rotaciones_por_enso[escenario])) {
        throw new Error(`Faltan rotaciones ${escenario} en ${id}`);
      }
    }
  }

  return datos as unknown as PaqueteKallpa;
}

export function obtenerCantonKallpa(
  paquete: PaqueteKallpa,
  canton: string
): CantonKallpa | null {
  return paquete.cantones[canton.toLowerCase().trim()] ?? null;
}

export function obtenerMesKallpa(
  canton: CantonKallpa,
  mes: number,
  escenario: EscenarioKallpa = "neutro"
) {
  const datos = canton.serie_satelital_ml.find((m) => m.mes === mes);

  if (!datos) return null;

  return {
    mes: datos.mes,
    lluvia_mm: datos.lluvia_mm,
    temperatura_c: datos.temp_c,
    ndvi: datos.ndvi_modis,
    humedad_superficial_smap: datos.smap_humedad_superficial,
    humedad_raiz_predicha: datos.humedad_raiz_predicha[escenario],
    escenario,
  };
}

export function obtenerRotacionesKallpa(
  canton: CantonKallpa,
  escenario: EscenarioKallpa = "neutro"
): RotacionKallpa[] {
  return canton.top_rotaciones_por_enso[escenario] ?? [];
}

export function calcularMargenParcial(
  rotacion: RotacionKallpa
): number {
  // No incluye otros costos ni monetiza el ahorro de urea.
  return rotacion.ingreso_bruto_ha - rotacion.costo_insumos_ha;
}
