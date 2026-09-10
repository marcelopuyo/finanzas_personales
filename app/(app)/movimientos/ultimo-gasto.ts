"use server";

import { getUltimoGastoPorDescripcion } from "@/backend/src/queries/gastos";
import { montoPredeterminadaEnMonedaCuenta } from "@/backend/src/lib/cotizaciones";

/** Datos del último gasto listos para precargar el paso "Gasto directo". */
export interface UltimoGastoUI {
  descripcion: string;
  categoriaId: number | null;
  categoriaNombre: string | null;
  /** Monto en la MONEDA DE LA CUENTA (el wizard carga el monto en esa moneda). */
  monto: number;
}

/**
 * Datos del gasto MÁS RECIENTE con esa descripción exacta, para autocompletar
 * Categoría y Monto del Gasto Directo cuando el usuario **elige una sugerencia**
 * (nunca al tipear).
 *
 * El monto se guarda en `gasto.monto` en la MONEDA PREDETERMINADA del usuario,
 * así que acá se devuelve convertido a la moneda de la cuenta indicada: el paso
 * "Gasto directo" carga el monto en la moneda de la cuenta. Sin cuenta (todavía
 * no elegida) se devuelve en la predeterminada.
 */
export async function ultimoGastoPorDescripcionAction(input: {
  descripcion: string;
  idCuenta?: number;
}): Promise<UltimoGastoUI | null> {
  const descripcion = input.descripcion?.trim();
  if (!descripcion) return null;
  const gasto = await getUltimoGastoPorDescripcion(descripcion);
  if (!gasto) return null;
  const monto = input.idCuenta
    ? await montoPredeterminadaEnMonedaCuenta(
        input.idCuenta,
        gasto.monto,
        new Date()
      )
    : gasto.monto;
  return {
    descripcion: gasto.descripcion,
    categoriaId: gasto.categoriaId,
    categoriaNombre: gasto.categoriaNombre,
    monto,
  };
}
