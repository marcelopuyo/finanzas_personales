"use server";

import { randomUUID } from "crypto";
import { EntityManager, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Concepto } from "../entities/concepto.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Gasto } from "../entities/gasto.entity";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { PeriodoGasto } from "../entities/periodo-gasto.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { Prestamo } from "../entities/prestamo.entity";
import { crearHistoricoCuenta, dbError, refresh } from "../lib/action-helpers";
import { calcularMontoACobrar, calcularMontoJornada } from "../lib/jornadas";
import { montoEnMonedaPredeterminada } from "../lib/cotizaciones";
import {
  jornadaStepperSchema,
  movimiento1Schema,
  movimiento2Schema,
  movimiento3Schema,
} from "../validation/movimientos";

// ---------------------------------------------------------------------------

/** Busca el período de gasto cuyo rango (fechaApertura..fechaCierre) contiene la fecha dada. */
async function findPeriodoGastoPorFecha(
  manager: EntityManager,
  fecha: string,
  userId: number
) {
  const repo = manager.getRepository(PeriodoGasto);
  const d = new Date(fecha);
  const periodo = await repo.findOne({
    where: {
      usuario: { id: userId },
      eliminado: false,
      fechaApertura: LessThanOrEqual(d),
      fechaCierre: MoreThanOrEqual(d),
    },
  });
  if (!periodo) throw new Error(`No se encontró un período de gasto para la fecha ${fecha}`);
  return periodo;
}

async function findCategoriaGasto(manager: EntityManager, id: number, userId: number) {
  const repo = manager.getRepository(CategoriaGasto);
  const cat = await repo.findOne({ where: { id, usuario: { id: userId } } });
  if (!cat) throw new Error(`Categoría de gasto con id ${id} no encontrada`);
  return cat;
}

async function buscarConceptosTransferencia(manager: EntityManager, motivo: string) {
  const repo = manager.getRepository(Concepto);
  const pares: Record<string, [string, string]> = {
    Transferencia: ["Transferencia Ingreso", "Transferencia Egreso"],
    "Compra Dolares": ["Compra Dolares Ingreso", "Compra Dolares Egreso"],
    "Venta Dolares": ["Venta Dolares Ingreso", "Venta Dolares Egreso"],
    Deposito: ["Deposito Ingreso", "Deposito Egreso"],
    Extraccion: ["Extraccion Ingreso", "Extraccion Egreso"],
  };
  const [nombreIngreso, nombreEgreso] = pares[motivo] ?? ["", ""];

  const conceptoIngreso = await repo.findOneBy({ nombre: nombreIngreso });
  if (!conceptoIngreso) throw new Error(`Concepto "${nombreIngreso}" no encontrado`);

  const conceptoEgreso = await repo.findOneBy({ nombre: nombreEgreso });
  if (!conceptoEgreso) throw new Error(`Concepto "${nombreEgreso}" no encontrado`);

  return { conceptoIngreso, conceptoEgreso };
}

// ============================================================
// 1) COBRO SUELDO
// ============================================================
export async function cobrarSueldo(input: z.infer<typeof movimiento1Schema>) {
  const userId = await requireUserId();
  const data = movimiento1Schema.parse(input);
  if (!data.idPeriodoTrabajo) throw new Error("idPeriodoTrabajo es requerido");

  // Conversión a la moneda predeterminada del usuario (fuera del tx).
  const montoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuenta,
    data.monto,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);
    const movRepo = manager.getRepository(Movimiento);

    const cuenta = await cuentaRepo.findOneBy({
      id: data.idCuenta,
      usuario: { id: userId },
    });
    if (!cuenta) throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);

    const concepto = await conceptoRepo.findOneBy({ nombre: "Cobro Sueldo" });
    if (!concepto) throw new Error("Concepto 'Cobro Sueldo' no encontrado");

    const periodoTrabajo = await periodoTrabajoRepo.findOne({
      where: { id: data.idPeriodoTrabajo, trabajo: { usuario: { id: userId } } },
    });
    if (!periodoTrabajo) throw new Error(`PeriodoTrabajo con id ${data.idPeriodoTrabajo} no encontrado`);

    cuenta.saldo += data.monto;
    await cuentaRepo.save(cuenta);

    // La fecha de cobro debe coincidir con la del movimiento (data.fecha).
    // Antes se usaba `new Date()` (ahora del servidor) y podía diferir ±1 día
    // de la fecha ingresada en el formulario (política de fechas 2026-08-05).
    periodoTrabajo.fechaDeCobro = data.fecha as unknown as Date;
    await periodoTrabajoRepo.save(periodoTrabajo);

    const mov = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoPredeterminada,
        montoCuentaMonedaOrigen: data.monto,
        cuenta,
        concepto,
        // Vínculo al período cobrado: permite revertir el cobro limpiando el
        // fechaDeCobro del período exacto.
        periodoTrabajo,
      })
    );

    await crearHistoricoCuenta(manager, cuenta, mov.id);
  });

  refresh();
  return true;
}

// ============================================================
// 2) PAGO PRÉSTAMO
// ============================================================
export async function pagarPrestamo(input: z.infer<typeof movimiento1Schema>) {
  const userId = await requireUserId();
  const data = movimiento1Schema.parse(input);
  if (!data.idPrestamo) throw new Error("idPrestamo es requerido");

  // Conversión a la moneda predeterminada del usuario (fuera del tx).
  const montoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuenta,
    data.monto,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const prestamoRepo = manager.getRepository(Prestamo);
    const movRepo = manager.getRepository(Movimiento);

    const prestamo = await prestamoRepo.findOneBy({
      id: data.idPrestamo,
      usuario: { id: userId },
    });
    if (!prestamo) throw new Error(`Préstamo con id ${data.idPrestamo} no encontrado`);

    const concepto = await conceptoRepo.findOneBy({
      nombre: prestamo.sentido === "otorgado" ? "Cobro Prestamo" : "Pago Prestamo",
    });
    if (!concepto) throw new Error("Concepto de préstamo no encontrado");

    const cuenta = await cuentaRepo.findOneBy({
      id: data.idCuenta,
      usuario: { id: userId },
    });
    if (!cuenta) throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);

    // Actualizar saldo de la cuenta
    cuenta.saldo =
      prestamo.sentido === "otorgado"
        ? cuenta.saldo + data.monto
        : cuenta.saldo - data.monto;
    await cuentaRepo.save(cuenta);

    // Actualizar saldo del préstamo
    prestamo.saldo -= data.monto;
    await prestamoRepo.save(prestamo);

    const mov = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoPredeterminada,
        montoCuentaMonedaOrigen: data.monto,
        cuenta,
        prestamo,
        concepto,
      })
    );

    await crearHistoricoCuenta(manager, cuenta, mov.id);
  });

  refresh();
  return true;
}

// ============================================================
// 3) AJUSTE CUENTA
// 3) AJUSTE CUENTA
// ============================================================
export async function ajustarCuenta(input: z.infer<typeof movimiento1Schema>) {
  const userId = await requireUserId();
  const data = movimiento1Schema.parse(input);

  // Conversión a la moneda predeterminada del usuario (fuera del tx).
  const montoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuenta,
    data.monto,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const movRepo = manager.getRepository(Movimiento);

    const cuenta = await cuentaRepo.findOneBy({
      id: data.idCuenta,
      usuario: { id: userId },
    });
    if (!cuenta) throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);

    const concepto = await conceptoRepo.findOneBy({
      nombre: data.monto > 0 ? "Ajuste Ingreso" : "Ajuste Egreso",
    });
    if (!concepto) throw new Error("Concepto de ajuste no encontrado");

    cuenta.saldo += data.monto;
    await cuentaRepo.save(cuenta);

    const mov = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoPredeterminada,
        montoCuentaMonedaOrigen: data.monto,
        cuenta,
        concepto,
      })
    );

    await crearHistoricoCuenta(manager, cuenta, mov.id);
  });

  refresh();
  return true;
}

// ============================================================
// 4) PAGO GASTO
// ============================================================
export async function pagarGasto(input: z.infer<typeof movimiento1Schema>) {
  const userId = await requireUserId();
  const data = movimiento1Schema.parse(input);
  if (!data.idGasto) throw new Error("idGasto es requerido");

  // Conversión a la moneda predeterminada del usuario (fuera del tx).
  const montoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuenta,
    data.monto,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const gastoRepo = manager.getRepository(Gasto);
    const movRepo = manager.getRepository(Movimiento);

    const cuenta = await cuentaRepo.findOneBy({
      id: data.idCuenta,
      usuario: { id: userId },
    });
    if (!cuenta) throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);

    const gasto = await gastoRepo.findOneBy({
      id: data.idGasto,
      usuario: { id: userId },
    });
    if (!gasto) throw new Error(`Gasto con id ${data.idGasto} no encontrado`);

    const concepto = await conceptoRepo.findOneBy({ nombre: "Pago Gasto" });
    if (!concepto) throw new Error("Concepto 'Pago Gasto' no encontrado");

    cuenta.saldo -= data.monto;
    await cuentaRepo.save(cuenta);

    // `gasto.saldo` está en la moneda predeterminada (convertido al crearse),
    // por lo que el pago se resta ya convertido a esa moneda.
    gasto.saldo -= montoPredeterminada;
    gasto.fechaPago = data.fecha as unknown as Date;
    await gastoRepo.save(gasto);

    const mov = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoPredeterminada,
        montoCuentaMonedaOrigen: data.monto,
        cuenta,
        gasto,
        concepto,
      })
    );

    await crearHistoricoCuenta(manager, cuenta, mov.id);
  });

  refresh();
  return true;
}

// ============================================================
// 5) GASTO DIRECTO (crea gasto y lo paga en un solo paso)
// ============================================================
export async function gastoDirecto(input: z.infer<typeof movimiento3Schema>) {
  const userId = await requireUserId();
  const data = movimiento3Schema.parse(input);

  // Conversión a la moneda predeterminada del usuario (fuera del tx).
  const montoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuenta,
    data.monto,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const periodoRepo = manager.getRepository(PeriodoGasto);
    const categoriaRepo = manager.getRepository(CategoriaGasto);
    const gastoRepo = manager.getRepository(Gasto);
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const movRepo = manager.getRepository(Movimiento);

    // 1. Crear el gasto — el período se resuelve por la FECHA ingresada (no por
    //    el período actual), para que el gasto quede en el mes que corresponde.
    const periodo = await findPeriodoGastoPorFecha(manager, data.fecha, userId);
    const categoria = await findCategoriaGasto(manager, data.idCategoriaGasto, userId);

    const nuevoGasto = await gastoRepo.save(
      gastoRepo.create({
        descripcion: data.descripcion,
        // `monto`/`saldo` se guardan en la MONEDA PREDETERMINADA del usuario
        // (convertidos), igual que `movimiento.monto`: el dashboard suma estos
        // montos y los formatea con la moneda predeterminada.
        monto: montoPredeterminada,
        saldo: montoPredeterminada,
        fechaVencimiento: data.fecha as unknown as Date,
        periodo,
        categoria,
        usuario: { id: userId },
      })
    );

    // 2. Pagar el gasto
    const cuenta = await cuentaRepo.findOneBy({
      id: data.idCuenta,
      usuario: { id: userId },
    });
    if (!cuenta) throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);

    const concepto = await conceptoRepo.findOneBy({ nombre: "Pago Gasto" });
    if (!concepto) throw new Error("Concepto 'Pago Gasto' no encontrado");

    cuenta.saldo -= data.monto;
    await cuentaRepo.save(cuenta);

    nuevoGasto.saldo = 0;
    nuevoGasto.fechaPago = data.fecha as unknown as Date;
    await gastoRepo.save(nuevoGasto);

    const mov = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoPredeterminada,
        montoCuentaMonedaOrigen: data.monto,
        cuenta,
        gasto: nuevoGasto,
        concepto,
      })
    );

    await crearHistoricoCuenta(manager, cuenta, mov.id);
  });

  refresh();
  return true;
}

// ============================================================
// 6) TRANSFERENCIA
// ============================================================
export async function transferir(input: z.infer<typeof movimiento2Schema>) {
  const userId = await requireUserId();
  const data = movimiento2Schema.parse(input);
  if (!data.idCuentaOrigen || !data.idCuentaDestino)
    throw new Error("idCuentaOrigen e idCuentaDestino son requeridos");
  if (!data.montoOrigen || !data.montoDestino)
    throw new Error("montoOrigen y montoDestino son requeridos");

  // Conversión de cada pierna a la moneda predeterminada (fuera del tx).
  const montoOrigenPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuentaOrigen,
    data.montoOrigen,
    new Date(data.fecha)
  );
  const montoDestinoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuentaDestino,
    data.montoDestino,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const cuentaRepo = manager.getRepository(Cuenta);
    const movRepo = manager.getRepository(Movimiento);

    const cuentaOrigen = await cuentaRepo.findOneBy({
      id: data.idCuentaOrigen,
      usuario: { id: userId },
    });
    if (!cuentaOrigen) throw new Error(`Cuenta origen con id ${data.idCuentaOrigen} no encontrada`);

    const cuentaDestino = await cuentaRepo.findOneBy({
      id: data.idCuentaDestino,
      usuario: { id: userId },
    });
    if (!cuentaDestino) throw new Error(`Cuenta destino con id ${data.idCuentaDestino} no encontrada`);

    const { conceptoIngreso, conceptoEgreso } = await buscarConceptosTransferencia(
      manager,
      data.motivo
    );

    cuentaOrigen.saldo -= data.montoOrigen!;
    cuentaDestino.saldo += data.montoDestino!;
    await cuentaRepo.save(cuentaOrigen);
    await cuentaRepo.save(cuentaDestino);

    // Grupo compartido: vincula los 2 movimientos de la transferencia para
    // poder revertirlos juntos (y solo juntos) desde el histórico.
    const grupoId = randomUUID();

    const movOrig = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: -montoOrigenPredeterminada,
        montoCuentaMonedaOrigen: -(data.montoOrigen!),
        cuenta: cuentaOrigen,
        concepto: conceptoEgreso,
        grupoId,
      })
    );

    const movDest = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoDestinoPredeterminada,
        montoCuentaMonedaOrigen: data.montoDestino!,
        cuenta: cuentaDestino,
        concepto: conceptoIngreso,
        grupoId,
      })
    );

    await crearHistoricoCuenta(manager, cuentaOrigen, movOrig.id);
    await crearHistoricoCuenta(manager, cuentaDestino, movDest.id);
  });

  refresh();
  return true;
}

// ============================================================
// 7) JORNADA DE TRABAJO desde el wizard + depósito de propina
// ============================================================
export async function cargarJornadaTrabajo(
  input: z.infer<typeof jornadaStepperSchema>
) {
  const userId = await requireUserId();
  const data = jornadaStepperSchema.parse(input);
  if (data.montoPropina && data.montoPropina > 0 && !data.idCuenta) {
    throw new Error("Seleccioná la cuenta para depositar la propina");
  }

  // Conversión de la propina a la moneda predeterminada (fuera del tx).
  const propina = data.montoPropina ?? 0;
  const propinaPredeterminada =
    propina > 0 && data.idCuenta
      ? await montoEnMonedaPredeterminada(
          data.idCuenta,
          propina,
          new Date(data.fecha)
        )
      : propina;

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const jornadaRepo = manager.getRepository(JornadaTrabajo);
    const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const movRepo = manager.getRepository(Movimiento);

    const periodo = await periodoTrabajoRepo.findOne({
      where: { id: data.idPeriodo, trabajo: { usuario: { id: userId } } },
      relations: { trabajo: true },
    });
    if (!periodo) {
      throw new Error(
        `Período de trabajo con id ${data.idPeriodo} no encontrado`
      );
    }

    // 1. Crear la jornada (misma lógica que crearJornadaTrabajo del CRUD).
    const montoJornada = calcularMontoJornada(
      data.horaDesde,
      data.horaHasta,
      periodo.trabajo.precioHora
    );
    const jornada = await jornadaRepo.save(
      jornadaRepo.create({
        fechaJornada: data.fecha as unknown as Date,
        fechaCarga: new Date(),
        horaDesde: data.horaDesde,
        horaHasta: data.horaHasta,
        montoJornada,
        montoPropina: data.montoPropina ?? 0,
        periodoTrabajo: periodo,
      })
    );

    // 2. Recalcular el monto a cobrar del período (SIN propina).
    const periodoActualizado = await periodoTrabajoRepo.findOne({
      where: { id: data.idPeriodo },
      relations: { jornadas: true },
    });
    if (periodoActualizado) {
      periodoActualizado.montoACobrar = calcularMontoACobrar(
        periodoActualizado.jornadas ?? []
      );
      await periodoTrabajoRepo.save(periodoActualizado);
    }

    // 3. Si hay propina, depositarla en la cuenta seleccionada.
    if (propina > 0 && data.idCuenta) {
      const cuenta = await cuentaRepo.findOneBy({
        id: data.idCuenta,
        usuario: { id: userId },
      });
      if (!cuenta) {
        throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);
      }
      const concepto = await conceptoRepo.findOneBy({
        nombre: "Cobro Propina",
      });
      if (!concepto) {
        throw new Error("Concepto 'Cobro Propina' no encontrado");
      }

      cuenta.saldo += propina;
      await cuentaRepo.save(cuenta);

      const mov = await movRepo.save(
        movRepo.create({
          fecha: data.fecha,
          monto: propinaPredeterminada,
          montoCuentaMonedaOrigen: propina,
          cuenta,
          concepto,
          // Vínculo a la jornada: al borrar la jornada (eliminarJornadaTrabajo)
          // se localiza este movimiento para revertir el depósito.
          jornadaTrabajo: jornada,
        })
      );
      await crearHistoricoCuenta(manager, cuenta, mov.id);
    }
  });

  refresh();
  return true;
}
