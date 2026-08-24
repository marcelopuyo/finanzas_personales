"use server";

import { Not } from "typeorm";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Cuenta } from "../entities/cuenta.entity";
import { Gasto } from "../entities/gasto.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { Prestamo } from "../entities/prestamo.entity";
import { crearHistoricoCuenta, refresh } from "../lib/action-helpers";

/**
 * Anula/revierte un movimiento de la cuenta desde el histórico (cobro, pago,
 * ajuste, gasto, transferencia o propina), dejando el saldo de la cuenta y las
 * tablas relacionadas consistentes.
 *
 * El movimiento queda soft-deleteado (`eliminado=true`) y se agrega un snapshot
 * nuevo al histórico con `crearHistoricoCuenta`. El historial del popup se
 * recalcula por running-sum sobre los movimientos ACTIVOS (`eliminado=false`),
 * así la cadena de saldos queda consistente sin borrar filas de historico_cuenta
 * (que alimentan los sparklines y no pueden eliminarse).
 *
 * Reversión por tipo:
 *  - Cobro Sueldo  → revierte saldo + limpia `fechaDeCobro` del período (si hay vínculo)
 *  - Ajuste        → revierte saldo
 *  - Alta Préstamo → revierte saldo de cuenta + soft-delete del préstamo si no tiene pagos
 *  - Pago Préstamo → revierte saldo de cuenta + saldo del préstamo
 *  - Pago Gasto    → revierte saldo de cuenta + saldo/`fechaPago` del gasto
 *  - Gasto Directo → igual + soft-delete del gasto (deshace toda la operación)
 *  - Transferencia → revierte las 2 cuentas (vía `grupoId`) y anula ambos movimientos
 *  - Cobro Propina → revierte saldo
 *
 * Limitaciones (decididas): las transferencias/cobros legacy (sin grupoId /
 * periodoTrabajoId) se anulan parcialmente: la transferencia legacy NO se puede
 * anular (error) y el cobro legacy solo revierte el saldo (no limpia fechaDeCobro).
 */
export async function anularMovimiento(movimientoId: string) {
  const userId = await requireUserId();
  const ds = await getDb();

  await ds.transaction(async (manager) => {
    const movRepo = manager.getRepository(Movimiento);
    const cuentaRepo = manager.getRepository(Cuenta);
    const gastoRepo = manager.getRepository(Gasto);
    const prestamoRepo = manager.getRepository(Prestamo);
    const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);

    const mov = await movRepo.findOne({
      where: {
        id: movimientoId,
        cuenta: { usuario: { id: userId } },
        eliminado: false,
      },
      relations: {
        concepto: true,
        cuenta: true,
        prestamo: true,
        gasto: true,
        periodoTrabajo: true,
        jornadaTrabajo: true,
      },
    });
    if (!mov) throw new Error("Movimiento no encontrado o ya anulado");

    const conceptoNombre = mov.concepto?.nombre ?? "";

    // ============================================================
    // TRANSFERENCIA — revierte las 2 cuentas vía grupoId
    // ============================================================
    if (mov.grupoId) {
      const pares = await movRepo.find({
        where: { grupoId: mov.grupoId, eliminado: false },
        relations: { concepto: true, cuenta: true },
      });
      if (pares.length === 0) {
        throw new Error("No se encontraron los movimientos de la transferencia");
      }

      for (const m of pares) {
        const esEgreso = m.concepto?.categoria?.toLowerCase() === "egreso";
        // Origen (egreso): saldo -= |monto|  → revertir += |monto|
        // Destino (ingreso): saldo += |monto| → revertir -= |monto|
        // Se usa el monto en la moneda de la cuenta (montoCuentaMonedaOrigen),
        // porque `monto` quedó en la moneda predeterminada del usuario.
        m.cuenta.saldo = esEgreso
          ? m.cuenta.saldo + Math.abs(m.montoCuentaMonedaOrigen)
          : m.cuenta.saldo - Math.abs(m.montoCuentaMonedaOrigen);
        await cuentaRepo.save(m.cuenta);
        await crearHistoricoCuenta(manager, m.cuenta);
        m.eliminado = true;
        await movRepo.save(m);
      }

      // Los 2 movimientos ya se marcaron; salir sin tocar el `mov` original.
      return;
    }

    // ============================================================
    // RESTO DE TIPOS — una sola cuenta afectada
    // ============================================================
    const cuenta = mov.cuenta;

    if (mov.gasto) {
      // ---- Pago Gasto / Gasto Directo ----
      const gasto = mov.gasto;
      cuenta.saldo += mov.montoCuentaMonedaOrigen;
      // `gasto.saldo` está en la moneda predeterminada (convertido), por lo que
      // la reversión suma el monto convertido del movimiento (no el de la cuenta).
      gasto.saldo += mov.monto;

      // Recalcular fechaPago con los pagos activos restantes (excluyendo este).
      const pagosRestantes = await movRepo.find({
        where: { gasto: { id: gasto.id }, eliminado: false, id: Not(mov.id) },
      });
      gasto.fechaPago =
        pagosRestantes.length > 0
          ? pagosRestantes.reduce(
              (max, p) => (new Date(p.fecha) > new Date(max) ? p.fecha : max),
              pagosRestantes[0].fecha
            )
          : // ⚠️ TypeORM ignora `undefined` al guardar; para LIMPIAR una
            // columna nullable hay que asignar `null` explícitamente.
            (null as unknown as Date | undefined);

      // Gasto Directo: si este es el ÚNICO movimiento activo del gasto, el gasto
      // fue creado por esta operación → se deshace todo (soft-delete del gasto).
      const otrosActivos = await movRepo.count({
        where: { gasto: { id: gasto.id }, eliminado: false, id: Not(mov.id) },
      });
      if (otrosActivos === 0) {
        gasto.eliminado = true;
      }
      await gastoRepo.save(gasto);
    } else if (mov.prestamo) {
      const prestamo = mov.prestamo;
      const esAltaPrestamo =
        conceptoNombre === "Prestamo Otorgado" ||
        conceptoNombre === "Prestamo Obtenido";
      if (esAltaPrestamo) {
        // ---- Alta Préstamo ----
        // Revierte el saldo de la cuenta (inverso al alta: otorgado restó,
        // obtenido sumó). Si es el ÚNICO movimiento activo del préstamo (no
        // hay pagos), el alta es el origen del préstamo → se soft-deletea el
        // préstamo (deshace toda la operación, igual que el Gasto Directo).
        cuenta.saldo =
          prestamo.sentido === "otorgado"
            ? cuenta.saldo + mov.montoCuentaMonedaOrigen
            : cuenta.saldo - mov.montoCuentaMonedaOrigen;
        const otrosActivos = await movRepo.count({
          where: {
            prestamo: { id: prestamo.id },
            eliminado: false,
            id: Not(mov.id),
          },
        });
        if (otrosActivos === 0) {
          prestamo.eliminado = true;
        }
        await prestamoRepo.save(prestamo);
      } else {
        // ---- Pago Préstamo ----
        cuenta.saldo =
          prestamo.sentido === "otorgado"
            ? cuenta.saldo - mov.montoCuentaMonedaOrigen
            : cuenta.saldo + mov.montoCuentaMonedaOrigen;
        prestamo.saldo += mov.montoCuentaMonedaOrigen;
        await prestamoRepo.save(prestamo);
      }
    } else if (conceptoNombre === "Cobro Sueldo") {
      // ---- Cobro Sueldo ----
      cuenta.saldo -= mov.montoCuentaMonedaOrigen;
      if (mov.periodoTrabajo) {
        // Los cobros legacy (sin vínculo) no limpian fechaDeCobro (decisión).
        // ⚠️ TypeORM ignora `undefined` al guardar; `null` sí limpia la columna.
        mov.periodoTrabajo.fechaDeCobro =
          null as unknown as Date | undefined;
        await periodoTrabajoRepo.save(mov.periodoTrabajo);
      }
    } else {
      // ---- Cobro Propina / Ajuste (y cualquier otro de cuenta única) ----
      // El monto de cuenta ya tiene el signo del efecto en la cuenta, así que
      // revertir es restar exactamente lo que se sumó (moneda de la cuenta).
      cuenta.saldo -= mov.montoCuentaMonedaOrigen;
    }

    await cuentaRepo.save(cuenta);
    await crearHistoricoCuenta(manager, cuenta);

    mov.eliminado = true;
    await movRepo.save(mov);
  });

  refresh();
  return true;
}
