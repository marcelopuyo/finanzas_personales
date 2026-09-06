"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Concepto } from "../entities/concepto.entity";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { TareaTrabajo } from "../entities/tarea-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { crearHistoricoCuenta, dbError, refresh } from "../lib/action-helpers";
import { montoEnMonedaPredeterminada } from "../lib/cotizaciones";
import {
  getJornadaTrabajoById,
  getPeriodoTrabajoById,
  getTareaTrabajoById,
  getTrabajoById,
} from "../queries/trabajos";
import {
  calcularMontoACobrar,
  calcularMontoACobrarPorModalidad,
  calcularMontoJornada,
  calcularMontoTareas,
  encontrarJornadaSuperpuesta,
  encontrarPeriodoSuperpuesto,
  etiquetaModalidad,
  fechaEnRango,
  formatearFechaDMA,
  formatearHora,
  modalidadAdmiteJornadas,
  modalidadAdmiteTareas,
} from "../lib/jornadas";
import {
  jornadaTrabajoCreateSchema,
  jornadaTrabajoUpdateSchema,
  periodoTrabajoCreateSchema,
  periodoTrabajoUpdateSchema,
  tareaTrabajoCreateSchema,
  tareaTrabajoUpdateSchema,
  trabajoCreateSchema,
  trabajoUpdateSchema,
} from "../validation/trabajos";

// ---------------------------------------------------------------------------
// Helpers de lógica de jornadas/tareas (port del servicio JornadaTrabajoService)
// ---------------------------------------------------------------------------
async function actualizarMontoACobrarPeriodo(idPeriodo: number) {
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoTrabajo);
  const periodo = await repo.findOne({
    where: { id: idPeriodo },
    relations: { trabajo: true, jornadas: true, tareas: true },
  });
  if (!periodo) {
    throw new Error(`PeriodoTrabajo con id ${idPeriodo} no encontrado`);
  }

  // El origen del monto depende de la modalidad del trabajo (§5 del plan):
  //  - fijo: es lo cargado (se conserva).
  //  - horas_fijas: horasPeriodo × precioHoraPeriodo (snapshot).
  //  - horas_variables: suma de jornadas (SIN propina, decisión 2026-08-06).
  //  - por_tarea: suma de tareas.
  periodo.montoACobrar = calcularMontoACobrarPorModalidad({
    modalidad: periodo.trabajo?.modalidadCobro ?? "horas_variables",
    montoCargado: periodo.montoACobrar ?? 0,
    horasPeriodo: periodo.horasPeriodo,
    precioHoraPeriodo: periodo.precioHoraPeriodo,
    jornadas: periodo.jornadas ?? [],
    tareas: periodo.tareas ?? [],
  });
  await repo.save(periodo);
}

/** ¿Tiene el trabajo un período EN CURSO (no cobrado y vigente hoy)? (§3.2) */
async function periodoEnCursoDe(
  ds: Awaited<ReturnType<typeof getDb>>,
  trabajoId: number
): Promise<PeriodoTrabajo | null> {
  const hoyKey = new Date().toISOString().slice(0, 10);
  const repo = ds.getRepository(PeriodoTrabajo);
  return repo
    .createQueryBuilder("pt")
    .where("pt.trabajoId = :trabajoId", { trabajoId })
    .andWhere("pt.eliminado = :eliminado", { eliminado: false })
    // No cobrado: fechaDeCobro null o centinela (1901-01-01).
    .andWhere("(pt.fechaDeCobro IS NULL OR pt.fechaDeCobro < '1901-01-02')")
    .andWhere("pt.fechaDesde <= :hoy", { hoy: hoyKey })
    .andWhere("pt.fechaHasta >= :hoy", { hoy: hoyKey })
    .limit(1)
    .getOne();
}

// ============================================================
// TRABAJO
// ============================================================
export async function crearTrabajo(input: z.infer<typeof trabajoCreateSchema>) {
  const userId = await requireUserId();
  const data = trabajoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Trabajo);
  try {
    const created = await repo.save(
      repo.create({
        ...data,
        // Default conservador: la modalidad que hoy tienen todos los trabajos.
        modalidadCobro: data.modalidadCobro ?? "horas_variables",
        usuario: { id: userId },
      })
    );
    refresh();
    return getTrabajoById(created.id);
  } catch (error) {
    dbError(error, "Trabajo");
  }
}

export async function actualizarTrabajo(
  id: number,
  input: z.infer<typeof trabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = trabajoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Trabajo);
  const existing = await repo.findOneBy({ id, usuario: { id: userId } });
  if (!existing) {
    throw new Error(`Trabajo con id ${id} no encontrado`);
  }

  // Conversión de modalidad (§3.2): bloqueada si el trabajo tiene un período en
  // curso (no cobrado y vigente hoy). La conversión solo afecta períodos futuros.
  const modalidadActual = existing.modalidadCobro ?? "horas_variables";
  if (data.modalidadCobro && data.modalidadCobro !== modalidadActual) {
    const enCurso = await periodoEnCursoDe(ds, existing.id);
    if (enCurso) {
      throw new Error(
        `No podés cambiar la modalidad de "${existing.nombre}" porque tiene un período en curso (${formatearFechaDMA(enCurso.fechaDesde)} al ${formatearFechaDMA(enCurso.fechaHasta)}). Cerrá o cobrá ese período primero.`
      );
    }
  }

  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getTrabajoById(id);
  } catch (error) {
    dbError(error, "Trabajo");
  }
}

export async function eliminarTrabajo(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Trabajo);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Trabajo con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Trabajo");
  }
}

// ============================================================
// PERÍODO DE TRABAJO (trabajo por nombre)
// ============================================================
export async function crearPeriodoTrabajo(
  input: z.infer<typeof periodoTrabajoCreateSchema>
) {
  const userId = await requireUserId();
  const data = periodoTrabajoCreateSchema.parse(input);
  const ds = await getDb();
  const { nombreTrabajo } = data;

  const trabajo = await ds.getRepository(Trabajo).findOneBy({
    nombre: nombreTrabajo,
    usuario: { id: userId },
  });
  if (!trabajo) {
    throw new Error(`Trabajo con nombre "${nombreTrabajo}" no encontrado`);
  }

  // Validación: el nuevo período no debe superponerse con otro del mismo trabajo.
  const superpuesto = await encontrarPeriodoSuperpuesto(
    ds.getRepository(PeriodoTrabajo),
    trabajo.id,
    data.fechaDesde,
    data.fechaHasta
  );
  if (superpuesto) {
    throw new Error(
      `El período se superpone con "${formatearFechaDMA(superpuesto.fechaDesde)} al ${formatearFechaDMA(superpuesto.fechaHasta)}" del trabajo "${trabajo.nombre}"`
    );
  }

  // Origen del monto según la modalidad del trabajo (§5 del plan):
  //  - fijo        → se guarda el monto cargado junto con el período.
  //  - horas_fijas → se guardan las horas + snapshot del precio; monto = horas × precio.
  //  - horas_variables / por_tarea → montoACobrar queda 0 (llega de jornadas/tareas).
  const modalidad = trabajo.modalidadCobro ?? "horas_variables";
  let montoACobrar: number | undefined;
  let horasPeriodo: number | undefined;
  let precioHoraPeriodo: number | undefined;
  if (modalidad === "fijo") {
    if (!data.montoACobrar || data.montoACobrar <= 0) {
      throw new Error(
        `Indicá el monto del período (el trabajo "${trabajo.nombre}" es de monto fijo)`
      );
    }
    montoACobrar = data.montoACobrar;
  } else if (modalidad === "horas_fijas") {
    if (!data.horasPeriodo || data.horasPeriodo <= 0) {
      throw new Error(
        `Indicá las horas del período (el trabajo "${trabajo.nombre}" es de horas fijas)`
      );
    }
    horasPeriodo = data.horasPeriodo;
    precioHoraPeriodo = trabajo.precioHora ?? 0;
    montoACobrar = horasPeriodo * precioHoraPeriodo;
  }

  try {
    const repo = ds.getRepository(PeriodoTrabajo);
    const created = await repo.save(
      repo.create({
        fechaDesde: data.fechaDesde as unknown as Date,
        fechaHasta: data.fechaHasta as unknown as Date,
        fechaEstimadaCobro: data.fechaEstimadaCobro
          ? (data.fechaEstimadaCobro as unknown as Date)
          : undefined,
        montoACobrar,
        horasPeriodo,
        precioHoraPeriodo,
        trabajo,
      })
    );
    refresh();
    return getPeriodoTrabajoById(created.id);
  } catch (error) {
    dbError(error, "Período de trabajo");
  }
}

export async function actualizarPeriodoTrabajo(
  id: number,
  input: z.infer<typeof periodoTrabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = periodoTrabajoUpdateSchema.parse(input);
  const ds = await getDb();
  const { nombreTrabajo, ...rest } = data;

  const repo = ds.getRepository(PeriodoTrabajo);
  const existing = await repo.findOne({
    where: { id, trabajo: { usuario: { id: userId } }, eliminado: false },
    relations: { trabajo: true },
  });
  if (!existing) {
    throw new Error(`Período de trabajo con id ${id} no encontrado`);
  }

  if (nombreTrabajo) {
    const trabajo = await ds.getRepository(Trabajo).findOneBy({
      nombre: nombreTrabajo,
      usuario: { id: userId },
    });
    if (!trabajo) {
      throw new Error(`Trabajo con nombre "${nombreTrabajo}" no encontrado`);
    }
    existing.trabajo = trabajo;
  }

  // Validación: el período (con los valores nuevos) no debe superponerse con
  // otro del mismo trabajo (se excluye a sí mismo).
  if (existing.trabajo) {
    const superpuesto = await encontrarPeriodoSuperpuesto(
      repo,
      existing.trabajo.id,
      data.fechaDesde ?? existing.fechaDesde,
      data.fechaHasta ?? existing.fechaHasta,
      id
    );
    if (superpuesto) {
      throw new Error(
        `El período se superpone con "${formatearFechaDMA(superpuesto.fechaDesde)} al ${formatearFechaDMA(superpuesto.fechaHasta)}" del trabajo "${existing.trabajo.nombre}"`
      );
    }
  }

  // Ajustes de la edición según la modalidad del trabajo (§5 del plan).
  const modalidad = existing.trabajo?.modalidadCobro ?? "horas_variables";
  const restData = { ...rest };
  if (modalidad === "horas_fijas") {
    if (restData.horasPeriodo !== undefined) {
      if (restData.horasPeriodo <= 0) {
        throw new Error(
          "Las horas del período deben ser mayores a 0 (modalidad horas fijas)"
        );
      }
      // Recalcula con el SNAPSHOT original (no refresca el precio al editar:
      // para reflejar un cambio de precio se usa el Trabajo, afecta a períodos
      // nuevos).
      const precio =
        existing.precioHoraPeriodo ?? existing.trabajo?.precioHora ?? 0;
      restData.montoACobrar = restData.horasPeriodo * precio;
      if (existing.precioHoraPeriodo == null && existing.trabajo) {
        existing.precioHoraPeriodo = existing.trabajo.precioHora ?? 0;
      }
    }
  } else if (modalidad === "fijo") {
    if (restData.montoACobrar !== undefined && restData.montoACobrar <= 0) {
      throw new Error(
        "El monto del período debe ser mayor a 0 (modalidad monto fijo)"
      );
    }
  }
  // horas_variables / por_tarea: comportamiento actual (el monto puede editarse
  // a mano como override, o recalcularse desde jornadas/tareas).

  try {
    Object.assign(existing, restData);
    await repo.save(existing);
    refresh();
    return getPeriodoTrabajoById(id);
  } catch (error) {
    dbError(error, "Período de trabajo");
  }
}

export async function eliminarPeriodoTrabajo(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoTrabajo);
  const row = await repo.findOne({
    where: { id, trabajo: { usuario: { id: userId } }, eliminado: false },
  });
  if (!row) {
    throw new Error(`Período de trabajo con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Período de trabajo");
  }
}

// ============================================================
// JORNADA DE TRABAJO (calcula monto y actualiza período)
// ============================================================
export async function crearJornadaTrabajo(
  input: z.infer<typeof jornadaTrabajoCreateSchema>
) {
  const userId = await requireUserId();
  // safeParse: evita el bug de serialización de ZodError en Server Actions
  // ("Cannot set property message ... only a getter") y deja ver el error real.
  const parsed = jornadaTrabajoCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error("⚠️ crearJornadaTrabajo PARSE ERROR:", msg, JSON.stringify(input));
    throw new Error(`Datos inválidos: ${msg}`);
  }
  const data = parsed.data;
  const ds = await getDb();
  const { idPeriodo, crearPeriodoAutomatico, idTrabajo, idCuenta, ...rest } = data;

  // Propina: si > 0 se deposita en la cuenta elegida (igual que el wizard
  // cargarJornadaTrabajo). La conversión a moneda predeterminada va fuera del tx.
  const propina = data.montoPropina ?? 0;
  if (propina > 0 && !idCuenta) {
    throw new Error("Seleccioná la cuenta para depositar la propina");
  }
  const propinaPredeterminada =
    propina > 0 && idCuenta
      ? await montoEnMonedaPredeterminada(
          idCuenta,
          propina,
          new Date(data.fechaJornada)
        )
      : propina;

  // Validación previa: el período (automático o existente) no debe superponerse
  // con otro período del mismo trabajo.
  const periodoRepoVal = ds.getRepository(PeriodoTrabajo);
  const jornadaRepoVal = ds.getRepository(JornadaTrabajo);
  let trabajoIdVal: number;
  let nombreTrabajoVal = "";
  if (crearPeriodoAutomatico) {
    if (!idTrabajo) {
      throw new Error("Seleccioná el trabajo para crear el período automático");
    }
    const trabajoVal = await ds.getRepository(Trabajo).findOneBy({
      id: idTrabajo,
      usuario: { id: userId },
    });
    if (!trabajoVal) {
      throw new Error(`Trabajo con id ${idTrabajo} no encontrado`);
    }
    if (!modalidadAdmiteJornadas(trabajoVal.modalidadCobro ?? "horas_variables")) {
      throw new Error(
        `El trabajo "${trabajoVal.nombre}" no admite jornadas (modalidad ${etiquetaModalidad(
          trabajoVal.modalidadCobro ?? "horas_variables"
        )})`
      );
    }
    trabajoIdVal = trabajoVal.id;
    nombreTrabajoVal = trabajoVal.nombre;
    const superpuesto = await encontrarPeriodoSuperpuesto(
      periodoRepoVal,
      trabajoVal.id,
      data.fechaJornada,
      data.fechaJornada
    );
    if (superpuesto) {
      throw new Error(
        `El período automático se superpone con "${formatearFechaDMA(superpuesto.fechaDesde)} al ${formatearFechaDMA(superpuesto.fechaHasta)}" del trabajo "${trabajoVal.nombre}"`
      );
    }
  } else {
    if (!idPeriodo) {
      throw new Error("Seleccioná el período de trabajo");
    }
    const periodoVal = await periodoRepoVal.findOne({
      where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
      relations: { trabajo: true },
    });
    if (!periodoVal) {
      throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
    }
    if (
      !modalidadAdmiteJornadas(
        periodoVal.trabajo?.modalidadCobro ?? "horas_variables"
      )
    ) {
      throw new Error(
        `El trabajo "${periodoVal.trabajo?.nombre ?? "?"}" no admite jornadas (modalidad ${etiquetaModalidad(
          periodoVal.trabajo?.modalidadCobro ?? "horas_variables"
        )})`
      );
    }
    trabajoIdVal = periodoVal.trabajo.id;
    nombreTrabajoVal = periodoVal.trabajo.nombre;
    const superpuesto = await encontrarPeriodoSuperpuesto(
      periodoRepoVal,
      periodoVal.trabajo.id,
      String(periodoVal.fechaDesde).slice(0, 10),
      String(periodoVal.fechaHasta).slice(0, 10),
      periodoVal.id
    );
    if (superpuesto) {
      throw new Error(
        `El período seleccionado se superpone con "${formatearFechaDMA(superpuesto.fechaDesde)} al ${formatearFechaDMA(superpuesto.fechaHasta)}" del trabajo "${periodoVal.trabajo.nombre}"`
      );
    }
    // La fecha de la jornada debe caer dentro del período seleccionado.
    if (!fechaEnRango(data.fechaJornada, periodoVal.fechaDesde, periodoVal.fechaHasta)) {
      throw new Error(
        `La fecha de la jornada (${formatearFechaDMA(data.fechaJornada)}) no corresponde al período "${formatearFechaDMA(periodoVal.fechaDesde)} al ${formatearFechaDMA(periodoVal.fechaHasta)}" del trabajo "${periodoVal.trabajo.nombre}"`
      );
    }
  }

  // Validación previa: no debe existir otra jornada del mismo trabajo que se
  // superponga en el mismo día y con horas solapadas.
  const jornadaSuperpuesta = await encontrarJornadaSuperpuesta(
    jornadaRepoVal,
    trabajoIdVal,
    data.fechaJornada,
    data.horaDesde,
    data.horaHasta
  );
  if (jornadaSuperpuesta) {
    throw new Error(
      `Ya existe una jornada de "${nombreTrabajoVal}" el ${formatearFechaDMA(data.fechaJornada)} de ${formatearHora(jornadaSuperpuesta.horaDesde)} a ${formatearHora(jornadaSuperpuesta.horaHasta)} (horas superpuestas)`
    );
  }

  let createdId = "";
  try {
    await ds.transaction(async (manager) => {
      const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);
      const jornadaRepo = manager.getRepository(JornadaTrabajo);
      const trabajoRepo = manager.getRepository(Trabajo);
      const cuentaRepo = manager.getRepository(Cuenta);
      const conceptoRepo = manager.getRepository(Concepto);
      const movRepo = manager.getRepository(Movimiento);

      // Período de trabajo: si se eligió "crear período automático" se genera
      // un período de una sola jornada (fechaDesde = fechaHasta = fecha de la
      // jornada); si no, se usa el período existente seleccionado.
      let periodo: PeriodoTrabajo | null = null;
      let trabajo: Trabajo | null = null;
      if (crearPeriodoAutomatico) {
        if (!idTrabajo) {
          throw new Error("Seleccioná el trabajo para crear el período automático");
        }
        trabajo = await trabajoRepo.findOneBy({
          id: idTrabajo,
          usuario: { id: userId },
        });
        if (!trabajo) {
          throw new Error(`Trabajo con id ${idTrabajo} no encontrado`);
        }
        // String directo (patrón de fechaJornada): evita el desfase de zona
        // horaria al guardar en columnas `date` (un Date a medianoche UTC en
        // GMT-4 cae en el día anterior).
        const d = data.fechaJornada as unknown as Date;
        periodo = await periodoTrabajoRepo.save(
          periodoTrabajoRepo.create({ fechaDesde: d, fechaHasta: d, trabajo })
        );
      } else {
        if (!idPeriodo) {
          throw new Error("Seleccioná el período de trabajo");
        }
        periodo = await periodoTrabajoRepo.findOne({
          where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
          relations: { trabajo: true },
        });
        if (!periodo) {
          throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
        }
      }

      const precioHora = trabajo?.precioHora ?? periodo?.trabajo?.precioHora;
      if (!periodo || !precioHora) {
        throw new Error("No se pudo determinar el trabajo del período");
      }
      const montoJornada = calcularMontoJornada(
        data.horaDesde,
        data.horaHasta,
        precioHora
      );

      const created = await jornadaRepo.save(
        jornadaRepo.create({
          ...rest,
          periodoTrabajo: periodo,
          fechaCarga: new Date(),
          montoJornada,
          // Snapshot del precio por hora al momento de la carga (se usa al editar).
          precioHora,
        })
      );
      createdId = created.id;

      // Recalcular el monto a cobrar del período (SIN propina).
      const periodoActualizado = await periodoTrabajoRepo.findOne({
        where: { id: periodo.id },
        relations: { jornadas: true },
      });
      if (periodoActualizado) {
        periodoActualizado.montoACobrar = calcularMontoACobrar(
          periodoActualizado.jornadas ?? []
        );
        await periodoTrabajoRepo.save(periodoActualizado);
      }

      // Depósito de la propina en la cuenta elegida (como el wizard).
      if (propina > 0 && idCuenta) {
        const cuenta = await cuentaRepo.findOneBy({
          id: idCuenta,
          usuario: { id: userId },
        });
        if (!cuenta) {
          throw new Error(`Cuenta con id ${idCuenta} no encontrada`);
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
            fecha: data.fechaJornada,
            monto: propinaPredeterminada,
            montoCuentaMonedaOrigen: propina,
            cuenta,
            concepto,
            // Vínculo a la jornada: al borrar/editar la jornada se localiza
            // este movimiento para revertir o recrear el depósito.
            jornadaTrabajo: created,
          })
        );
        await crearHistoricoCuenta(manager, cuenta, mov.id);
      }
    });

    refresh();
    return getJornadaTrabajoById(createdId);
  } catch (error) {
    dbError(error, "Jornada de trabajo");
  }
}

export async function actualizarJornadaTrabajo(
  id: string,
  input: z.infer<typeof jornadaTrabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = jornadaTrabajoUpdateSchema.parse(input);
  const ds = await getDb();

  const existing = await ds.getRepository(JornadaTrabajo).findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: true },
  });
  if (!existing) {
    throw new Error(`Jornada de trabajo con id ${id} no encontrada`);
  }

  const idPeriodo = data.idPeriodo ?? existing.periodoTrabajo?.id;
  if (!idPeriodo) {
    throw new Error("idPeriodo es requerido");
  }

  // Propina nueva (el form siempre la envía; fallback al valor actual).
  const propina = data.montoPropina ?? existing.montoPropina ?? 0;
  const idCuenta = data.idCuenta;
  if (propina > 0 && !idCuenta) {
    throw new Error("Seleccioná la cuenta para depositar la propina");
  }
  const fechaStr =
    data.fechaJornada ?? String(existing.fechaJornada).slice(0, 10);
  const propinaPredeterminada =
    propina > 0 && idCuenta
      ? await montoEnMonedaPredeterminada(idCuenta, propina, new Date(fechaStr))
      : propina;

  // Validación previa: el período al que se mueve la jornada no debe
  // superponerse con otro del mismo trabajo.
  const periodoVal = await ds.getRepository(PeriodoTrabajo).findOne({
    where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
    relations: { trabajo: true },
  });
  if (!periodoVal) {
    throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
  }
  if (
    !modalidadAdmiteJornadas(periodoVal.trabajo?.modalidadCobro ?? "horas_variables")
  ) {
    throw new Error(
      `El trabajo "${periodoVal.trabajo?.nombre ?? "?"}" no admite jornadas (modalidad ${etiquetaModalidad(
        periodoVal.trabajo?.modalidadCobro ?? "horas_variables"
      )})`
    );
  }
  const superpuesto = await encontrarPeriodoSuperpuesto(
    ds.getRepository(PeriodoTrabajo),
    periodoVal.trabajo.id,
    String(periodoVal.fechaDesde).slice(0, 10),
    String(periodoVal.fechaHasta).slice(0, 10),
    periodoVal.id
  );
  if (superpuesto) {
    throw new Error(
      `El período seleccionado se superpone con "${formatearFechaDMA(superpuesto.fechaDesde)} al ${formatearFechaDMA(superpuesto.fechaHasta)}" del trabajo "${periodoVal.trabajo.nombre}"`
    );
  }

  // Validación previa: no debe existir otra jornada del mismo trabajo que se
  // superponga en el mismo día y con horas solapadas (se excluye a sí misma).
  const fechaJornadaStr =
    data.fechaJornada ?? String(existing.fechaJornada).slice(0, 10);
  const jornadaSuperpuesta = await encontrarJornadaSuperpuesta(
    ds.getRepository(JornadaTrabajo),
    periodoVal.trabajo.id,
    fechaJornadaStr,
    data.horaDesde ?? existing.horaDesde,
    data.horaHasta ?? existing.horaHasta,
    existing.id
  );
  if (jornadaSuperpuesta) {
    throw new Error(
      `Ya existe una jornada de "${periodoVal.trabajo.nombre}" el ${formatearFechaDMA(fechaJornadaStr)} de ${formatearHora(jornadaSuperpuesta.horaDesde)} a ${formatearHora(jornadaSuperpuesta.horaHasta)} (horas superpuestas)`
    );
  }

  // La fecha de la jornada debe caer dentro del período seleccionado.
  if (!fechaEnRango(fechaJornadaStr, periodoVal.fechaDesde, periodoVal.fechaHasta)) {
    throw new Error(
      `La fecha de la jornada (${formatearFechaDMA(fechaJornadaStr)}) no corresponde al período "${formatearFechaDMA(periodoVal.fechaDesde)} al ${formatearFechaDMA(periodoVal.fechaHasta)}" del trabajo "${periodoVal.trabajo.nombre}"`
    );
  }

  try {
    await ds.transaction(async (manager) => {
      const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);
      const jornadaRepo = manager.getRepository(JornadaTrabajo);
      const cuentaRepo = manager.getRepository(Cuenta);
      const conceptoRepo = manager.getRepository(Concepto);
      const movRepo = manager.getRepository(Movimiento);

      const periodo = await periodoTrabajoRepo.findOne({
        where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
        relations: { trabajo: true },
      });
      if (!periodo) {
        throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
      }

      // Usa el PRECIO SNAPSHOT guardado en la jornada al momento de la carga
      // (no el precio actual del trabajo), para no perder el valor histórico
      // al editar. Si la jornada no tiene snapshot, cae al precio actual.
      const precioJornada = existing.precioHora || periodo.trabajo.precioHora;
      const montoJornada = calcularMontoJornada(
        data.horaDesde ?? existing.horaDesde,
        data.horaHasta ?? existing.horaHasta,
        precioJornada
      );

      // Revertir el/los depósitos de propina anteriores vinculados a la jornada
      // (creados por el wizard o por el CRUD) y recrear con los valores nuevos.
      const propinasViejas = await movRepo.find({
        where: { jornadaTrabajo: { id }, eliminado: false },
        relations: { cuenta: true },
      });
      for (const mov of propinasViejas) {
        const cuenta = mov.cuenta;
        if (cuenta) {
          // Se revierte con el monto EN LA MONEDA DE LA CUENTA (el delta real
          // aplicado al saldo), no con `monto` (moneda predeterminada).
          cuenta.saldo -= mov.montoCuentaMonedaOrigen;
          await cuentaRepo.save(cuenta);
          await crearHistoricoCuenta(manager, cuenta);
        }
        mov.eliminado = true;
        await movRepo.save(mov);
      }

      // Guardar la jornada actualizada. Excluimos idPeriodo/idCuenta (no son
      // columnas de la jornada; se asignan vía periodoTrabajo / depósito).
      const restData = { ...data };
      delete restData.idPeriodo;
      delete restData.idCuenta;
      Object.assign(existing, restData, {
        montoPropina: propina,
        montoJornada,
        periodoTrabajo: periodo,
      });
      await jornadaRepo.save(existing);

      // Recalcular el monto a cobrar del período (SIN propina).
      const periodoActualizado = await periodoTrabajoRepo.findOne({
        where: { id: idPeriodo },
        relations: { jornadas: true },
      });
      if (periodoActualizado) {
        periodoActualizado.montoACobrar = calcularMontoACobrar(
          periodoActualizado.jornadas ?? []
        );
        await periodoTrabajoRepo.save(periodoActualizado);
      }

      // Depósito nuevo de la propina (si corresponde).
      if (propina > 0 && idCuenta) {
        const cuenta = await cuentaRepo.findOneBy({
          id: idCuenta,
          usuario: { id: userId },
        });
        if (!cuenta) {
          throw new Error(`Cuenta con id ${idCuenta} no encontrada`);
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
            fecha: fechaStr,
            monto: propinaPredeterminada,
            montoCuentaMonedaOrigen: propina,
            cuenta,
            concepto,
            jornadaTrabajo: existing,
          })
        );
        await crearHistoricoCuenta(manager, cuenta, mov.id);
      }
    });

    refresh();
    return getJornadaTrabajoById(id);
  } catch (error) {
    dbError(error, "Jornada de trabajo");
  }
}

export async function eliminarJornadaTrabajo(id: string) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(JornadaTrabajo);
  const row = await repo.findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: { trabajo: true } },
  });
  if (!row) {
    throw new Error(`Jornada de trabajo con id ${id} no encontrada`);
  }
  if (
    !modalidadAdmiteJornadas(
      row.periodoTrabajo?.trabajo?.modalidadCobro ?? "horas_variables"
    )
  ) {
    throw new Error(
      `El trabajo "${row.periodoTrabajo?.trabajo?.nombre ?? "?"}" ya no admite jornadas (modalidad ${etiquetaModalidad(
        row.periodoTrabajo?.trabajo?.modalidadCobro ?? "horas_variables"
      )})`
    );
  }
  const idPeriodo = row.periodoTrabajo?.id;
  try {
    await ds.transaction(async (manager) => {
      const jornadaRepo = manager.getRepository(JornadaTrabajo);
      const movRepo = manager.getRepository(Movimiento);
      const cuentaRepo = manager.getRepository(Cuenta);

      // Revertir el/los depósitos de propina vinculados a esta jornada
      // (creados por "cargarJornadaTrabajo" del wizard). Si la jornada se
      // creó por el CRUD no hubo depósito → no hay movimientos que revertir.
      const propinas = await movRepo.find({
        where: { jornadaTrabajo: { id: row.id }, eliminado: false },
        relations: { cuenta: true },
      });
      for (const mov of propinas) {
        const cuenta = mov.cuenta;
        if (cuenta) {
          // Se revierte con el monto EN LA MONEDA DE LA CUENTA (el delta real
          // aplicado al saldo), no con `monto` (moneda predeterminada).
          cuenta.saldo -= mov.montoCuentaMonedaOrigen;
          await cuentaRepo.save(cuenta);
          await crearHistoricoCuenta(manager, cuenta);
        }
        mov.eliminado = true;
        await movRepo.save(mov);
      }

      row.eliminado = true;
      await jornadaRepo.save(row);
    });

    if (idPeriodo) {
      await actualizarMontoACobrarPeriodo(idPeriodo);
    }
    refresh();
  } catch (error) {
    dbError(error, "Jornada de trabajo");
  }
}

// ============================================================
// TAREA DE TRABAJO (modalidad 'por_tarea' — monto cargado a mano)
// ============================================================
export async function crearTareaTrabajo(
  input: z.infer<typeof tareaTrabajoCreateSchema>
) {
  const userId = await requireUserId();
  const parsed = tareaTrabajoCreateSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    console.error("⚠️ crearTareaTrabajo PARSE ERROR:", msg, JSON.stringify(input));
    throw new Error(`Datos inválidos: ${msg}`);
  }
  const data = parsed.data;
  const ds = await getDb();
  const { idPeriodo, crearPeriodoAutomatico, idTrabajo, ...rest } = data;
  const descripcion = (rest.descripcion ?? "").trim();

  let createdId = "";
  try {
    await ds.transaction(async (manager) => {
      const tareaRepo = manager.getRepository(TareaTrabajo);
      const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);
      const trabajoRepo = manager.getRepository(Trabajo);

      let periodo: PeriodoTrabajo | null = null;
      if (crearPeriodoAutomatico) {
        if (!idTrabajo) {
          throw new Error("Seleccioná el trabajo para crear el período automático");
        }
        const trabajo = await trabajoRepo.findOneBy({
          id: idTrabajo,
          usuario: { id: userId },
        });
        if (!trabajo) {
          throw new Error(`Trabajo con id ${idTrabajo} no encontrado`);
        }
        if (!modalidadAdmiteTareas(trabajo.modalidadCobro ?? "horas_variables")) {
          throw new Error(
            `El trabajo "${trabajo.nombre}" no admite tareas (modalidad ${etiquetaModalidad(
              trabajo.modalidadCobro ?? "horas_variables"
            )})`
          );
        }
        // Período de una sola tarea: fechaDesde = fechaHasta = FECHA LOCAL de la
        // tarea (fechaTarea, decisión 2026-09-05). No se usa la fecha UTC del
        // instante: una tarea de madrugada (GMT-3) se correría al día siguiente.
        const dia = data.fechaTarea;
        const superpuestoAuto = await encontrarPeriodoSuperpuesto(
          periodoTrabajoRepo,
          trabajo.id,
          dia,
          dia
        );
        if (superpuestoAuto) {
          throw new Error(
            `El período automático se superpone con "${formatearFechaDMA(
              superpuestoAuto.fechaDesde
            )} al ${formatearFechaDMA(superpuestoAuto.fechaHasta)}" del trabajo "${trabajo.nombre}"`
          );
        }
        periodo = await periodoTrabajoRepo.save(
          periodoTrabajoRepo.create({
            fechaDesde: dia as unknown as Date,
            fechaHasta: dia as unknown as Date,
            trabajo,
          })
        );
      } else {
        if (!idPeriodo) {
          throw new Error("Seleccioná el período de trabajo");
        }
        periodo = await periodoTrabajoRepo.findOne({
          where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
          relations: { trabajo: true },
        });
        if (!periodo) {
          throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
        }
        if (
          !modalidadAdmiteTareas(periodo.trabajo?.modalidadCobro ?? "horas_variables")
        ) {
          throw new Error(
            `El trabajo "${periodo.trabajo?.nombre ?? "?"}" no admite tareas (modalidad ${etiquetaModalidad(
              periodo.trabajo?.modalidadCobro ?? "horas_variables"
            )})`
          );
        }
        if (!fechaEnRango(data.fechaTarea, periodo.fechaDesde, periodo.fechaHasta)) {
          throw new Error(
            `La fecha de la tarea (${data.fechaTarea}) no corresponde al período "${formatearFechaDMA(
              periodo.fechaDesde
            )} al ${formatearFechaDMA(periodo.fechaHasta)}" del trabajo "${
              periodo.trabajo?.nombre ?? "?"
            }"`
          );
        }
      }
      if (!periodo) {
        throw new Error("No se pudo determinar el período de la tarea");
      }

      const creada = await tareaRepo.save(
        tareaRepo.create({
          fechaCarga: new Date(),
          fechaHoraTarea: data.fechaHoraTarea as unknown as Date,
          fechaTarea: data.fechaTarea as unknown as Date,
          descripcion: descripcion || undefined,
          horasTarea: data.horasTarea ?? undefined,
          montoTarea: data.montoTarea,
          periodoTrabajo: periodo,
        })
      );
      createdId = creada.id;

      // Recalcular el monto a cobrar del período (Σ montoTarea).
      const periodoActualizado = await periodoTrabajoRepo.findOne({
        where: { id: periodo.id },
        relations: { tareas: true },
      });
      if (periodoActualizado) {
        periodoActualizado.montoACobrar = calcularMontoTareas(
          periodoActualizado.tareas ?? []
        );
        await periodoTrabajoRepo.save(periodoActualizado);
      }
    });

    refresh();
    return getTareaTrabajoById(createdId);
  } catch (error) {
    dbError(error, "Tarea de trabajo");
  }
}

export async function actualizarTareaTrabajo(
  id: string,
  input: z.infer<typeof tareaTrabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = tareaTrabajoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(TareaTrabajo);

  const existing = await repo.findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: { trabajo: true } },
  });
  if (!existing) {
    throw new Error(`Tarea de trabajo con id ${id} no encontrada`);
  }
  const modalidadActual =
    existing.periodoTrabajo?.trabajo?.modalidadCobro ?? "horas_variables";
  if (!modalidadAdmiteTareas(modalidadActual)) {
    throw new Error(
      `El trabajo "${existing.periodoTrabajo?.trabajo?.nombre ?? "?"}" ya no admite tareas (modalidad ${etiquetaModalidad(
        modalidadActual
      )})`
    );
  }

  const idPeriodo = data.idPeriodo ?? existing.periodoTrabajo?.id;
  if (!idPeriodo) {
    throw new Error("idPeriodo es requerido");
  }

  // Fecha local de la tarea (decisión 2026-09-05): si no viene nueva, se usa la
  // `fechaTarea` ya persistida (fecha local original). `fechaHoraTarea` (instante)
  // se conserva solo para mostrar la hora; el día/agrupación usa `fechaTarea`.
  const fechaTarea =
    data.fechaTarea ??
    (existing.fechaTarea instanceof Date
      ? existing.fechaTarea.toISOString().slice(0, 10)
      : String(existing.fechaTarea).slice(0, 10));
  const descripcion =
    data.descripcion !== undefined ? (data.descripcion ?? "").trim() : undefined;

  const periodoViejoId = existing.periodoTrabajo?.id;

  try {
    await ds.transaction(async (manager) => {
      const tareaRepo = manager.getRepository(TareaTrabajo);
      const periodoTrabajoRepo = manager.getRepository(PeriodoTrabajo);

      const periodo = await periodoTrabajoRepo.findOne({
        where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
        relations: { trabajo: true },
      });
      if (!periodo) {
        throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
      }
      if (
        !modalidadAdmiteTareas(periodo.trabajo?.modalidadCobro ?? "horas_variables")
      ) {
        throw new Error(
          `El trabajo "${periodo.trabajo?.nombre ?? "?"}" no admite tareas (modalidad ${etiquetaModalidad(
            periodo.trabajo?.modalidadCobro ?? "horas_variables"
          )})`
        );
      }
      if (!fechaEnRango(fechaTarea, periodo.fechaDesde, periodo.fechaHasta)) {
        throw new Error(
          `La fecha de la tarea (${fechaTarea}) no corresponde al período "${formatearFechaDMA(
            periodo.fechaDesde
          )} al ${formatearFechaDMA(periodo.fechaHasta)}"`
        );
      }

      const restData = { ...data };
      delete restData.idPeriodo;
      delete restData.crearPeriodoAutomatico;
      delete restData.idTrabajo;
      if (descripcion !== undefined) {
        restData.descripcion = descripcion || undefined;
      }
      Object.assign(existing, restData, {
        periodoTrabajo: periodo,
        // `fechaTarea` siempre queda en la fecha local (persistida como `date`).
        fechaTarea: fechaTarea as unknown as Date,
      });
      await tareaRepo.save(existing);

      // Recalcular el período destino (y el origen si se movió la tarea).
      const recalcular = async (pid: number) => {
        const p = await periodoTrabajoRepo.findOne({
          where: { id: pid },
          relations: { tareas: true },
        });
        if (p) {
          p.montoACobrar = calcularMontoTareas(p.tareas ?? []);
          await periodoTrabajoRepo.save(p);
        }
      };
      await recalcular(periodo.id);
      if (periodoViejoId && periodoViejoId !== periodo.id) {
        await recalcular(periodoViejoId);
      }
    });

    refresh();
    return getTareaTrabajoById(id);
  } catch (error) {
    dbError(error, "Tarea de trabajo");
  }
}

export async function eliminarTareaTrabajo(id: string) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(TareaTrabajo);
  const row = await repo.findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: { trabajo: true } },
  });
  if (!row) {
    throw new Error(`Tarea de trabajo con id ${id} no encontrada`);
  }
  if (
    !modalidadAdmiteTareas(
      row.periodoTrabajo?.trabajo?.modalidadCobro ?? "horas_variables"
    )
  ) {
    throw new Error(
      `El trabajo "${row.periodoTrabajo?.trabajo?.nombre ?? "?"}" ya no admite tareas (modalidad ${etiquetaModalidad(
        row.periodoTrabajo?.trabajo?.modalidadCobro ?? "horas_variables"
      )})`
    );
  }
  const idPeriodo = row.periodoTrabajo?.id;
  try {
    row.eliminado = true;
    await repo.save(row);
  } catch (error) {
    dbError(error, "Tarea de trabajo");
  }
  if (idPeriodo) {
    await actualizarMontoACobrarPeriodo(idPeriodo);
  }
  refresh();
}
