// Textos compartidos del circuito de **Trabajo** (jornadas / tareas).
// Módulo **puro** (sin React ni BD): lo usan la grilla de `/trabajo`
// (`components/periodos-grid.tsx`) y el **Detalle de Ingresos** del dashboard
// (`components/ingresos-detalle.tsx`) para que la etiqueta del conteo sea la
// misma en los dos lugares.

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
