import type { Preferencias } from "../chat/estilo";
import { explicarSemaforo } from "../kallpa/explicarSemaforo";
import type { ChatReply, DatoVerificado, EvidenciaConsulta } from "../chat/types";
import type { MuyuContexto } from "./contexto";
import type { PaqueteKallpa } from "./adaptadorKallpa";
import type { PaqueteCanton } from "./types";
import { CLAVE_ML, ESCENARIO_NOMBRE } from "./types";
import { MESES, normalizar, resolverConsulta, type Consulta, type TemaConsulta } from "./contextoConversacion";
import { consultarKallpaML } from "../agent/herramientaKallpaNueva";
import { evaluarSemaforo } from "./semaforo";

const numero = (n: number, decimales = 1) => n.toLocaleString("es-EC", { maximumFractionDigits: decimales });
export function etiquetaContexto(e: EvidenciaConsulta): string {
  return `${e.canton} · ${MESES[e.contexto.mes - 1]} · ${e.escenarios?.join(" / ") ?? ESCENARIO_NOMBRE[e.contexto.escenario]}`;
}

/** Every displayed number comes from the same local tool used by the REST agent. */
export function respuestaAgricola(consulta: Consulta, paquete: PaqueteKallpa | undefined, pregunta: string, original?: PaqueteCanton, preferencias?: Preferencias): ChatReply | undefined {
  if (consulta.error) return { text: consulta.error, emotion: "neutral" };
  if (!consulta.tema) return;
  if (!paquete) return { text: "No están disponibles los datos actualizados de Kallpa. No puedo verificar esta consulta; vuelve a intentarlo cuando estén cargados.", emotion: "neutral" };
  const { contexto, tema } = consulta;
  const resultado = consultarKallpaML(paquete, { canton_id: contexto.cantonId, mes: contexto.mes, escenario: CLAVE_ML[contexto.escenario] });
  if (resultado.error) return { text: `${resultado.error}. No sustituiré esos datos por otro cantón o período.`, emotion: "neutral" };
  const clima = resultado.clima as Record<string, number | null>;
  const datos: DatoVerificado[] = [];
  const agregar = (campo: string, etiqueta: string, unidad: string, tipo: string, fraccion = false) => {
    const valor = clima[campo];
    if (typeof valor === "number" && Number.isFinite(valor) && (!fraccion || (valor >= 0 && valor <= 1))) datos.push({ campo, etiqueta, valor, unidad, tipo });
  };
  if (["humedad_raiz", "resumen"].includes(tema)) agregar("humedad_raiz_predicha", "Humedad volumétrica de raíz", "m³/m³", `estimación de ${resultado.modelo}`, true);
  if (["humedad_superficial", "resumen"].includes(tema)) agregar("humedad_superficial_smap", "Humedad volumétrica superficial", "m³/m³", "referencia procesada de SMAP", true);
  if (["lluvia", "resumen"].includes(tema)) agregar("lluvia_mm", "Lluvia mensual de referencia", "mm", "referencia histórica procesada");
  if (["temperatura", "resumen"].includes(tema)) agregar("temperatura_c", "Temperatura de referencia", "°C", "referencia histórica procesada");
  if (["ndvi", "resumen"].includes(tema)) agregar("ndvi", "NDVI", "adimensional", "referencia procesada de MODIS");
  const evidencia: EvidenciaConsulta = {
    contexto: { ...contexto }, tema, canton: String(resultado.canton), fuente: "Kallpa ML",
    periodo: paquete.meta.periodo_analizado || "Período no documentado",
    tipo: tema === "humedad_raiz" ? `Estimación derivada · ${resultado.modelo}` : "Referencia procesada / resultado derivado",
    fuentesDocumentadas: Object.values(paquete.fuentes_metodologia ?? {}), datos,
  };
  const encabezado = `${evidencia.canton}, ${MESES[contexto.mes - 1]} (${ESCENARIO_NOMBRE[contexto.escenario]}).`;
  const lineas = [encabezado];
  if (tema === "enso") {
    evidencia.escenarios = ["El Niño", "La Niña"];
    evidencia.tipo = `Estimaciones derivadas · ${resultado.modelo}`;
    for (const escenario of ["el_nino", "la_nina"] as const) {
      const r = consultarKallpaML(paquete, { canton_id: contexto.cantonId, mes: contexto.mes, escenario: CLAVE_ML[escenario] });
      const valor = (r.clima as Record<string, unknown> | undefined)?.humedad_raiz_predicha;
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > 1) return { text: "Faltan estimaciones válidas para comparar los escenarios solicitados.", emotion: "neutral" };
      datos.push({ campo: `humedad_raiz_${escenario}`, etiqueta: `Humedad volumétrica de raíz con ${ESCENARIO_NOMBRE[escenario]}`, valor, unidad: "m³/m³", tipo: `estimación de ${r.modelo}` });
    }
  }
  for (const dato of datos) {
    const fraccion = dato.unidad === "m³/m³";
    const etiquetaVisible = dato.campo === "humedad_raiz_predicha" ? "Humedad de raíz estimada" : dato.campo === "humedad_superficial_smap" ? "Humedad en la superficie del suelo" : dato.etiqueta;
    lineas.push(`${etiquetaVisible}: ${numero(fraccion ? dato.valor * 100 : dato.valor, dato.campo === "ndvi" ? 3 : 1)} ${fraccion ? "% volumétrico" : dato.unidad}.`);
  }
  if (["rotacion", "urea"].includes(tema)) {
    const rotaciones = resultado.recomendaciones as Record<string, unknown>[];
    const mejor = tema === "urea" ? [...rotaciones].sort((a,b) => Number(b.ahorro_urea_kg_ha) - Number(a.ahorro_urea_kg_ha))[0] : rotaciones[0];
    if (!mejor || typeof mejor.cultivo !== "string" || typeof mejor.fuente !== "string" || !mejor.fuente.trim()) return { text: "No hay rotaciones documentadas para este contexto.", emotion: "neutral" };
    lineas.push(`Opción orientativa: ${mejor.cultivo}.`);
    const campos = tema === "urea" ? [["ahorro_urea_kg_ha", "Ahorro estimado de urea", "kg/ha"]] : [["ciclo_dias", "Ciclo de referencia", "días"], ["margen_parcial_usd_ha", "Margen parcial estimado", "USD/ha"]];
    for (const [campo, etiqueta, unidad] of campos) {
      const valor = mejor[campo];
      if (typeof valor !== "number" || !Number.isFinite(valor)) return { text: "Faltan datos válidos para cuantificar esta recomendación.", emotion: "neutral" };
      datos.push({ campo, etiqueta, valor, unidad, tipo: "estimación orientativa" });
      lineas.push(`${etiqueta}: ${numero(valor)} ${tema === "urea" ? "kg de urea por hectárea" : unidad}.`);
    }
    evidencia.fuentesDocumentadas.push(String(mejor.fuente));
    lineas.push("Es una estimación: no equivale a ganancia neta. Hace falta revisar las condiciones del terreno y el cultivo anterior antes de decidir.");
  }
  if (tema === "riesgo") {
    if (original?.cantones[contexto.cantonId]) {
      const semaforo = evaluarSemaforo(original, contexto);
      evidencia.fuente = "Kallpa · reglas del paquete original";
      evidencia.periodo = original.meta.periodo_analizado;
      evidencia.tipo = "Indicador calculado por reglas; sin calibración probabilística";
      evidencia.fuentesDocumentadas = [...original.meta.fuentes_datos];
      const detalle = explicarSemaforo(semaforo);
      lineas.push(`${detalle.estado}. ${detalle.explicacion}`, detalle.limite);
      if (/hacer|revisar|acciones/.test(normalizar(pregunta))) lineas.push(...detalle.acciones);
    } else lineas.push("No hay un indicador de riesgo calculado para este contexto.");
  }
  if (datos.length === 0 && tema !== "riesgo") return { text: "No hay valores válidos documentados para la variable solicitada. ¿Qué variable y contexto necesitas consultar?", emotion: "neutral" };
  if (/capacidad de campo|germinacion|probabilidad/.test(normalizar(pregunta))) lineas.push("La humedad volumétrica no equivale a capacidad de campo ni a probabilidad de germinación; faltan datos de suelo y criterios agronómicos para calcularlas.");
  if (/sembr|siembr|seguro|conviene/.test(normalizar(pregunta)) && !["rotacion", "riesgo"].includes(tema)) lineas.push("Estas variables por sí solas no permiten recomendar una siembra: faltan criterios agronómicos de suelo, cultivo y parcela.");
  const esperados: Record<string, number> = { humedad_raiz: 1, humedad_superficial: 1, lluvia: 1, temperatura: 1, ndvi: 1, resumen: 5 };
  if (datos.length < (esperados[tema] ?? 0)) lineas.push("No hay datos válidos para algunas de las variables que pediste; no las he supuesto iguales a cero.");
  if (tema === "humedad_raiz" || tema === "humedad_superficial") lineas.push("El porcentaje indica cuánto del volumen del suelo está ocupado por agua.");
  lineas.push("Son cálculos de referencia, no mediciones actuales de tu parcela.");
  if (/fuentes?|de donde/.test(normalizar(pregunta)) || preferencias?.nivel === "tecnico") {
    lineas.push(`Fuente: ${evidencia.fuente}. Tipo: ${evidencia.tipo}. Período: ${evidencia.periodo}.`, ...evidencia.fuentesDocumentadas);
  }
  if (preferencias?.longitud === "detallada" || /explicame mas|mas facil|por que|ejemplo/.test(normalizar(pregunta))) {
    if (tema === "humedad_raiz") lineas.push("Este porcentaje describe cuánta agua ocupa el volumen del suelo cerca de las raíces. Por sí solo no indica si debes sembrar o regar; para eso hacen falta las características del suelo y del cultivo.");
    if (tema === "ndvi") lineas.push("El NDVI ayuda a observar qué tan verde está la vegetación en imágenes satelitales. No confirma por sí solo que el cultivo esté sano.");
    if (tema === "lluvia") lineas.push("Los milímetros expresan la cantidad de lluvia. Esta referencia mensual no indica cuándo lloverá en tu parcela.");
  }
  return { text: lineas.join("\n"), emotion: ["rotacion", "urea"].includes(tema) ? "happy" : "neutral", evidencia };
}

/** Conservative validator: bind each number to its variable and unit, not a global number whitelist. */
export function validarRedaccion(texto: string, e: EvidenciaConsulta): boolean {
  const s = normalizar(texto);
  const contextoMencionado = resolverConsulta(texto, e.contexto);
  if (contextoMencionado.error) return false;
  if (/garantiz|debes sembrar|seguro sembrar|ganancia neta|rentabilidad garant|probabilidad|capacidad de campo|humedad relativa|observacion.*nasa|nasa.*predi|medicion.*actual/.test(s)) return false;
  if (/recomiend|conviene|puedes sembrar|deberias|optimo|ideal para|apto para|saturad|encharcad|suelo seco|humedad alta|humedad baja|humedad elevada|el doble|la mitad|llovera|va a llover|observad|medid[oa]/.test(s)) return false;
  if (e.datos.some(d => d.campo.startsWith("humedad_raiz")) && /nasa|smap|power|noaa/.test(s)) return false;
  if (e.datos.some(d => d.campo === "humedad_superficial_smap") && /predich|prediccion|ridge/.test(s) && e.tema === "humedad_superficial") return false;
  if (e.tema === "riesgo" || e.tema === "rotacion" || e.tema === "urea") return false; // Recommendations require the documented caveats and technical sources.
  const meses = MESES.filter(m => new RegExp(`\\b${m}\\b`).test(s));
  if (meses.some(m => m !== MESES[e.contexto.mes - 1])) return false;
  if (["daule", "babahoyo", "latacunga", "quito"].some(c => s.includes(c) && c !== e.contexto.cantonId)) return false;
  if (!e.escenarios) {
    if (/el nino/.test(s) && e.contexto.escenario !== "el_nino") return false;
    if (/la nina/.test(s) && e.contexto.escenario !== "la_nina") return false;
    if (/neutro|ano normal/.test(s) && e.contexto.escenario !== "neutro") return false;
  }
  if (e.datos.some(d => d.campo.startsWith("humedad_raiz")) && !/estim|predich|modelo/.test(s)) return false;
  const variablesNoConsultadas: [RegExp, string][] = [[/lluvia|precipitacion/, "lluvia_mm"], [/temperatura/, "temperatura_c"], [/ndvi/, "ndvi"], [/humedad superficial/, "humedad_superficial_smap"]];
  if (variablesNoConsultadas.some(([patron, campo]) => patron.test(s) && !e.datos.some(d => d.campo === campo))) return false;
  if (/\b(cien|ciento|mil|millon|por ciento|dolares|ganancia|perdida|riesgo|rendimiento)\b/.test(s)) return false;
  let encontrados = 0;
  const vistos = new Set<string>();
  const frases = s.split(/\n|[.;](?!\d)/);
  const vocabulario = new Set(("la el los las de del en para durante bajo escenario con es son se estima estimada estimadas estimado estimados predicha predichas predicho segun modelo ridge humedad volumetrica volumetrico raiz superficial suelo agua volumen porcentaje lluvia mensual referencia historica procesada temperatura ndvi adimensional mm c m dias daule guayas babahoyo rios enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre nino nina neutro ano normal aproximadamente equivale a al este valor esta cifra y no una medicion directa corresponde" ).split(" "));
  const explicacionSegura = /^(?:recuerda que )?(?:(?:este valor|esta cifra|la humedad de raiz|estos valores) )?(?:es|son|se trata de) (?:una |un conjunto de )?(?:estimacion|estimaciones|prediccion|predicciones|referencia|referencias)(?: (?:del modelo|de kallpa|historica|historicas|procesada|procesadas|derivada|derivadas|ridge))*(?:,? (?:y )?no (?:una |son )?medicion(?:es)? directa(?:s)?)?$/;

  for (const frase of frases) {
    const cantidades = [...frase.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(%|mm|°c|kg\/ha|usd\/ha|m[³3]\/m[³3]|dias|adimensional)?/g)];
    if (!cantidades.length) {
      const explicacion = frase.trim();
      if (explicacion && !explicacionSegura.test(explicacion) && !/^no (?:es una medicion directa|representa la humedad actual de tu parcela|es una garantia para tu parcela)$/.test(explicacion)) return false;
      continue;
    }
    // Unsupported causal claims, sources or qualitative thresholds trigger factual output.
    const palabras = frase.replace(/-?\d+(?:[.,]\d+)?/g, "").match(/[a-z]+/g) ?? [];
    if (palabras.some(p => !vocabulario.has(p))) return false;
    const candidatos = e.datos.filter(d => {
      if (d.campo.startsWith("humedad_raiz")) return /humedad/.test(frase) && /raiz/.test(frase) && (!e.escenarios || (d.campo.endsWith("el_nino") ? /nino/.test(frase) : /nina/.test(frase)));
      if (d.campo === "humedad_superficial_smap") return /humedad/.test(frase) && /superficial/.test(frase);
      if (d.campo === "lluvia_mm") return /lluvia|precipitacion/.test(frase);
      if (d.campo === "temperatura_c") return /temperatura/.test(frase);
      return d.campo === "ndvi" && /ndvi/.test(frase);
    });
    // A sentence naming multiple same-unit variables is ambiguous: use factual output.
    if (candidatos.length !== 1) return false;
    for (const cantidad of cantidades) {
      const valor = Number(cantidad[1].replace(",", "."));
      const unidad = cantidad[2];
      const dato = candidatos.find(d => {
        const esperada = d.unidad === "m³/m³" && unidad === "%" ? d.valor * 100 : d.valor;
        const unidadValida = d.unidad === "m³/m³" ? ["%", "m³/m³", "m3/m3"].includes(unidad) : d.unidad === "adimensional" ? !unidad || unidad === "adimensional" : normalizar(d.unidad) === unidad;
        const decimales = d.campo === "ndvi" ? 3 : unidad === "%" ? 1 : 3;
        return unidadValida && Math.abs(valor - Number(esperada.toFixed(decimales))) < 1e-8;
      });
      if (!dato) return false;
      vistos.add(dato.campo); encontrados++;
    }
  }
  return encontrados > 0 && e.datos.every(d => vistos.has(d.campo));
}

export function fundamentarRespuesta(texto: string, factual: ChatReply): ChatReply {
  if (!factual.evidencia || !validarRedaccion(texto, factual.evidencia)) return factual;
  return { ...factual, text: texto };
}
export function contextoHerramientaValido(args: Record<string, unknown>, contexto: MuyuContexto, tema?: TemaConsulta): boolean {
  return args.canton_id === contexto.cantonId && Number(args.mes) === contexto.mes && (tema === "enso" ? ["nino", "nina", "neutro"].includes(String(args.escenario)) : args.escenario === CLAVE_ML[contexto.escenario]);
}
