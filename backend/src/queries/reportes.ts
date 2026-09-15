import { IsNull, MoreThan, MoreThanOrEqual } from "typeorm";
import { getDb } from "../db";
import { getSessionUser, requireUserId } from "../lib/auth";
import { convertir } from "../lib/cotizaciones";
import { aporteProrrateado, cobroAdelantado, modalidadProrratea } from "../lib/jornadas";
import { getPrestamosNetoEnPredeterminada } from "../lib/prestamos";
import { Cuenta } from "../entities/cuenta.entity";
import { Gasto } from "../entities/gasto.entity";
import { HistoricoCuenta } from "../entities/historico-cuenta.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { Prestamo } from "../entities/prestamo.entity";

// ============================================================
// Tipos de salida (coinciden con los DTOs del backend)
// ============================================================
export interface EvolucionItem {
  periodo: string;
  monto: number;
}

export interface EvolucionResultado {
  id: string;
  valor: number;
}

export interface CuentaConEvolucion {
  id: number;
  nombreCuenta: string;
  saldoCuenta: number;
  serieEjeX: string[];
  valoresEjeX: number[];
  /** Código ISO 4217 de la moneda de la cuenta (para formatear el saldo). */
  monedaCodigoISO: string | null;
  /** Nombre del tipo de cuenta (para el icono de la tarjeta del dashboard). */
  tipoNombre: string | null;
}

// ============================================================
// 1) Balance actual
// ============================================================
export async function getBalanceActual(): Promise<number> {
  const userId = await requireUserId();
  const ds = await getDb();

  // Cuentas que el usuario marcó como parte del balance actual
  // (campo "Incluir en el balance actual" del CRUD de cuentas).
  const cuentas = await ds.getRepository(Cuenta).find({
    where: {
      usuario: { id: userId },
      eliminado: false,
      incluirEnBalance: true,
    },
    relations: { moneda: true },
  });

  // Moneda predeterminada del usuario: si una cuenta está en OTRA moneda, su
  // saldo se convierte a esta antes de sumarse al balance (via cotización).
  const sesion = await getSessionUser();
  const predeterminada = sesion?.monedaPredeterminada;
  const hoy = new Date();

  let saldoCajas = 0;
  for (const c of cuentas) {
    saldoCajas += await convertir(c.saldo, c.moneda, predeterminada, hoy);
  }

  // Gastos pendientes (saldo > 0)
  const gastos = await ds.getRepository(Gasto).find({
    where: { usuario: { id: userId }, eliminado: false, saldo: MoreThan(0) },
  });

  let saldoGastos = 0;
  for (const g of gastos) {
    saldoGastos += g.saldo;
  }

  // Préstamos pendientes (§13): si el usuario activó el flag, el saldo NETO
  // (lo que le deben menos lo que debe) suma al balance. Se maneja con el
  // switch de la fila "Préstamos (neto)" del CRUD de Cuentas. Puede ser
  // negativo (debe más de lo que le deben).
  if (sesion?.incluirPrestamosEnBalance) {
    saldoCajas += await getPrestamosNetoEnPredeterminada(userId);
  }

  return saldoCajas - saldoGastos;
}

// ============================================================
// 2) [ELIMINADA] Gastos del período — dependía de periodo_gasto.
// 3) [ELIMINADA] Evolución de gastos por período — idem.
// La evolución de Gastos se calcula en el cliente por fecha de pago
// (app/(app)/dashboard/gastos-agrupacion.ts) y en el backend por la sección 4).
// ============================================================

// ============================================================
// 4) Evolución de gastos mensual — desde la tabla `gasto`, por FECHA DE PAGO
// ============================================================
/**
 * Gastos agrupados por MES DE `fechaPago` (en la moneda predeterminada, que es
 * como se guarda `gasto.monto`).
 *
 * Fuente de verdad: la tabla `gasto` — la MISMA que usan el Histórico de Gastos
 * del dashboard y el CRUD de gastos. Los gastos PENDIENTES (sin `fechaPago`)
 * quedan fuera, igual que en el Histórico.
 *
 * ⚠️ Antes se armaba desde los MOVIMIENTOS de pago (`movimiento.gastoId`), lo que
 * traía dos problemas (fix 2026-09-15, decisión del usuario):
 * 1. Todo gasto cargado como histórico SIN movimiento de cuenta (p. ej. los meses
 *    completados de ago/2025 a mar/2026) era invisible en "Resultados".
 * 2. El mismo mes mostraba cifras DISTINTAS entre "Resultados" y el Histórico de
 *    Gastos, porque `movimiento.monto` se convierte a la fecha de PAGO y
 *    `gasto.monto` a la fecha de CREACIÓN (diferencias chicas de cotización).
 */
export async function getEvolucionGastos(): Promise<EvolucionItem[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const gastos = await ds.getRepository(Gasto).find({
    where: { usuario: { id: userId }, eliminado: false },
  });

  // Se agrupa por "YYYY-MM" (ordenable) y se convierte a etiqueta al final.
  const agrupado: Record<string, number> = {};
  for (const g of gastos) {
    if (!g.fechaPago) continue; // pendientes: fuera (mismo criterio que el Histórico)
    // Mediodía UTC: evita que una fecha a medianoche UTC se corra al mes anterior
    // en zonas horarias con offset negativo (misma técnica que las jornadas).
    const d = new Date(g.fechaPago);
    d.setUTCHours(12, 0, 0, 0);
    const ym = ymDeFecha(d);
    agrupado[ym] = (agrupado[ym] || 0) + g.monto;
  }

  return Object.keys(agrupado)
    .sort()
    .map((ym) => ({ periodo: etiquetaDesdeYM(ym), monto: agrupado[ym] }));
}

// ============================================================
// 5) Evolución de ingresos (por mes): jornadas + tareas + prorrateo (§8)
// ============================================================
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "YYYY-MM" de una fecha (componentes UTC). Acepta Date o string (las columnas
 * `date` pueden llegar como Date o "YYYY-MM-DD"; se normaliza para que los
 * períodos prorrateados no exploten — fix 2026-09-05).
 */
function ymDeFecha(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * Etiqueta "mes-año" (es-ES corto, ej. "sep-2026") de una clave "YYYY-MM".
 * La usan IGUAL ingresos y gastos: `getEvolucionResultados` resta ambas series
 * POR ETIQUETA, así que un formato distinto duplicaría los meses en el gráfico.
 */
function etiquetaDesdeYM(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const mes = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-ES", {
    month: "short",
    timeZone: "UTC",
  });
  return `${mes}-${y}`;
}

/** "YYYY-MM-DD" del último día del mes representado por "YYYY-MM". */
function finMesISO(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${pad2(ultimo)}`;
}

/** Siguiente mes "YYYY-MM". */
function mesSiguiente(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return ymDeFecha(d);
}

export async function getEvolucionIngresos(): Promise<EvolucionItem[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const periodos = await ds.getRepository(PeriodoTrabajo).find({
    where: { trabajo: { usuario: { id: userId } }, eliminado: false },
    order: { fechaDesde: "ASC" },
    relations: { trabajo: true, jornadas: true, tareas: true },
  });

  // Agrupa por "YYYY-MM" (ordenable) y convierte a etiqueta al final.
  const agrupado: Record<string, number> = {};
  const sumarKey = (ym: string, monto: number) => {
    if (monto > 0) agrupado[ym] = (agrupado[ym] || 0) + monto;
  };

  for (const p of periodos) {
    const modalidad = p.trabajo?.modalidadCobro ?? "horas_variables";
    const jornadas = (p.jornadas ?? []).filter((j) => !j.eliminado);
    const tareas = (p.tareas ?? []).filter((t) => !t.eliminado);

    // Período CON JORNADAS → cuenta lo real por fecha de jornada (como hoy).
    // (Un período pasado con jornadas no cambia su aporte aunque el trabajo se
    // convierta después; discriminador robusto del §8.)
    if (jornadas.length > 0) {
      for (const j of jornadas) {
        // Mediodía UTC: evita que fechas a medianoche (UTC) se corran al mes
        // anterior en zonas horarias con offset negativo.
        const d = new Date(j.fechaJornada);
        d.setUTCHours(12, 0, 0, 0);
        sumarKey(ymDeFecha(d), j.montoJornada + j.montoPropina);
      }
      continue;
    }

    // Período CON TAREAS (modalidad por_tarea) → cuenta lo real por mes de la
    // FECHA LOCAL de la tarea (`fechaTarea`, decisión 2026-09-05): es la fecha
    // que eligió el usuario (se guarda como `date`), sin corrimiento de zona.
    if (tareas.length > 0) {
      for (const t of tareas) {
        // Mediodía UTC: evita que fechas a medianoche (UTC) se corran al mes
        // anterior (misma técnica que las jornadas).
        const d = new Date(t.fechaTarea);
        d.setUTCHours(12, 0, 0, 0);
        sumarKey(ymDeFecha(d), t.montoTarea);
      }
      continue;
    }

    // Período SIN hijos de fijo/horas_fijas → aporte PRORRATEADO por mes (§8).
    // El mes EN CURSO se corta a HOY (a la fecha, decisión usuario 2026-09-05);
    // los meses cerrados van completos.
    if (modalidadProrratea(modalidad)) {
      const monto = p.montoACobrar ?? 0;
      if (monto <= 0) continue;
      // COBRO ADELANTADO (decisión del usuario 2026-09-14): si el período se
      // cobró ANTES de su fecha de cierre, el ingreso se reconoce COMPLETO en el
      // mes del cobro (el dinero entró ese mes) y NO se prorratea — si no,
      // quedaría reconocido a medias y el gráfico no mostraría el total cobrado.
      if (cobroAdelantado(p)) {
        sumarKey(ymDeFecha(p.fechaDeCobro as Date), monto);
        continue;
      }
      const hoyKey = new Date().toISOString().slice(0, 10);
      const hoyYM = hoyKey.slice(0, 7);
      const desde = `${ymDeFecha(p.fechaDesde)}-${pad2(
        new Date(p.fechaDesde).getUTCDate()
      )}`;
      const hasta = `${ymDeFecha(p.fechaHasta)}-${pad2(
        new Date(p.fechaHasta).getUTCDate()
      )}`;
      let cursor = ymDeFecha(p.fechaDesde);
      while (cursor <= ymDeFecha(p.fechaHasta)) {
        const finMes = finMesISO(cursor);
        const hastaMes =
          cursor === hoyYM && hoyKey < finMes ? hoyKey : finMes;
        const aporte = aporteProrrateado(
          desde,
          hasta,
          monto,
          `${cursor}-01`,
          hastaMes
        );
        if (aporte > 0) sumarKey(cursor, aporte);
        cursor = mesSiguiente(cursor);
      }
    }
    // horas_variables / por_tarea sin hijos → aporte 0 (no prorratea).
  }

  return Object.keys(agrupado)
    .sort()
    .map((ym) => ({ periodo: etiquetaDesdeYM(ym), monto: agrupado[ym] }));
}

// ============================================================
// 6) Evolución de resultados (ingresos – gastos por mes)
// ============================================================
export async function getEvolucionResultados(): Promise<EvolucionResultado[]> {
  const [ingresos, gastos] = await Promise.all([
    getEvolucionIngresos(),
    getEvolucionGastos(),
  ]);

  // Ingresos (jornadas, en la moneda predeterminada) y gastos (por fecha de
  // pago, `gasto.monto` ya está en esa moneda): se restan por mes.
  const resultado: Record<string, number> = {};

  for (const item of ingresos) {
    resultado[item.periodo] = (resultado[item.periodo] || 0) + item.monto;
  }
  for (const item of gastos) {
    resultado[item.periodo] = (resultado[item.periodo] || 0) - item.monto;
  }

  // Se muestran TODOS los meses con datos (ingresos y/o gastos): un mes puede
  // tener solo ingresos (sin gastos cargados todavía) y su resultado
  // (ingresos − gastos) igual debe verse. Antes solo se mostraban los meses con
  // gastos y se descartaban los que solo reflejaban ingresos (fix 2026-09-06:
  // se mostró el mes en curso sin gastos y el usuario pidió aplicar a todos).
  return Object.keys(resultado)
    .map((key) => ({
      id: key,
      valor: resultado[key],
    }));
}

// ============================================================
// 7) Préstamos pendientes
// ============================================================
export async function getPrestamosPendientesReporte(): Promise<
  {
    id: string;
    detalle: string | null;
    fecha: Date;
    monto: number;
    saldo: number;
    sentido: string;
    /** ISO de la moneda del préstamo (moneda de su cuenta). */
    monedaISO: string;
    /** Contraparte del préstamo (la otra parte es el usuario). */
    personaContraparte: { nombre: string } | null;
    cuenta: { nombre: string } | null;
  }[]
> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Prestamo).find({
    where: { usuario: { id: userId }, eliminado: false, saldo: MoreThan(0) },
    relations: {
      personaContraparte: true,
      cuenta: { moneda: true },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    detalle: r.detalle ?? null,
    fecha: r.fecha,
    monto: r.monto,
    saldo: r.saldo,
    sentido: r.sentido,
    monedaISO: r.cuenta?.moneda?.codigoISO ?? "ARS",
    personaContraparte: r.personaContraparte
      ? { nombre: r.personaContraparte.nombre }
      : null,
    cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
  }));
}

// ============================================================
// 8) Movimientos de tarjeta del período (no implementado en backend)
// ============================================================
export async function getMovimientosTarjetaPeriodo(): Promise<null> {
  // No implementado en el backend original; devuelve null
  return null;
}

// ============================================================
// 9) Cuentas con evolución (sparkline del último mes)
// ============================================================
export async function getCuentasConEvolucion(): Promise<CuentaConEvolucion[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const cuentas = await ds.getRepository(Cuenta).find({
    where: {
      usuario: { id: userId },
      eliminado: false,
      tipo: [{ nombre: "Cuenta Bancaria" }, { nombre: "Caja Fisica" }],
    },
    relations: { tipo: true, moneda: true },
    // Orden manual del usuario para el panel "Cuentas" del dashboard (orden, id).
    order: { orden: "ASC", id: "ASC" },
  });

  const unMes = new Date();
  unMes.setMonth(unMes.getMonth() - 1);

  const result: CuentaConEvolucion[] = [];

  for (const cuenta of cuentas) {
    // Se filtra por ID (NO por nombre): puede haber varias cuentas con el mismo
    // nombre (ej. dos "Billetera" en monedas distintas) y filtrar por nombre
    // mezclaría los históricos de todas ellas, corrompiendo la serie.
    const historicos = await ds.getRepository(HistoricoCuenta).find({
      where: [
        {
          eliminado: false,
          cuenta: { id: cuenta.id },
          fechaHasta: MoreThanOrEqual(unMes),
        },
        {
          eliminado: false,
          cuenta: { id: cuenta.id },
          fechaHasta: IsNull(),
        },
      ],
      // Orden cronológico: `historico_cuenta.id` es UUID (aleatorio), por lo
      // que sin ORDER BY la serie del sparkline llegaba barajada y podía
      // verse una tendencia ascendente cuando el saldo en realidad bajó.
      order: { fechaHasta: "ASC" },
    });

    const { vKeys, vValues } = filtrarMayorFechaPorDia(historicos);

    // Punto "hoy": con >= 2 snapshots el extremo derecho apunta al saldo actual
    // de la cuenta (coincide con la tarjeta). Con 0 o 1 movimiento la serie se
    // deja con un único punto para que el sparkline dibuje una línea horizontal:
    // - 0 movimientos -> único punto = saldo actual (línea en el saldo actual).
    // - 1 movimiento  -> se conserva el snapshot (línea en el valor del
    //   movimiento), sin reemplazarlo por el saldo de hoy.
    const hoyISO = new Date().toISOString().split("T")[0];
    if (vValues.length === 0) {
      vKeys.push(hoyISO);
      vValues.push(cuenta.saldo);
    } else if (vValues.length >= 2) {
      vValues[vValues.length - 1] = cuenta.saldo;
      vKeys[vKeys.length - 1] = hoyISO;
    }

    result.push({
      id: cuenta.id,
      nombreCuenta: cuenta.nombre,
      saldoCuenta: cuenta.saldo,
      serieEjeX: vKeys,
      valoresEjeX: vValues,
      monedaCodigoISO: cuenta.moneda?.codigoISO ?? null,
      tipoNombre: cuenta.tipo?.nombre ?? null,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper: agrupa histórico por día tomando el último saldo de cada día
// ---------------------------------------------------------------------------
function filtrarMayorFechaPorDia(
  lista: { fechaHasta?: Date | null; fechaDesde: Date; saldo: number }[]
): { vKeys: string[]; vValues: number[] } {
  // "Último saldo de cada día": por cada día se conserva el saldo del histórico
  // con la fecha MÁS reciente (mayor fechaHasta; NULL = vigente actual).
  const porDia = new Map<string, { saldo: number; fechaHastaMs: number }>();

  for (const item of lista) {
    const dia = item.fechaHasta
      ? item.fechaHasta.toISOString().split("T")[0]
      : item.fechaDesde.toISOString().split("T")[0];
    const fechaHastaMs = item.fechaHasta
      ? new Date(item.fechaHasta).getTime()
      : Number.MAX_SAFE_INTEGER; // vigente (NULL) = la más reciente
    const prev = porDia.get(dia);
    if (!prev || fechaHastaMs > prev.fechaHastaMs) {
      porDia.set(dia, { saldo: item.saldo, fechaHastaMs });
    }
  }

  // Orden cronológico: las fechas ISO "YYYY-MM-DD" ordenan igual que el
  // orden cronológico, así la tendencia del sparkline es la real.
  const entries = Array.from(porDia.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return {
    vKeys: entries.map(([k]) => k),
    vValues: entries.map(([, v]) => v.saldo),
  };
}
