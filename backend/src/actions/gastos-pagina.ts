"use server";

import { getGastosPaginado } from "../queries/gastos";

/**
 * Server Action de LECTURA: una **tanda** del listado de gastos, para el scroll
 * infinito de la pantalla `/gastos` ("Ver más gastos" del Detalle del dashboard).
 *
 * ⚠️ El tamaño de página lo propone el cliente (`limit`) y el backend lo acota
 * (1..100). No puede exportarse una constante desde acá: un módulo `"use server"`
 * solo puede exportar funciones `async`.
 */
export async function getGastosPaginaAction(
  offset: number,
  limit: number,
  search: string,
  /**
   * Filtros del panel (categoría y cuenta, **sin** la fecha): el listado de la
   * pantalla Gastos respeta los mismos filtros que sus gráficos (2026-10-03).
   */
  filtros?: { categorias?: string[]; cuentas?: string[] }
) {
  return getGastosPaginado({
    offset,
    limit,
    search,
    categorias: filtros?.categorias,
    cuentas: filtros?.cuentas,
  });
}
