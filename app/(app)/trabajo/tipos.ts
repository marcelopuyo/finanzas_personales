/**
 * Tipos de la pantalla `/trabajo` (no lleva `"use server"`: los comparten las
 * acciones y los componentes de cliente).
 */

/**
 * Datos **completos** de un ítem pendiente para el formulario de edición.
 * El listado de la pantalla trae sólo lo que muestra (`ItemPendienteOut`), así
 * que la hora exacta de una tarea y la **cuenta de la propina** de una jornada
 * se piden recién al abrir el modal (`obtenerItemEditable`).
 */
export interface ItemEditable {
  id: string;
  tipo: "jornada" | "tarea";
  /** "YYYY-MM-DD" local (el día del ítem). */
  fecha: string;
  /** Jornada: "HH:MM". Tarea: `null`. */
  horaDesde: string | null;
  horaHasta: string | null;
  /** Tarea: "HH:MM" del instante (`fechaHoraTarea`). Jornada: `null`. */
  hora: string | null;
  /** Jornada: propina depositada (no entra en la liquidación). Tarea: 0. */
  montoPropina: number;
  /** Cuenta donde se depositó la propina (para preseleccionar el select). */
  cuentaPropinaId: number | null;
  /** Tarea: descripción. Jornada: `null`. */
  descripcion: string | null;
  /** Tarea: horas informativas. Jornada: `null`. */
  horasTarea: number | null;
  /** Monto del ítem (jornada: calculado; tarea: cargado a mano). */
  monto: number;
}
