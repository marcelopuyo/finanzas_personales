"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Concepto } from "../entities/concepto.entity";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { crearHistoricoCuenta, dbError, refresh } from "../lib/action-helpers";
import { montoEnMonedaPredeterminada } from "../lib/cotizaciones";
import {
  getJornadaTrabajoById,
  getPeriodoTrabajoById,
  getTrabajoById,
} from "../queries/trabajos";
import {
  calcularMontoACobrar,
  calcularMontoJornada,
  encontrarJornadaSuperpuesta,
  encontrarPeriodoSuperpuesto,
  fechaEnRango,
  formatearFechaDMA,
  formatearHora,
} from "../lib/jornadas";
import {
  jornadaTrabajoCreateSchema,
  jornadaTrabajoUpdateSchema,
  periodoTrabajoCreateSchema,
  periodoTrabajoUpdateSchema,
  trabajoCreateSchema,
  trabajoUpdateSchema,
} from "../validation/trabajos";

// ---------------------------------------------------------------------------
// Helpers de lógica de jornadas (port del servicio JornadaTrabajoService)
// ---------------------------------------------------------------------------
async function actualizarMontoACobrarPeriodo(idPeriodo: number) {
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoTrabajo);
  const periodo = await repo.findOne({
    where: { id: idPeriodo },
    relations: { jornadas: true },
  });
  if (!periodo) {
    throw new Error(`PeriodoTrabajo con id ${idPeriodo} no encontrado`);
  }

  // La propina NO forma parte del monto a cobrar (tarjetas "Períodos a
  // Cobrar/Actuales" del dashboard; decisión 2026-08-06). Ver lib/jornadas.
  periodo.montoACobrar = calcularMontoACobrar(periodo.jornadas ?? []);
  await repo.save(periodo);
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
      repo.create({ ...data, usuario: { id: userId } })
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
  const { nombreTrabajo, ...rest } = data;

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

  try {
    const repo = ds.getRepository(PeriodoTrabajo);
    const created = await repo.save(repo.create({ ...rest, trabajo }));
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

  try {
    Object.assign(existing, rest);
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
    relations: { periodoTrabajo: true },
  });
  if (!row) {
    throw new Error(`Jornada de trabajo con id ${id} no encontrada`);
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
