import type { Semaforo } from "../knowledge/semaforo";
export function explicarSemaforo({ color, motivo }: Semaforo) {
  const estado = { verde: "Condiciones favorables", amarillo: "Conviene tener precaución", rojo: "Condiciones desfavorables" }[color];
  // El esquema actual evalúa humedad estimada, no un cambio de lluvia.
  if (motivo.includes("humedad del suelo")) {
    const exceso = /encharcamiento|muy húmedo/.test(motivo);
    const deficit = /seco/.test(motivo);
    const explicacion = exceso
      ? "El cálculo señala mucha agua cerca de las raíces; no confirma que tu terreno esté encharcado."
      : deficit ? "El cálculo señala poca agua cerca de las raíces; no es una medición actual de tu terreno."
      : "El promedio de agua estimada cerca de las raíces está dentro del rango evaluado como favorable. No es una medición actual de tu terreno.";
    const acciones = exceso ? ["Revisa si hay agua acumulada.", "Comprueba que el agua pueda salir del terreno."]
      : deficit ? ["Revisa la humedad del terreno.", "Comprueba el agua disponible antes de sembrar."]
      : ["Comprueba la humedad real del terreno.", "Revisa las necesidades del cultivo que piensas sembrar."];
    return { estado, explicacion, acciones, limite: "Esto solo considera humedad de raíz estimada; no evalúa por completo si conviene sembrar." };
  }
  const caso = motivo.includes("exceso de lluvia") ? "exceso" : motivo.includes("sequía") ? "deficit" : /ningún cultivo|solo \d/.test(motivo) ? "cultivos" : motivo.includes("lluvia cercana") ? "normal" : "desconocido";
  const explicacion = {
    exceso: "La comparación de lluvias señala más agua de lo habitual; no confirma que tu terreno esté encharcado.",
    deficit: "La comparación de lluvias señala menos agua de lo habitual; no es una medición de la humedad de tu terreno.",
    cultivos: "Hay pocas opciones de cultivo que cumplan los criterios evaluados para esta combinación.",
    normal: "La comparación de lluvias y las opciones de cultivo son favorables en este contexto.",
    desconocido: "No tengo el detalle suficiente para explicar qué factor produjo este resultado.",
  }[caso];
  const acciones = caso === "exceso" ? ["Revisa si hay agua acumulada.", "Comprueba que el agua pueda salir del terreno."]
    : caso === "deficit" ? ["Revisa la humedad del terreno.", "Comprueba el agua disponible antes de sembrar."]
    : caso === "cultivos" ? ["Revisa qué opciones quedan después de tu cultivo anterior.", "Consulta su adecuación a tu terreno antes de elegir."]
    : caso === "normal" ? ["Comprueba la humedad real del terreno.", "Revisa las necesidades del cultivo que piensas sembrar."] : [];
  return { estado, explicacion, acciones, limite: "Esto solo considera lluvia y opciones de rotación; no evalúa por completo si conviene sembrar." };
}
