"use server";

import { randomUUID } from "crypto";
import { type EntityManager, In, IsNull, type Repository } from "typeorm";
import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Concepto } from "../entities/concepto.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Gasto } from "../entities/gasto.entity";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { Liquidacion } from "../entities/periodo-trabajo.entity";
import { Prestamo } from "../entities/prestamo.entity";
import { TareaTrabajo } from "../entities/tarea-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";
import { crearHistoricoCuenta, refresh } from "../lib/action-helpers";
import {
  calcularMontoJornada,
  encontrarJornadaSuperpuesta,
  etiquetaModalidad,
  formatearFechaDMA,
  formatearHora,
  modalidadAdmiteJornadas,
  modalidadAdmiteTareas,
} from "../lib/jornadas";
import { montoEnMonedaPredeterminada } from "../lib/cotizaciones";
import { motivoTransferenciaFinal } from "../../../lib/motivos-transferencia";
import {
  cobrarTrabajoSchema,
  editarJornadaSchema,
  editarTareaSchema,
  jornadaStepperSchema,
  movimiento1Schema,
  movimiento2Schema,
  movimiento3Schema,
  tareaStepperSchema,
} from "../validation/movimientos";

// ---------------------------------------------------------------------------

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
  // Un motivo personalizado (texto libre) no tiene par propio ⇒ se usa el
  // GENÉRICO: el concepto sólo aporta la categoría (el signo); el texto del
  // motivo vive en `movimiento.motivo`.
  const [nombreIngreso, nombreEgreso] =
    pares[motivo] ?? ["Transferencia Ingreso", "Transferencia Egreso"];

  const conceptoIngreso = await repo.findOneBy({ nombre: nombreIngreso });
  if (!conceptoIngreso) throw new Error(`Concepto "${nombreIngreso}" no encontrado`);

  const conceptoEgreso = await repo.findOneBy({ nombre: nombreEgreso });
  if (!conceptoEgreso) throw new Error(`Concepto "${nombreEgreso}" no encontrado`);

  return { conceptoIngreso, conceptoEgreso };
}

// ============================================================
// 1) **COBRAR TRABAJO** — crea la LIQUIDACIÓN + el movimiento
// ============================================================
/**
 * Plan-liquidaciones.md: el cobro **declara o selecciona** y crea la liquidación
 * (que nace y queda cerrada) junto con el movimiento, todo en una transacción.
 *
 * - `fijo`         → el usuario declara rango + monto ⇒ `calculado = cobrado`.
 * - `horas_fijas`  → declara rango + horas ⇒ `calculado = horas × precio` (snapshot).
 * - `horas_variables` / `por_tarea` → **selecciona jornadas/tareas pendientes**:
 *   el rango se deriva (min/max de sus fechas) y `calculado = Σ` de sus montos.
 *
 * Los ítems pasan a "liquidados" (se les asigna el período) y `montoCobrado` es el
 * **mismo número** que `movimiento.montoCuentaMonedaOrigen` (nominal, no el convertido).
 */
export async function cobrarTrabajo(input: z.infer<typeof cobrarTrabajoSchema>) {
  const userId = await requireUserId();
  const data = cobrarTrabajoSchema.parse(input);

  // Conversión a la moneda predeterminada (fuera del tx).
  const montoPredeterminada = await montoEnMonedaPredeterminada(
    data.idCuenta,
    data.monto,
    new Date(data.fecha)
  );

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const jornadaRepo = manager.getRepository(JornadaTrabajo);
    const tareaRepo = manager.getRepository(TareaTrabajo);
    const liqRepo = manager.getRepository(Liquidacion);
    const movRepo = manager.getRepository(Movimiento);

    const cuenta = await cuentaRepo.findOneBy({
      id: data.idCuenta,
      usuario: { id: userId },
    });
    if (!cuenta) throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);

    const concepto = await conceptoRepo.findOneBy({ nombre: "Cobro Sueldo" });
    if (!concepto) throw new Error("Concepto 'Cobro Sueldo' no encontrado");

    const trabajo = await manager.getRepository(Trabajo).findOneBy({
      id: data.idTrabajo,
      usuario: { id: userId },
    });
    if (!trabajo) {
      throw new Error(`Trabajo con id ${data.idTrabajo} no encontrado`);
    }
    const modalidad = trabajo.modalidadCobro ?? "horas_variables";
    // Las modalidades que liquidan ÍTEMS son `horas_variables` (jornadas) y
    // `por_tarea` (tareas); `fijo`/`horas_fijas` declaran el período.
    const admiteItems =
      modalidad === "horas_variables" || modalidad === "por_tarea";

    // --- Ítems pendientes SELECCIONADOS (deben ser del trabajo y estar libres) ---
    const jornadas = data.idsJornadas.length
      ? await jornadaRepo.find({
          where: {
            id: In(data.idsJornadas),
            trabajo: { id: trabajo.id },
            eliminado: false,
            periodoTrabajo: IsNull(),
          },
        })
      : [];
    if (jornadas.length !== data.idsJornadas.length) {
      throw new Error(
        "Alguna jornada seleccionada no está pendiente o no pertenece a este trabajo"
      );
    }
    const tareas = data.idsTareas.length
      ? await tareaRepo.find({
          where: {
            id: In(data.idsTareas),
            trabajo: { id: trabajo.id },
            eliminado: false,
            periodoTrabajo: IsNull(),
          },
        })
      : [];
    if (tareas.length !== data.idsTareas.length) {
      throw new Error(
        "Alguna tarea seleccionada no está pendiente o no pertenece a este trabajo"
      );
    }

    // GUARD (2026-09-26): un cobro de `horas_variables`/`por_tarea` **exige ítems
    // seleccionados** — no se puede cargar el pago sin jornadas/tareas. La UI ya
    // deja "Siguiente" deshabilitado, pero el guard tiene que estar acá también
    // (un POST directo o un cliente viejo no pueden saltearlo). Y al revés: las
    // modalidades declaradas **no liquidan ítems**, así que no deben recibirlos.
    const itemsSeleccionados = jornadas.length + tareas.length;
    if (admiteItems && itemsSeleccionados === 0) {
      throw new Error(
        "Seleccioná al menos una jornada o tarea para cobrar"
      );
    }
    if (!admiteItems && itemsSeleccionados > 0) {
      throw new Error(
        "Esta modalidad no liquida jornadas ni tareas: el cobro va sin ítems"
      );
    }

    // --- Rango + monto CALCULADO, según modalidad ---
    let fechaDesde = data.fechaDesde ?? "";
    let fechaHasta = data.fechaHasta ?? "";
    let montoCalculado = 0;
    let horasPeriodo: number | undefined;
    let precioHoraPeriodo: number | undefined;

    if (modalidad === "fijo") {
      if (!fechaDesde || !fechaHasta) {
        throw new Error("Declará el rango del período");
      }
      // En `fijo` no hay cálculo: el calculado se copia del cobrado.
      montoCalculado = data.monto;
    } else if (modalidad === "horas_fijas") {
      if (!fechaDesde || !fechaHasta) {
        throw new Error("Declará el rango del período");
      }
      horasPeriodo = data.horasPeriodo ?? 0;
      precioHoraPeriodo = trabajo.precioHora;
      montoCalculado = Number((horasPeriodo * precioHoraPeriodo).toFixed(2));
    } else {
      const fechas = [
        ...jornadas.map((j) => String(j.fechaJornada).slice(0, 10)),
        ...tareas.map((t) => String(t.fechaTarea).slice(0, 10)),
      ].sort();
      // (El guard de arriba ya garantiza que hay al menos un ítem.)
      fechaDesde = fechas[0];
      fechaHasta = fechas[fechas.length - 1];
      const totalJornadas = jornadas.reduce(
        (s, j) => s + (j.montoJornada ?? 0),
        0
      );
      const totalTareas = tareas.reduce((s, t) => s + (t.montoTarea ?? 0), 0);
      montoCalculado = Number((totalJornadas + totalTareas).toFixed(2));
    }

    // --- La liquidación nace y queda CERRADA en este acto ---
    const liquidacion = await liqRepo.save(
      liqRepo.create({
        fechaDesde: fechaDesde as unknown as Date,
        fechaHasta: fechaHasta as unknown as Date,
        montoCalculado,
        montoCobrado: data.monto,
        fechaDeCobro: data.fecha as unknown as Date,
        horasPeriodo,
        precioHoraPeriodo,
        trabajo,
      })
    );

    // --- Los ítems quedan liquidados (dejan de estar pendientes) ---
    for (const jornada of jornadas) {
      jornada.periodoTrabajo = liquidacion;
      await jornadaRepo.save(jornada);
    }
    for (const tarea of tareas) {
      tarea.periodoTrabajo = liquidacion;
      await tareaRepo.save(tarea);
    }

    // --- Plata: el saldo se acredita y el movimiento lleva el MISMO número ---
    cuenta.saldo += data.monto;
    await cuentaRepo.save(cuenta);

    const mov = await movRepo.save(
      movRepo.create({
        fecha: data.fecha,
        monto: montoPredeterminada,
        montoCuentaMonedaOrigen: data.monto,
        cuenta,
        concepto,
        // Vínculo a la liquidación: al anular se liberan los ítems (D4).
        periodoTrabajo: liquidacion,
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
    const gastoRepo = manager.getRepository(Gasto);
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const movRepo = manager.getRepository(Movimiento);

    // 1. Crear el gasto (ya no tiene período: el dashboard agrupa por fecha de
    //    pago). Se resuelve solo la categoría.
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
  // Texto normalizado (preset o motivo propio): se guarda en los 2 movimientos.
  // Los **presets** se guardan tal cual y los **motivos escritos a mano** con el
  // prefijo `Transf - ` (helper idempotente, el mismo que usa la UI al mostrar).
  const motivo = motivoTransferenciaFinal(data.motivo);
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
        motivo,
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
        motivo,
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
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);
    const movRepo = manager.getRepository(Movimiento);

    // El **trabajo** es el único vínculo: la jornada nace **pendiente de
    // liquidar** (`periodoTrabajoId = NULL`) y se le asigna una liquidación
    // recién al cobrar (plan-liquidaciones.md). Ya no hay período que elegir,
    // ni "período automático", ni validaciones de superposición.
    const trabajo = await manager.getRepository(Trabajo).findOneBy({
      id: data.idTrabajo,
      usuario: { id: userId },
    });
    if (!trabajo) {
      throw new Error(`Trabajo con id ${data.idTrabajo} no encontrado`);
    }
    if (!modalidadAdmiteJornadas(trabajo.modalidadCobro ?? "horas_variables")) {
      throw new Error(
        `El trabajo "${trabajo.nombre}" no admite jornadas (modalidad ${etiquetaModalidad(
          trabajo.modalidadCobro ?? "horas_variables"
        )})`
      );
    }
    // La jornada no puede ser anterior al inicio del trabajo.
    if (
      String(data.fecha).slice(0, 10) < String(trabajo.fechaInicio).slice(0, 10)
    ) {
      throw new Error(
        `La fecha de la jornada (${formatearFechaDMA(data.fecha)}) es anterior al inicio del trabajo "${trabajo.nombre}" (${formatearFechaDMA(trabajo.fechaInicio)})`
      );
    }
    const trabajoIdJornada = trabajo.id;
    const nombreTrabajoJornada = trabajo.nombre;

    // No debe existir otra jornada del mismo trabajo que se superponga en el
    // mismo día y con horas solapadas.
    const jornadaSuperpuesta = await encontrarJornadaSuperpuesta(
      jornadaRepo,
      trabajoIdJornada,
      data.fecha,
      data.horaDesde,
      data.horaHasta
    );
    if (jornadaSuperpuesta) {
      throw new Error(
        `Ya existe una jornada de "${nombreTrabajoJornada}" el ${formatearFechaDMA(data.fecha)} de ${formatearHora(jornadaSuperpuesta.horaDesde)} a ${formatearHora(jornadaSuperpuesta.horaHasta)} (horas superpuestas)`
      );
    }

    // Crear la jornada: **sin período** (queda pendiente de liquidar).
    const montoJornada = calcularMontoJornada(
      data.horaDesde,
      data.horaHasta,
      trabajo.precioHora
    );
    const jornada = await jornadaRepo.save(
      jornadaRepo.create({
        fechaJornada: data.fecha as unknown as Date,
        fechaCarga: new Date(),
        horaDesde: data.horaDesde,
        horaHasta: data.horaHasta,
        montoJornada,
        montoPropina: data.montoPropina ?? 0,
        // Snapshot del precio por hora al momento de la carga (se usa al editar).
        precioHora: trabajo.precioHora,
        // Vínculo directo al trabajo: el ítem nace **pendiente** (sin período).
        trabajo,
      })
    );

    // Si hay propina, depositarla en la cuenta seleccionada.
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

// ============================================================
// 6) CARGAR TAREA (wizard — modalidad 'por_tarea', SIN depósito)
// ============================================================
export async function cargarTareaTrabajo(
  input: z.infer<typeof tareaStepperSchema>
) {
  // A diferencia de la jornada NO hay propina ni depósito a cuenta: la tarea
  // sólo registra el monto ganado. Nace **pendiente de liquidar** (sin período)
  // y se cobra junto con la liquidación que la incluya.
  const userId = await requireUserId();
  const data = tareaStepperSchema.parse(input);

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const trabajo = await manager.getRepository(Trabajo).findOneBy({
      id: data.idTrabajo,
      usuario: { id: userId },
    });
    if (!trabajo) {
      throw new Error(`Trabajo con id ${data.idTrabajo} no encontrado`);
    }
    if (!modalidadAdmiteTareas(trabajo.modalidadCobro ?? "horas_variables")) {
      throw new Error(
        `El trabajo "${trabajo.nombre}" no admite tareas (modalidad ${etiquetaModalidad(
          trabajo.modalidadCobro ?? "horas_variables"
        )})`
      );
    }
    // La tarea no puede ser anterior al inicio del trabajo.
    if (
      String(data.fechaTarea).slice(0, 10) <
      String(trabajo.fechaInicio).slice(0, 10)
    ) {
      throw new Error(
        `La fecha de la tarea (${formatearFechaDMA(data.fechaTarea)}) es anterior al inicio del trabajo "${trabajo.nombre}" (${formatearFechaDMA(trabajo.fechaInicio)})`
      );
    }

    const tareaRepo = manager.getRepository(TareaTrabajo);
    await tareaRepo.save(
      tareaRepo.create({
        fechaCarga: new Date(),
        fechaHoraTarea: new Date(data.fechaHoraTarea),
        fechaTarea: data.fechaTarea as unknown as Date,
        descripcion: data.descripcion,
        horasTarea: data.horasTarea,
        montoTarea: data.montoTarea,
        // Vínculo directo al trabajo: la tarea nace **pendiente** (sin período).
        trabajo,
      })
    );
  });

  refresh();
  return true;
}

// ============================================================
// 9) EDITAR / ELIMINAR ítems PENDIENTES (jornadas y tareas)
// ============================================================
/**
 * Mecanismo de corrección de los ítems **pendientes** (2026-09-26): los mismos
 * ítems que lista la pantalla `/trabajo`, que dejó de tener formularios propios
 * cuando se archivaron los CRUDs de jornadas/tareas (R3/R4).
 *
 * **Regla única** (plan-liquidaciones.md): un ítem **ya liquidado está
 * CONGELADO**. La corrección de un ítem cobrado se hace **anulando el cobro**
 * (que lo libera, lo vuelve a pendiente y soft-deletea la liquidación) y
 * volviéndolo a cobrar. Por eso estas 4 acciones sólo aceptan pendientes.
 *
 * La propina es un **depósito real** en una cuenta (movimiento "Cobro Propina"):
 * al editar se **revierte el depósito anterior y se vuelve a crear** con lo que
 * quedó en el formulario (cubre cambiar monto, cambiar de cuenta o quitarla), y
 * al eliminar la jornada se **revierte** (si no, quedaría plata depositada por
 * una jornada inexistente). Mismo criterio que la rama de propina de
 * `anularMovimiento`.
 */

/** Trabajo de un ítem: su **columna propia** (`trabajoId`, vínculo del modelo
 *  nuevo) o —en los ítems viejos— el de su **período**. */
function trabajoDeItem(item: {
  trabajo?: Trabajo | null;
  periodoTrabajo?: Liquidacion | null;
}): Trabajo | null {
  return item.trabajo ?? item.periodoTrabajo?.trabajo ?? null;
}

/** Guard de "congelado": un ítem con liquidación no se edita ni se elimina. */
function exigirItemPendiente(
  item: { periodoTrabajo?: Liquidacion | null },
  que: string
) {
  if (item.periodoTrabajo) {
    throw new Error(
      `Esa ${que} ya está liquidada (cobrada): se corrige anulando el cobro y volviéndola a cobrar`
    );
  }
}

/**
 * Revierte el depósito de propina de una jornada (si lo tiene): devuelve el
 * saldo a la cuenta y **soft-deletea** su movimiento, como la rama de propina de
 * `anularMovimiento`. El histórico de la cuenta se recalcula por running-sum
 * sobre los movimientos activos, así que no hay que tocar `historico_cuenta`.
 */
async function revertirPropinaDeJornada(
  manager: EntityManager,
  movRepo: Repository<Movimiento>,
  cuentaRepo: Repository<Cuenta>,
  jornadaId: string
) {
  const mov = await movRepo.findOne({
    where: { jornadaTrabajo: { id: jornadaId }, eliminado: false },
    relations: { cuenta: true },
  });
  if (!mov?.cuenta) return;
  mov.cuenta.saldo -= mov.montoCuentaMonedaOrigen;
  await cuentaRepo.save(mov.cuenta);
  await crearHistoricoCuenta(manager, mov.cuenta);
  mov.eliminado = true;
  await movRepo.save(mov);
}

/** Trae la jornada del usuario con su trabajo (propio o el de su período). */
async function jornadaDelUsuario(manager: EntityManager, id: string, userId: number) {
  const jornada = await manager.getRepository(JornadaTrabajo).findOne({
    where: { id, eliminado: false },
    relations: {
      trabajo: { usuario: true },
      periodoTrabajo: { trabajo: { usuario: true } },
    },
  });
  const trabajo = jornada ? trabajoDeItem(jornada) : null;
  if (!jornada || !trabajo || trabajo.usuario?.id !== userId) {
    throw new Error("Jornada no encontrada");
  }
  return { jornada, trabajo };
}

/** Trae la tarea del usuario con su trabajo (propio o el de su período). */
async function tareaDelUsuario(manager: EntityManager, id: string, userId: number) {
  const tarea = await manager.getRepository(TareaTrabajo).findOne({
    where: { id, eliminado: false },
    relations: {
      trabajo: { usuario: true },
      periodoTrabajo: { trabajo: { usuario: true } },
    },
  });
  const trabajo = tarea ? trabajoDeItem(tarea) : null;
  if (!tarea || !trabajo || trabajo.usuario?.id !== userId) {
    throw new Error("Tarea no encontrada");
  }
  return { tarea, trabajo };
}

export async function actualizarJornadaTrabajo(
  id: string,
  input: z.infer<typeof editarJornadaSchema>
) {
  const userId = await requireUserId();
  const data = editarJornadaSchema.parse(input);
  if (data.horaDesde >= data.horaHasta) {
    throw new Error("La hora de fin debe ser posterior a la de inicio");
  }
  const propina = data.montoPropina ?? 0;
  if (propina > 0 && !data.idCuenta) {
    throw new Error("Seleccioná la cuenta para depositar la propina");
  }
  // Conversión a la moneda predeterminada fuera de la transacción (igual que el
  // alta): el movimiento guarda el nominal en la moneda de la cuenta.
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
    const movRepo = manager.getRepository(Movimiento);
    const cuentaRepo = manager.getRepository(Cuenta);
    const conceptoRepo = manager.getRepository(Concepto);

    const { jornada, trabajo } = await jornadaDelUsuario(manager, id, userId);
    exigirItemPendiente(jornada, "jornada");
    if (!modalidadAdmiteJornadas(trabajo.modalidadCobro ?? "horas_variables")) {
      throw new Error(
        `El trabajo "${trabajo.nombre}" no admite jornadas (modalidad ${etiquetaModalidad(
          trabajo.modalidadCobro ?? "horas_variables"
        )})`
      );
    }
    // Mismos guards del alta: fecha >= inicio del trabajo y sin solapamiento con
    // otra jornada del mismo trabajo (`excluirId` = esta misma).
    if (
      String(data.fecha).slice(0, 10) < String(trabajo.fechaInicio).slice(0, 10)
    ) {
      throw new Error(
        `La fecha de la jornada (${formatearFechaDMA(data.fecha)}) es anterior al inicio del trabajo "${trabajo.nombre}" (${formatearFechaDMA(trabajo.fechaInicio)})`
      );
    }
    const superpuesta = await encontrarJornadaSuperpuesta(
      jornadaRepo,
      trabajo.id,
      data.fecha,
      data.horaDesde,
      data.horaHasta,
      id
    );
    if (superpuesta) {
      throw new Error(
        `Ya existe una jornada de "${trabajo.nombre}" el ${formatearFechaDMA(data.fecha)} de ${formatearHora(superpuesta.horaDesde)} a ${formatearHora(superpuesta.horaHasta)} (horas superpuestas)`
      );
    }

    // El monto se recalcula con el **precio congelado** de la jornada
    // (`jornada.precioHora`, snapshot del alta): editar no re-valoriza jornadas
    // viejas con el precio actual del trabajo.
    jornada.fechaJornada = data.fecha as unknown as Date;
    jornada.horaDesde = data.horaDesde;
    jornada.horaHasta = data.horaHasta;
    jornada.montoJornada = calcularMontoJornada(
      data.horaDesde,
      data.horaHasta,
      jornada.precioHora ?? 0
    );
    jornada.montoPropina = propina;
    await jornadaRepo.save(jornada);

    // Propina: se revierte el depósito anterior y se crea de nuevo (si quedó
    // alguna) con el monto/cuenta del formulario.
    await revertirPropinaDeJornada(manager, movRepo, cuentaRepo, id);
    if (propina > 0 && data.idCuenta) {
      const cuenta = await cuentaRepo.findOneBy({
        id: data.idCuenta,
        usuario: { id: userId },
      });
      if (!cuenta) {
        throw new Error(`Cuenta con id ${data.idCuenta} no encontrada`);
      }
      const concepto = await conceptoRepo.findOneBy({ nombre: "Cobro Propina" });
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
          jornadaTrabajo: jornada,
        })
      );
      await crearHistoricoCuenta(manager, cuenta, mov.id);
    }
  });

  refresh();
  return true;
}

export async function eliminarJornadaTrabajo(id: string) {
  const userId = await requireUserId();
  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const jornadaRepo = manager.getRepository(JornadaTrabajo);
    const movRepo = manager.getRepository(Movimiento);
    const cuentaRepo = manager.getRepository(Cuenta);

    const { jornada } = await jornadaDelUsuario(manager, id, userId);
    exigirItemPendiente(jornada, "jornada");
    // La propina depositada se revierte junto con la jornada.
    await revertirPropinaDeJornada(manager, movRepo, cuentaRepo, id);
    jornada.eliminado = true;
    await jornadaRepo.save(jornada);
  });

  refresh();
  return true;
}

export async function actualizarTareaTrabajo(
  id: string,
  input: z.infer<typeof editarTareaSchema>
) {
  const userId = await requireUserId();
  const data = editarTareaSchema.parse(input);

  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const tareaRepo = manager.getRepository(TareaTrabajo);

    const { tarea, trabajo } = await tareaDelUsuario(manager, id, userId);
    exigirItemPendiente(tarea, "tarea");
    if (!modalidadAdmiteTareas(trabajo.modalidadCobro ?? "horas_variables")) {
      throw new Error(
        `El trabajo "${trabajo.nombre}" no admite tareas (modalidad ${etiquetaModalidad(
          trabajo.modalidadCobro ?? "horas_variables"
        )})`
      );
    }
    if (
      String(data.fechaTarea).slice(0, 10) <
      String(trabajo.fechaInicio).slice(0, 10)
    ) {
      throw new Error(
        `La fecha de la tarea (${formatearFechaDMA(data.fechaTarea)}) es anterior al inicio del trabajo "${trabajo.nombre}" (${formatearFechaDMA(trabajo.fechaInicio)})`
      );
    }

    // `undefined` en TypeORM significa "no tocar la columna": la descripción y
    // las horas son nullable y el usuario puede **vaciarlas**, así que se asignan
    // por una vista `string | null` (los tipos de la entidad quedaron estrechos).
    const opcionales = tarea as unknown as {
      descripcion: string | null;
      horasTarea: number | null;
    };
    opcionales.descripcion = data.descripcion?.trim() || null;
    opcionales.horasTarea = data.horasTarea ?? null;
    tarea.fechaTarea = data.fechaTarea as unknown as Date;
    tarea.fechaHoraTarea = new Date(data.fechaHoraTarea);
    tarea.montoTarea = data.montoTarea;
    await tareaRepo.save(tarea);
  });

  refresh();
  return true;
}

export async function eliminarTareaTrabajo(id: string) {
  const userId = await requireUserId();
  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const { tarea } = await tareaDelUsuario(manager, id, userId);
    exigirItemPendiente(tarea, "tarea");
    tarea.eliminado = true;
    await manager.getRepository(TareaTrabajo).save(tarea);
  });

  refresh();
  return true;
}
