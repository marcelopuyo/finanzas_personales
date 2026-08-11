"use server";

import { z } from "zod";
import { getDb } from "../db";
import { requireAdmin } from "../lib/auth";
import { refresh } from "../lib/action-helpers";
import { refrescarCotizacion, getTasa } from "../lib/cotizaciones";
import { Moneda } from "../entities/moneda.entity";

const refrescarSchema = z.object({
  monedaOrigenId: z.number().int().positive(),
  monedaDestinoId: z.number().int().positive(),
});

/**
 * Cierra la cotización vigente del par y re-consulta a la API para refrescar
 * su valor (solo administradores). Devuelve la nueva tasa.
 */
export async function refrescarCotizacionAdmin(
  input: z.infer<typeof refrescarSchema>
) {
  await requireAdmin();
  const data = refrescarSchema.parse(input);
  if (data.monedaOrigenId === data.monedaDestinoId) {
    throw new Error("Las monedas origen y destino deben ser distintas");
  }
  const tasa = await refrescarCotizacion(
    data.monedaOrigenId,
    data.monedaDestinoId
  );
  refresh();
  return { ok: true, tasa };
}

const convertirSchema = z.object({
  monto: z.number(),
  origenCodigoISO: z.string().min(1),
  destinoCodigoISO: z.string().min(1),
});

/**
 * Convierte un monto entre 2 monedas por su código ISO (usa la cotización del
 * día). Lo usa la UI de movimientos para autocompletar montos en
 * transferencias entre cuentas de distinta moneda.
 */
export async function convertirMontoParaUI(
  input: z.infer<typeof convertirSchema>
) {
  const data = convertirSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Moneda);
  const origen = await repo.findOneBy({
    codigoISO: data.origenCodigoISO,
    eliminado: false,
  });
  const destino = await repo.findOneBy({
    codigoISO: data.destinoCodigoISO,
    eliminado: false,
  });
  if (!origen || !destino) {
    throw new Error("Moneda origen/destino no encontrada");
  }
  if (origen.id === destino.id) {
    return { tasa: 1, monto: data.monto };
  }
  const tasa = await getTasa(origen, destino, new Date());
  return { tasa, monto: Math.round(data.monto * tasa * 100) / 100 };
}
