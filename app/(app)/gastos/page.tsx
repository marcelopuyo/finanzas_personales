import { getSessionUser } from "@/backend/src/lib/auth";
import { getGastosPaginado } from "@/backend/src/queries/gastos";
import { GastosClient } from "./gastos-client";

/** Filas de la primera tanda (las siguientes las pide el scroll infinito). */
const PRIMERA_PAGINA = 20;

/**
 * Pantalla **`/gastos`** — todos los gastos del usuario (2026-09-30).
 *
 * Se entra desde el **"Ver más gastos"** de la pestaña *Detalle* del panel
 * Gastos del dashboard (que ahora muestra tarjetas de los últimos 3 días):
 * acá está la lista completa, con **búsqueda** y **scroll infinito**.
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
