"use server";

import { decimalToTime } from "@/lib/utils";
import {
  getJornadaTrabajoById,
  getLiquidacionesCobradasPaginado,
  getTareaTrabajoById,
} from "@/backend/src/queries/trabajos";
import type { ItemEditable } from "./tipos";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" de una fecha del backend (las columnas `date` llegan como Date
 *  a medianoche UTC, así que las partes UTC son el día correcto). */
function isoFecha(v: Date | string): string {
  return v instanceof Date
    ? v.toISOString().slice(0, 10)
    : String(v).slice(0, 10);
}

/** "HH:MM" LOCAL del instante de una tarea (igual que la grilla de escritorio). */
function horaLocal(v: Date | string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Trae los datos **completos** del ítem que se va a editar (2026-09-26): el
 * listado de `/trabajo` sólo trae el resumen, y el formulario necesita la hora
 * de la tarea y la cuenta del depósito de propina. Falla si el ítem no existe,
 * no es del usuario o **ya está liquidado** (congelado): el guard real vive en
 * las acciones de escritura, esto es sólo para no abrir un formulario inútil.
 */
export async function obtenerItemEditable(
  tipo: "jornada" | "tarea",
  id: string
): Promise<ItemEditable> {
  if (tipo === "jornada") {
    const j = await getJornadaTrabajoById(id);
    if (!j) throw new Error("Jornada no encontrada");
    if (j.periodoTrabajoId) {
      throw new Error(
        "Esa jornada ya está liquidada (cobrada): se corrige anulando el cobro y volviéndola a cobrar"
      );
    }
    return {
      id: j.id,
      tipo: "jornada",
      fecha: isoFecha(j.fechaJornada),
      horaDesde: decimalToTime(j.horaDesde),
      horaHasta: decimalToTime(j.horaHasta),
      hora: null,
      montoPropina: j.montoPropina ?? 0,
      cuentaPropinaId: j.cuentaPropinaId ?? null,
      descripcion: null,
      horasTarea: null,
      monto: j.montoJornada ?? 0,
    };
  }

  const t = await getTareaTrabajoById(id);
  if (!t) throw new Error("Tarea no encontrada");
  if (t.periodoTrabajoId) {
    throw new Error(
      "Esa tarea ya está liquidada (cobrada): se corrige anulando el cobro y volviéndola a cobrar"
    );
  }
  return {
    id: t.id,
    tipo: "tarea",
    fecha: isoFecha(t.fechaTarea),
    horaDesde: null,
    horaHasta: null,
    hora: horaLocal(t.fechaHoraTarea),
    montoPropina: 0,
    cuentaPropinaId: null,
    descripcion: t.descripcion ?? null,
    horasTarea: t.horasTarea ?? null,
    monto: t.montoTarea ?? 0,
  };
}

/**
 * Server Action de LECTURA: una **tanda** de liquidaciones cobradas para el
 * **scroll infinito** de `/trabajo` (2026-09-26). El tamaño de la página lo
 * propone el cliente y el backend lo acota (1..100).
 */
export async function getLiquidacionesCobradasPaginaAction(
  offset: number,
  limit: number
) {
  return getLiquidacionesCobradasPaginado(offset, limit);
}
