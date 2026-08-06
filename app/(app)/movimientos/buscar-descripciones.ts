"use server";

import { buscarDescripcionesGasto } from "@/backend/src/queries/gastos";

/**
 * Server Action para autocompletar la descripción del Gasto Directo.
 * Busca en las descripciones de gastos guardados (mínimo 3 caracteres).
 */
export async function buscarDescripcionesGastoAction(
  termino: string
): Promise<string[]> {
  if (!termino || termino.trim().length < 3) return [];
  return buscarDescripcionesGasto(termino.trim());
}
