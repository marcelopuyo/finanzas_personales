import { getSessionUser } from "@/backend/src/lib/auth";
import { getGastosPaginado } from "@/backend/src/queries/gastos";
import { GastosClient } from "./gastos-client";

/** Filas de la primera tanda (las siguientes las pide el scroll infinito). */
const PRIMERA_PAGINA = 20;

/**
 * Pantalla **`/gastos`** — todos los gastos del usuario (2026-09-30).
 *
 * ⚠️ Desde el 2026-10-03 **ya no tiene punto de entrada en la UI**: la pantalla
 * Gastos del dashboard embebe esta misma lista, así que desapareció el botón
 * "Ver más gastos". La ruta sigue viva (marcadores, historial y la voz).
 *
 * El server resuelve la **primera tanda** (así la pantalla abre con datos, sin
 * spinner); las siguientes las pide el cliente con `getGastosPaginaAction`.
 */
export default async function GastosPage() {
  const [sessionUser, primeraPagina] = await Promise.all([
    getSessionUser(),
    getGastosPaginado({ offset: 0, limit: PRIMERA_PAGINA }),
  ]);

  return (
    <GastosClient
      primeraPagina={primeraPagina}
      monedaISO={sessionUser?.monedaPredeterminada?.codigoISO ?? "USD"}
    />
  );
}
