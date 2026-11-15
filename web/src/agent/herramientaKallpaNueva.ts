
import {
  obtenerCantonKallpa,
  obtenerMesKallpa,
  obtenerRotacionesKallpa,
  calcularMargenParcial,
  type EscenarioKallpa,
  type PaqueteKallpa,
} from "../knowledge/adaptadorKallpa";

const ESCENARIOS: EscenarioKallpa[] = [
  "neutro",
  "nino",
  "nina",
];

export function consultarKallpaML(
  paquete: PaqueteKallpa,
  args: Record<string, unknown>
): Record<string, unknown> {
  const cantonId = String(args.canton_id ?? "")
    .trim()
    .toLowerCase();

  const mes = Number(args.mes);
  const escenario = args.escenario;

  if (!ESCENARIOS.includes(escenario as EscenarioKallpa)) {
    return { error: "Escenario ENSO no válido" };
  }

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { error: "El mes debe estar entre 1 y 12" };
  }

  const canton = obtenerCantonKallpa(paquete, cantonId);

  if (!canton) {
    return {
      error: "No hay datos nuevos para ese cantón",
      cantones_disponibles: Object.keys(paquete.cantones),
    };
  }

  const fase = escenario as EscenarioKallpa;
  const clima = obtenerMesKallpa(canton, mes, fase);

  if (!clima) {
    return { error: "No existen datos para ese mes" };
  }

  for (const clave of Object.keys(clima) as (keyof typeof clima)[]) {
    if (["mes", "escenario"].includes(clave)) continue;
    const valor = clima[clave];
    const fraccion = ["humedad_superficial_smap", "humedad_raiz_predicha"].includes(clave);
    if (typeof valor !== "number" || !Number.isFinite(valor) || (fraccion && (valor < 0 || valor > 1)) || (clave === "ndvi" && (valor < -1 || valor > 1)) || (clave === "lluvia_mm" && valor < 0)) {
      // JSON null explicitly represents unavailable data, never zero.
      (clima as unknown as Record<string, unknown>)[clave] = null;
    }
  }
  const rotaciones = obtenerRotacionesKallpa(canton, fase);

  return {
    canton: canton.nombre,
    mes,
    escenario: fase,
    clima: {
      lluvia_mm: clima.lluvia_mm,
      temperatura_c: clima.temperatura_c,
      ndvi: clima.ndvi,
      humedad_superficial_smap:
        clima.humedad_superficial_smap,
      humedad_raiz_predicha:
        clima.humedad_raiz_predicha,
    },
    recomendaciones: rotaciones.map((rotacion) => ({
      id: rotacion.id,
      cultivo: rotacion.cultivo,
      ciclo_dias: rotacion.ciclo_dias,
      fijacion_n_kg_ha: rotacion.fijacion_n_kg_ha,
      ahorro_urea_kg_ha: rotacion.ahorro_urea_kg_ha,
      costo_insumos_usd_ha: rotacion.costo_insumos_ha,
      ingreso_bruto_usd_ha: rotacion.ingreso_bruto_ha,
      margen_parcial_usd_ha:
        calcularMargenParcial(rotacion),
      fuente: rotacion.fuente_tecnica,
    })),
    advertencias: [
      "La lluvia mensual no es una predicción específica de ENSO.",
      "El ahorro de urea está expresado en kg/ha, no en dólares.",
      "El margen parcial no representa una ganancia neta.",
      "Las recomendaciones son orientativas y requieren validación local.",
    ],
    modelo: paquete.ml_metadata.modelo_seleccionado,
    trazabilidad: {
      periodo: paquete.meta.periodo_analizado,
      actualizado_utc: paquete.meta.actualizado_utc,
      fuentes_documentadas: paquete.fuentes_metodologia ?? {},
      tipo_humedad_raiz: "Estimación derivada de Kallpa; no observación directa de NASA",
      unidad_humedad: "m³/m³ (fracción volumétrica)",
      unidad_lluvia: "mm/mes",
      unidad_temperatura: "°C",
      unidad_ndvi: "adimensional",
      limitaciones: "No hay fecha de observación individual ni probabilidad de germinación o pérdida financiera en este resultado.",
    },
  };
}
