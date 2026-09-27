import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Trabajo } from "./trabajo.entity";
// import type rompe el ciclo en runtime con jornada-trabajo (string target)
import type { JornadaTrabajo } from "./jornada-trabajo.entity";
// import type rompe el ciclo en runtime con tarea-trabajo (string target)
import type { TareaTrabajo } from "./tarea-trabajo.entity";

/**
 * **Liquidación** (nombre histórico: `periodo_trabajo`).
 *
 * 🔑 **Qué es**: ya no es un *plan* que el usuario gestiona (rango + monto cargados antes de cobrar),
 * sino una **liquidación** que **nace en el acto de cobrar** y **queda siempre cerrada** (no tiene
 * estado, no hay saldo ni "pago a cuenta") — ver `DeepSeek/plan-liquidaciones.md`.
 *
 * **Los dos montos** (columnas distintas, `D3`):
 * - `montoCalculado` → lo que **correspondía cobrar**: Σ de los ítems seleccionados (variables),
 *   `horasPeriodo × precioHoraPeriodo` (`horas_fijas`) o una copia del cobrado (`fijo`).
 * - `montoCobrado` → lo que **realmente entró**. Lo escribe el cobro con el **mismo** número que
 *   `movimiento.montoCuentaMonedaOrigen` (nominal, no el convertido a moneda predeterminada) y en la
 *   misma transacción. En las filas históricas lo completó `backend/scripts/backfill-liquidaciones.mjs`.
 *   La **diferencia** entre ambos es derivada y **no se sigue** (no es una deuda): sólo queda como
 *   registro en el detalle.
 *
 * **⛔ La tabla NO se renombra** (decisión `P9`): `periodo_trabajo` y las FK `periodoTrabajoId`
 * conservan el nombre histórico para no tocar el SQL crudo (`innerJoin("periodo_trabajo", …)`) ni la
 * metadata (`@OneToMany("jornada_trabajo", …)` usa el nombre de **tabla**). Sólo cambia el nombre
 * **a nivel de código**: esta clase se llama `Liquidacion`.
 */
@Entity({ name: "periodo_trabajo" })
export class Liquidacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fechaDesde: Date;

  @Column({ type: "date" })
  fechaHasta: Date;

  /**
   * Lo que **correspondía** cobrar (antes `montoACobrar`): Σ ítems · `horas × precio` · copia del
   * cobrado en `fijo`. Se **congela al liquidar** (si después se edita un ítem, NO se recalcula).
   */
  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
  })
  montoCalculado?: number;

  /**
   * Lo que **realmente se cobró**. Espejo de `movimiento.montoCuentaMonedaOrigen` (nominal), escrito
   * en la misma transacción del cobro. `NULL` sólo en filas históricas sin dato (`P11`).
   */
  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    default: null,
    nullable: true,
  })
  montoCobrado?: number;

  /** Modalidad `horas_fijas`: horas del período, **declaradas al cobrar**. */
  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    default: null,
    nullable: true,
  })
  horasPeriodo?: number;

  /** Modalidad `horas_fijas`: snapshot del `trabajo.precioHora` **al cobrar** (permite que
   *  `montoCalculado = horasPeriodo × precioHoraPeriodo` quede con el precio de ese momento). */
  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    default: null,
    nullable: true,
  })
  precioHoraPeriodo?: number;

  /**
   * ⚠️ **Se conserva oculta, sin uso** (decisión `P1.c`): la liquidación nace al cobrar, así que no
   * hay "fecha estimada" que cargar. Queda la columna por si más adelante se infiere de las
   * liquidaciones anteriores (mecanismo **a definir**) — hoy no se muestra ni se completa.
   */
  @Column({ type: "date", nullable: true })
  fechaEstimadaCobro?: Date;

  /** Fecha del cobro: **siempre** presente en una liquidación (nace cobrada); los ítems se le
   *  asignan en ese mismo acto y se liberan si el cobro se anula. */
  @Column({ type: "date", nullable: true })
  fechaDeCobro?: Date;

  @Column({
    default: false,
  })
  eliminado: boolean;

  @ManyToOne(() => Trabajo)
  trabajo: Trabajo;

  // Relación inversa con STRING TARGET = NOMBRE DE TABLA ("jornada_trabajo"),
  // no el nombre de clase: evita import circular en runtime con JornadaTrabajo
  // y sobrevive la minificación de Turbopack en producción (los nombres de
  // clase se manglean y `@OneToMany("JornadaTrabajo")` deja de resolver el
  // target → EntityMetadataNotFoundError). El lado propietario está en
  // jornada-trabajo.entity.
  @OneToMany("jornada_trabajo", (jornada: JornadaTrabajo) => jornada.periodoTrabajo, {
    cascade: true,
    eager: false,
  })
  jornadas?: JornadaTrabajo[];

  // Relación inversa con STRING TARGET = NOMBRE DE TABLA (igual que jornadas):
  // evita import circular en runtime y sobrevive la minificación de Turbopack.
  @OneToMany("tarea_trabajo", (tarea: TareaTrabajo) => tarea.periodoTrabajo, {
    cascade: true,
    eager: false,
  })
  tareas?: TareaTrabajo[];
}
