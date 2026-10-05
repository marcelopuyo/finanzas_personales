// Textos compartidos del circuito de **Trabajo** (jornadas / tareas).
// Módulo **puro** (sin React ni BD): lo usan la grilla de `/trabajo`
// (`components/periodos-grid.tsx`), el panel "Trabajo" del dashboard
// (`components/periodos-trabajo-lista.tsx`) y las **tarjetas del Detalle de
// Ingresos** (`components/ingresos-tarjetas.tsx`) para que la etiqueta del conteo
// y el rango de fechas sean los mismos en todos los lugares.

/**
 * "3 jornadas", "1 tarea" o "1 jornada y 2 tareas".
 * Sin ítems devuelve "" (quien lo use decide qué mostrar en su lugar).
 */
export function etiquetaConteoItems(jornadas: number, tareas: number): string {
  const partes: string[] = [];
  if (jornadas)
    partes.push(`${jornadas} ${jornadas === 1 ? "jornada" : "jornadas"}`);
  if (tareas) partes.push(`${tareas} ${tareas === 1 ? "tarea" : "tareas"}`);
  return partes.join(" y ");
}

/**
 * "1 ítem" / "3 ítems" (cantidad de ítems = jornadas + tareas de una sección).
 */
export function etiquetaCantidadItems(n: number): string {
  return `${n} ${n === 1 ? "ítem" : "ítems"}`;
}

/** "dd-mm" de una fecha "YYYY-MM-DD" (se corta el string: nunca se parsea, así
 *  no hay corrimiento de día por zona horaria). */
export function corta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}-${mes}`;
}

/**
 * Rango de fechas "YYYY-MM-DD" en formato corto del circuito de Trabajo:
 * `"20-09"` (un solo día), `"24-09 → 26-09"` o con el año si el rango lo cruza
 * (`"28-12-25 → 03-01-26"`). Sin `desde` devuelve "".
 */
export function rangoFechas(desde: string, hasta: string): string {
  if (!desde) return "";
  if (desde === hasta) return corta(desde);
  const anioDesde = desde.slice(2, 4);
  const anioHasta = hasta.slice(2, 4);
  return anioDesde === anioHasta
    ? `${corta(desde)} → ${corta(hasta)}`
    : `${corta(desde)}-${anioDesde} → ${corta(hasta)}-${anioHasta}`;
}
