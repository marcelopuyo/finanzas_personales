import { In, IsNull } from "typeorm";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { Liquidacion } from "../entities/periodo-trabajo.entity";
import { TareaTrabajo } from "../entities/tarea-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";

// ============================================================
// Tipos de salida (coinciden con los Response DTOs del backend)
// ============================================================
export interface TrabajoOut {
  id: number;
  nombre: string;
  fechaInicio: Date;
  precioHora: number;
  modalidadCobro: string;
  memos: string | null;
}

export interface JornadaTrabajoOut {
  id: string;
  fechaJornada: Date;
  fechaCarga: Date;
  horaDesde: number;
  horaHasta: number;
  montoJornada: number;
  montoPropina: number;
  precioHora: number;
}

export interface TareaTrabajoOut {
  id: string;
  fechaCarga: Date;
  fechaHoraTarea: Date;
  /** Fecha calendario LOCAL de la tarea (la que eligió el usuario). */
  fechaTarea: Date;
  descripcion: string | null;
  horasTarea: number | null;
  montoTarea: number;
}

export interface LiquidacionOut {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  /** Lo que **correspondía** cobrar: Σ ítems · `horas × precio` · copia del cobrado en `fijo`. */
  montoCalculado: number | null;
  /** Lo que **realmente entró** (nominal, espejo del movimiento). `NULL` en filas históricas sin dato. */
  montoCobrado: number | null;
  horasPeriodo: number | null;
  precioHoraPeriodo: number | null;
  fechaEstimadaCobro: Date | null;
  fechaDeCobro: Date | null;
  trabajo: { id: number; nombre: string; modalidadCobro: string } | null;
  jornadas: JornadaTrabajoOut[];
  tareas: TareaTrabajoOut[];
}

function mapTarea(r: TareaTrabajo): TareaTrabajoOut {
  return {
    id: r.id,
    fechaCarga: r.fechaCarga,
    fechaHoraTarea: r.fechaHoraTarea,
    fechaTarea: r.fechaTarea,
    descripcion: r.descripcion ?? null,
    horasTarea: r.horasTarea ?? null,
    montoTarea: r.montoTarea ?? 0,
  };
}

function mapJornada(r: JornadaTrabajo): JornadaTrabajoOut {
  return {
    id: r.id,
    fechaJornada: r.fechaJornada,
    fechaCarga: r.fechaCarga,
    horaDesde: r.horaDesde,
    horaHasta: r.horaHasta,
    montoJornada: r.montoJornada,
    montoPropina: r.montoPropina ?? 0,
    precioHora: r.precioHora ?? 0,
  };
}

function mapPeriodo(r: Liquidacion): LiquidacionOut {
  return {
    id: r.id,
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta,
    montoCalculado: r.montoCalculado ?? null,
    montoCobrado: r.montoCobrado ?? null,
    horasPeriodo: r.horasPeriodo ?? null,
    precioHoraPeriodo: r.precioHoraPeriodo ?? null,
    fechaEstimadaCobro: r.fechaEstimadaCobro ?? null,
    fechaDeCobro: r.fechaDeCobro ?? null,
    trabajo: r.trabajo
      ? {
          id: r.trabajo.id,
          nombre: r.trabajo.nombre,
          modalidadCobro: r.trabajo.modalidadCobro,
        }
      : null,
    jornadas: (r.jornadas ?? [])
      .filter((j) => !j.eliminado)
      .map(mapJornada),
    tareas: (r.tareas ?? [])
      .filter((t) => !t.eliminado)
      .map(mapTarea),
  };
}

// ============================================================
// Trabajos
// ============================================================
export async function getAllTrabajos(): Promise<TrabajoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(Trabajo)
    .find({ where: { usuario: { id: userId }, eliminado: false } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fechaInicio: r.fechaInicio,
    precioHora: r.precioHora,
    modalidadCobro: r.modalidadCobro ?? "horas_variables",
    memos: r.memos ?? null,
  }));
}

/** Último cobro de un trabajo (para precargar el monto del cobro declarado). */
export interface UltimoCobroTrabajoOut {
  trabajoId: number;
  /** Monto **cobrado** (nominal, espejo del movimiento). */
  monto: number;
  fechaDeCobro: Date;
}

/**
 * **Último cobro de CADA trabajo** (2026-09-26): lo usa el wizard para
 * **precargar el monto** al cobrar las modalidades declaradas (`fijo` y
 * `horas_fijas`), que no liquidan ítems y por eso no tienen de dónde sacarlo.
 *
 * Se toma la liquidación **cobrada** más reciente de cada trabajo
 * (`DISTINCT ON (trabajoId)` + fecha de cobro DESC) y su `montoCobrado`
 * (nominal); si una fila histórica no lo tiene, cae al `montoCalculado`.
 */
export async function getUltimosCobrosPorTrabajo(): Promise<
  UltimoCobroTrabajoOut[]
> {
  const userId = await requireUserId();
  const ds = await getDb();
  // SQL explícito: `DISTINCT ON` es específico de Postgres y con el QueryBuilder
  // el ORDER BY de la relación se vuelve frágil.
  const filas: {
    trabajoId: number;
    montoCobrado: string | null;
    montoCalculado: string | null;
    fechaDeCobro: Date;
  }[] = await ds.query(
    `SELECT DISTINCT ON (p."trabajoId")
            p."trabajoId"      AS "trabajoId",
            p."montoCobrado"   AS "montoCobrado",
            p."montoCalculado" AS "montoCalculado",
            p."fechaDeCobro"   AS "fechaDeCobro"
       FROM "periodo_trabajo" p
      INNER JOIN "trabajo" t ON t.id = p."trabajoId"
      WHERE t."usuarioId" = $1
        AND p.eliminado = false
        AND p."fechaDeCobro" >= '1901-01-02'
      ORDER BY p."trabajoId", p."fechaDeCobro" DESC, p.id DESC`,
    [userId]
  );
  return filas.map((r) => ({
    trabajoId: Number(r.trabajoId),
    monto: Number(r.montoCobrado ?? r.montoCalculado ?? 0),
    fechaDeCobro: r.fechaDeCobro,
  }));
}

export async function getTrabajoById(id: number): Promise<TrabajoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds
    .getRepository(Trabajo)
    .findOne({ where: { id, usuario: { id: userId }, eliminado: false } });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        fechaInicio: r.fechaInicio,
        precioHora: r.precioHora,
        modalidadCobro: r.modalidadCobro ?? "horas_variables",
        memos: r.memos ?? null,
      }
    : null;
}

// ============================================================
// Períodos de trabajo (con trabajo y jornadas)
// ============================================================
export async function getAllPeriodosTrabajo(): Promise<LiquidacionOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Liquidacion).find({
    where: { trabajo: { usuario: { id: userId } }, eliminado: false },
    // Más recientes primero (por la columna Desde).
    order: { fechaDesde: "DESC" },
    relations: { trabajo: true, jornadas: true, tareas: true },
  });
  return rows.map(mapPeriodo);
}

export async function getPeriodoTrabajoById(
  id: number
): Promise<LiquidacionOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(Liquidacion).findOne({
    where: { id, trabajo: { usuario: { id: userId } }, eliminado: false },
    relations: { trabajo: true, jornadas: true, tareas: true },
  });
  return r ? mapPeriodo(r) : null;
}

/** Una **tanda** de liquidaciones cobradas + cuántas hay en total. */
export interface LiquidacionesPagina {
  filas: LiquidacionOut[];
  /** ¿Quedan más tandas después de esta? */
  hayMas: boolean;
  /** Total de liquidaciones COBRADAS del usuario. */
  total: number;
}

/**
 * Una **tanda** de liquidaciones **COBRADAS** (las que tienen `fechaDeCobro`
 * real), ordenadas por fecha de cobro DESC. La usa el **scroll infinito** de
 * `/trabajo` (2026-09-26): así el cliente nunca recibe las 100+ liquidaciones de
 * una sola vez (cada una trae sus jornadas y tareas).
 *
 * ⚠️ El tamaño de la página lo propone el cliente y acá se **acota** (1..100),
 * igual que en el historial de cuenta.
 */
export async function getLiquidacionesCobradasPaginado(
  offset: number,
  limit: number
): Promise<LiquidacionesPagina> {
  const userId = await requireUserId();
  const ds = await getDb();
  const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  const skip = Math.max(Math.trunc(offset) || 0, 0);
  const repo = ds.getRepository(Liquidacion);

  // Un cobro real deja `fechaDeCobro` con una fecha >= 1901-01-02 (el centinela
  // 1901-01-01 significa "pendiente"): mismo criterio que `tieneCobroReal`
  // (`lib/ingresos-trabajo.ts`), pero resuelto en SQL para poder paginar.
  const filtro = () =>
    repo
      .createQueryBuilder("p")
      .innerJoin("p.trabajo", "t")
      .where("t.usuarioId = :userId", { userId })
      .andWhere("p.eliminado = false")
      .andWhere('p."fechaDeCobro" >= :desde', { desde: "1901-01-02" });

  // ⚠️ **Paginar en DOS pasos.** Usar `skip/take` con los joins a las
  // colecciones (jornadas/tareas) hace que TypeORM arme un `SELECT DISTINCT` con
  // el ORDER BY por fuera de la lista de resultados, y Postgres lo rechaza:
  // *"for SELECT DISTINCT, ORDER BY expressions must appear in the select list"*
  // (se detectó el 2026-09-26: la tanda salía vacía).
  // 1) Los **ids** de la tanda, con una consulta PLANA (1 fila por liquidación).
  const ids = (
    await filtro()
      .select("p.id", "id")
      .orderBy('p."fechaDeCobro"', "DESC")
      .addOrderBy("p.id", "DESC")
      .offset(skip)
      .limit(take)
      .getRawMany<{ id: number }>()
  ).map((r) => r.id);

  const [rows, total] = await Promise.all([
    // 2) El detalle de esos ids, ya con las relaciones que usa el panel.
    ids.length
      ? repo.find({
          where: { id: In(ids) },
          relations: { trabajo: true, jornadas: true, tareas: true },
        })
      : Promise.resolve([] as Liquidacion[]),
    // Conteo sin joins a los ítems: el total no depende de ellos.
    filtro().getCount(),
  ]);

  // `In()` no conserva el orden de los ids: se reordena según la tanda.
  const porId = new Map(rows.map((r) => [r.id, r]));
  const ordenadas = ids
    .map((id) => porId.get(id))
    .filter((r): r is Liquidacion => r !== undefined);

  return {
    filas: ordenadas.map(mapPeriodo),
    hayMas: skip + ordenadas.length < total,
    total,
  };
}

// ============================================================
// Ítems PENDIENTES de liquidar (jornadas y tareas sin liquidación)
// ============================================================
/**
 * Ítem (jornada o tarea) que todavía **no pertenece a ninguna liquidación**.
 * Es la unidad que el paso "Cobrar trabajo" ofrece tildar y la que alimentará
 * la tarjeta "Por cobrar" del panel (plan-liquidaciones.md, P1.b / P7).
 */
export interface ItemPendienteOut {
  id: string;
  tipo: "jornada" | "tarea";
  /** Trabajo al que pertenece el ítem (columna propia desde R2; `null` sólo en datos viejos). */
  trabajoId: number | null;
  /** Nombre del trabajo (agrupa la tarjeta "Por cobrar"); `null` si no se pudo resolver. */
  trabajoNombre: string | null;
  /** Fecha LOCAL del ítem ("YYYY-MM-DD"): la que ordena y rige el panel. */
  fecha: string;
  monto: number;
  /** Jornada: hora desde/hasta en decimal del backend (`HH.MM`, ej. 17.3 = 17:30). */
  horaDesde: number | null;
  horaHasta: number | null;
  /** Tarea: horas informadas (`null` si no se cargaron). Jornada: `null`. */
  horas: number | null;
  /** Tarea: descripción. Jornada: `null`. */
  descripcion: string | null;
  /** Jornada: propina depositada aparte (NO entra en la liquidación). */
  montoPropina: number;
}

/** "YYYY-MM-DD" de una fecha de la BD (columna date/datetime). */
const soloFecha = (v: Date | string) => String(v).slice(0, 10);

/**
 * Todos los ítems pendientes del usuario, ordenados por fecha descendente.
 * Los trabajos `fijo` y `horas_fijas` no generan ítems (se declaran al cobrar),
 * así que en la práctica esto es "las jornadas y tareas sin liquidar".
 */
export async function getItemsPendientesCobro(): Promise<ItemPendienteOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const [jornadas, tareas] = await Promise.all([
    ds.getRepository(JornadaTrabajo).find({
      where: {
        trabajo: { usuario: { id: userId } },
        periodoTrabajo: IsNull(),
        eliminado: false,
      },
      relations: { trabajo: true },
    }),
    ds.getRepository(TareaTrabajo).find({
      where: {
        trabajo: { usuario: { id: userId } },
        periodoTrabajo: IsNull(),
        eliminado: false,
      },
      relations: { trabajo: true },
    }),
  ]);
  const items: ItemPendienteOut[] = [
    ...jornadas.map((j) => ({
      id: j.id,
      tipo: "jornada" as const,
      trabajoId: j.trabajo?.id ?? null,
      trabajoNombre: j.trabajo?.nombre ?? null,
      fecha: soloFecha(j.fechaJornada),
      monto: j.montoJornada ?? 0,
      horaDesde: j.horaDesde ?? null,
      horaHasta: j.horaHasta ?? null,
      horas: null,
      descripcion: null,
      montoPropina: j.montoPropina ?? 0,
    })),
    ...tareas.map((t) => ({
      id: t.id,
      tipo: "tarea" as const,
      trabajoId: t.trabajo?.id ?? null,
      trabajoNombre: t.trabajo?.nombre ?? null,
      fecha: soloFecha(t.fechaTarea),
      monto: t.montoTarea ?? 0,
      horaDesde: null,
      horaHasta: null,
      horas: t.horasTarea ?? null,
      descripcion: t.descripcion ?? null,
      montoPropina: 0,
    })),
  ];
  // Más recientes primero (mismo criterio que el resto del módulo).
  return items.sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0
  );
}

// ⛔ Se retiró `getPropinasDepositadas()` (2026-09-27): la propina dejó de ser un
// ingreso por MOVIMIENTO de depósito y pasó a ser **devengo de su jornada**
// (`montoPropina` + `fechaJornada`), que arma el mismo módulo puro
// (`lib/ingresos-trabajo.ts`) junto con el resto de los ítems. El depósito sigue
// existiendo como operación (mueve el saldo de la cuenta), pero ya no es lo que
// define cuándo se reconoce el ingreso.

// ============================================================
// Jornadas de trabajo
// ============================================================
export async function getAllJornadasTrabajo(): Promise<
  (JornadaTrabajoOut & {
    periodoTrabajo: { id: number; trabajo: string } | null;
    trabajo: string;
  })[]
> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(JornadaTrabajo).find({
    where: { periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: { trabajo: true } },
    order: { fechaJornada: "DESC", fechaCarga: "DESC" },
  });
  return rows.map((r) => ({
    ...mapJornada(r),
    periodoTrabajo: r.periodoTrabajo
      ? {
          id: r.periodoTrabajo.id,
          trabajo: r.periodoTrabajo.trabajo?.nombre ?? "Sin trabajo",
        }
      : null,
    // El dashboard usa `trabajo` como nombre del trabajo
    trabajo: r.periodoTrabajo?.trabajo?.nombre ?? "Sin trabajo",
  }));
}

export async function getJornadaTrabajoById(
  id: string
): Promise<
  (JornadaTrabajoOut & { periodoTrabajoId?: number; cuentaPropinaId?: number }) | null
> {
  const userId = await requireUserId();
  const ds = await getDb();
  // ⚠️ Desde el rediseño de liquidaciones el ítem puede estar **pendiente**
  // (`periodoTrabajoId = NULL`): la pertenencia se resuelve por el **`trabajoId`
  // propio** del ítem y, para los viejos, cayendo al trabajo de su período. Antes
  // se filtraba SÓLO por período ⇒ un ítem pendiente devolvía `null`.
  const r = await ds.getRepository(JornadaTrabajo).findOne({
    where: { id, eliminado: false },
    relations: {
      trabajo: { usuario: true },
      periodoTrabajo: { trabajo: { usuario: true } },
    },
  });
  const duenio =
    r?.trabajo?.usuario?.id ?? r?.periodoTrabajo?.trabajo?.usuario?.id;
  if (!r || duenio !== userId) return null;
  // Cuenta donde se depositó la propina (movimiento "Cobro Propina" vinculado
  // a la jornada). Se usa para preseleccionar el select al editar.
  const mov = await ds.getRepository(Movimiento).findOne({
    where: { jornadaTrabajo: { id }, eliminado: false },
    relations: { cuenta: true },
    order: { fecha: "DESC" },
  });
  return {
    ...mapJornada(r),
    periodoTrabajoId: r.periodoTrabajo?.id,
    cuentaPropinaId: mov?.cuenta?.id ?? undefined,
  };
}

// ============================================================
// Tareas de trabajo (modalidad 'por_tarea')
// ============================================================
export async function getAllTareasTrabajo(): Promise<
  (TareaTrabajoOut & {
    periodoTrabajo: {
      id: number;
      trabajo: string;
      modalidadCobro: string;
      fechaDesde: Date;
      fechaHasta: Date;
    } | null;
    trabajo: string;
    montoACobrarPeriodo: number | null;
  })[]
> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(TareaTrabajo).find({
    where: { periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: { trabajo: true } },
    order: { fechaHoraTarea: "DESC" },
  });
  return rows.map((r) => ({
    ...mapTarea(r),
    periodoTrabajo: r.periodoTrabajo
      ? {
          id: r.periodoTrabajo.id,
          trabajo: r.periodoTrabajo.trabajo?.nombre ?? "Sin trabajo",
          modalidadCobro:
            r.periodoTrabajo.trabajo?.modalidadCobro ?? "horas_variables",
          fechaDesde: r.periodoTrabajo.fechaDesde,
          fechaHasta: r.periodoTrabajo.fechaHasta,
        }
      : null,
    trabajo: r.periodoTrabajo?.trabajo?.nombre ?? "Sin trabajo",
    montoACobrarPeriodo: r.periodoTrabajo?.montoCalculado ?? null,
  }));
}

export async function getTareaTrabajoById(
  id: string
): Promise<
  (TareaTrabajoOut & {
    periodoTrabajoId?: number;
    trabajoId?: number;
    modalidadCobro?: string;
    fechaDesde?: Date;
    fechaHasta?: Date;
  }) | null
> {
  const userId = await requireUserId();
  const ds = await getDb();
  // Igual que en la jornada: el ítem puede estar **pendiente** (sin período),
  // así que la pertenencia se resuelve por su `trabajoId` propio.
  const r = await ds.getRepository(TareaTrabajo).findOne({
    where: { id, eliminado: false },
    relations: {
      trabajo: { usuario: true },
      periodoTrabajo: { trabajo: { usuario: true } },
    },
  });
  const duenio =
    r?.trabajo?.usuario?.id ?? r?.periodoTrabajo?.trabajo?.usuario?.id;
  if (!r || duenio !== userId) return null;
  const trabajo = r.trabajo ?? r.periodoTrabajo?.trabajo;
  return {
    ...mapTarea(r),
    periodoTrabajoId: r.periodoTrabajo?.id,
    trabajoId: trabajo?.id,
    modalidadCobro: trabajo?.modalidadCobro,
    fechaDesde: r.periodoTrabajo?.fechaDesde,
    fechaHasta: r.periodoTrabajo?.fechaHasta,
  };
}
