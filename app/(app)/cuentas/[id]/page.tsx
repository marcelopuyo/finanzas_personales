import { getCuentaById } from "@/backend/src/queries/maestros";
import { getHistorialMovimientosCuentaPaginado } from "@/backend/src/queries/movimientos";
import { getSessionUser } from "@/backend/src/lib/auth";
import { MovimientosCuentaClient } from "./movimientos-client";

/** Filas de la primera tanda (las siguientes las pide el scroll infinito). */
const PRIMERA_PAGINA = 20;

/**
 * Pantalla de movimientos de una cuenta (`/cuentas/[id]`).
 *
 * Se entra desde la tarjeta de una cuenta del dashboard y muestra **lo mismo que
 * mostraba el popup** (2026-09-20): nombre y saldo arriba, el historial
 * cronológico de movimientos y la eliminación de un movimiento con confirmación.
 * **No expone ninguna acción sobre la cuenta**: por eso vive en `/cuentas/[id]` y
 * no bajo `/cruds/`, que es la zona CRUD.
 *
 * El server resuelve la cuenta y la **primera tanda** de movimientos (así la
 * pantalla abre con datos, sin spinner); las siguientes las pide el cliente con
 * `getHistorialMovimientosCuentaPaginaAction`.
 */
export default async function CuentaMovimientosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cuentaId = Number(id);

  const [cuenta, sessionUser] = await Promise.all([
    Number.isFinite(cuentaId) ? getCuentaById(cuentaId) : null,
    getSessionUser(),
  ]);

  if (!cuenta) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-danger">Cuenta no encontrada</p>
      </div>
    );
  }

  const primeraPagina = await getHistorialMovimientosCuentaPaginado(cuenta.id, {
    offset: 0,
    limit: PRIMERA_PAGINA,
  });

  return (
    <MovimientosCuentaClient
      cuenta={{
        id: cuenta.id,
        nombre: cuenta.nombre,
        saldo: cuenta.saldo,
        monedaISO: cuenta.moneda?.codigoISO ?? "ARS",
      }}
      primeraPagina={primeraPagina}
      monedaPredeterminadaISO={
        sessionUser?.monedaPredeterminada?.codigoISO ?? "USD"
      }
    />
  );
}
