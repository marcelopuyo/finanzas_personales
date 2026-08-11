import { EntityManager, IsNull, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { getDb } from "../db";
import { Cotizacion } from "../entities/cotizacion.entity";
import { Moneda } from "../entities/moneda.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { getSessionUser } from "./auth";

// Servicio de conversión entre monedas usando la tabla `cotizacion` como caché
// diario (período vigente por par).
//
// Política de refresco (2026-08-10):
// - El PRIMER pedido del día (independiente del usuario; las cotizaciones son
//   globales) y SOLO si ya pasó la apertura del mercado de divisas (hora de
//   Argentina, `FX_MARKET_OPEN_HOUR`, default 10) consulta la API; si trae
//   resultados cierra el período anterior y crea el nuevo (vigente).
// - Los pedidos siguientes dentro del mismo día usan el registro existente.
// - Fecha pasada sin registro / fallo de API → última cotización guardada.

const FX_API_URL = process.env.FX_API_URL ?? "https://open.er-api.com/v6/latest/USD";

function redondear(v: number): number {
  return Math.round(v * 100) / 100;
}

function esMismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function diaISO(fecha: Date): string {
  const f = new Date(fecha);
  f.setMinutes(f.getMinutes() - f.getTimezoneOffset());
  return f.toISOString().slice(0, 10);
}

// Hora de apertura del mercado de divisas (hora de Argentina, GMT-3).
// Configurable vía env `FX_MARKET_OPEN_HOUR` (default 10).
const FX_MARKET_OPEN_HOUR = Number(process.env.FX_MARKET_OPEN_HOUR ?? 10);

function horaEnArgentina(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return h === 24 ? 0 : h;
}

function mercadoAbierto(): boolean {
  return horaEnArgentina() >= FX_MARKET_OPEN_HOUR;
}

/** Devuelve el día "YYYY-MM-DD" como quedó guardado en la columna `date`. */
function diaDeRegistro(v: Date | string): string {
  return typeof v === "string" ? v.slice(0, 10) : diaISO(v);
}

// ---------------------------------------------------------------------------
// API (fetch)
// ---------------------------------------------------------------------------
async function fetchTasasDesdeAPI(): Promise<Record<string, number>> {
  const res = await fetch(FX_API_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo obtener las cotizaciones (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { rates?: Record<string, number> };
  if (!json.rates) throw new Error("La API de cotizaciones no devolvió tasas");
  return json.rates;
}

/** 1 unidad de `origen` = X unidades de `destino` (las tasas de la API son base USD). */
async function tasaDesdeAPI(origen: Moneda, destino: Moneda): Promise<number> {
  const rates = await fetchTasasDesdeAPI();
  const rOrigen = rates[origen.codigoISO];
  const rDestino = rates[destino.codigoISO];
  if (rOrigen === undefined || rDestino === undefined) {
    throw new Error(
      `La API no tiene tasa para ${origen.codigoISO} o ${destino.codigoISO}`
    );
  }
  return rDestino / rOrigen;
}

// ---------------------------------------------------------------------------
// Persistencia (caché diario en `cotizacion`)
// ---------------------------------------------------------------------------
/** Cierra la cotización vigente (fechaFinal NULL) de un par. */
async function cerrarVigente(
  em: EntityManager,
  origenId: number,
  destinoId: number,
  hasta: Date
): Promise<void> {
  await em
    .createQueryBuilder()
    .update(Cotizacion)
    .set({ fechaFinal: hasta })
    .where(
      '"monedaOrigenId" = :o AND "monedaDestinoId" = :d AND "fechaFinal" IS NULL AND "eliminado" = false',
      { o: origenId, d: destinoId }
    )
    .execute();
}

/** Abre (o actualiza) la cotización vigente de un par para la fecha. */
async function abrirVigente(
  em: EntityManager,
  origen: Moneda,
  destino: Moneda,
  fecha: Date,
  tasa: number
): Promise<void> {
  const repo = em.getRepository(Cotizacion);
  const yaVigente = await repo.findOne({
    where: {
      monedaOrigen: { id: origen.id },
      monedaDestino: { id: destino.id },
      fechaFinal: IsNull(),
      eliminado: false,
    },
  });
  if (yaVigente) {
    yaVigente.fechaInicial = fecha;
    yaVigente.cotizacion = tasa;
    await repo.save(yaVigente);
  } else {
    await repo.save(
      repo.create({
        fechaInicial: fecha,
        fechaFinal: null,
        cotizacion: tasa,
        monedaOrigen: { id: origen.id } as Moneda,
        monedaDestino: { id: destino.id } as Moneda,
        usuario: null,
        eliminado: false,
      })
    );
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
/**
 * Tasa direccional origen→destino para una fecha.
 *
 * Política de refresco (2026-08-10):
 * - El PRIMER pedido del día (independiente del usuario; las cotizaciones son
 *   globales) y SOLO si ya pasó la apertura del mercado de divisas (hora de
 *   Argentina, `FX_MARKET_OPEN_HOUR`, default 10) consulta la API. Si trae
 *   resultados: cierra el período anterior y crea el nuevo (vigente).
 * - Los pedidos siguientes dentro del mismo día usan el registro existente.
 * - Fecha pasada sin registro / fallo de API → última cotización guardada.
 */
export async function getTasa(
  origen: Moneda,
  destino: Moneda,
  fecha: Date,
  manager?: EntityManager
): Promise<number> {
  if (origen.id === destino.id) return 1;
  const em = manager ?? (await getDb()).manager;
  const repo = em.getRepository(Cotizacion);
  // Normalización UTC-safe: `new Date("YYYY-MM-DD")` se parsea como medianoche
  // UTC y en zonas con offset negativo (p. ej. GMT-4) caería en el día anterior.
  // Se reconstruye como mediodía LOCAL usando los getters UTC.
  const f = new Date(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
    12,
    0,
    0
  );

  // Vigente (abierta) del par.
  const vigente = await repo.findOne({
    where: {
      monedaOrigen: { id: origen.id },
      monedaDestino: { id: destino.id },
      usuario: IsNull(),
      eliminado: false,
      fechaFinal: IsNull(),
    },
    order: { fechaInicial: "DESC" },
  });

  // FECHA PASADA (histórico): fila que cubre `f`, o la vigente como fallback.
  if (!esMismoDia(f, new Date())) {
    const historica = await repo.findOne({
      where: [
        {
          monedaOrigen: { id: origen.id },
          monedaDestino: { id: destino.id },
          usuario: IsNull(),
          eliminado: false,
          fechaInicial: LessThanOrEqual(f),
          fechaFinal: IsNull(),
        },
        {
          monedaOrigen: { id: origen.id },
          monedaDestino: { id: destino.id },
          usuario: IsNull(),
          eliminado: false,
          fechaInicial: LessThanOrEqual(f),
          fechaFinal: MoreThanOrEqual(f),
        },
      ],
      order: { fechaInicial: "DESC" },
    });
    if (historica) return Number(historica.cotizacion);
    if (vigente) return Number(vigente.cotizacion);
    throw new Error(
      `No hay cotización para ${origen.codigoISO}→${destino.codigoISO} en la fecha ${diaISO(f)}`
    );
  }

  // ES HOY.
  // 1) La vigente ya se creó HOY → pedidos siguientes del día usan el registro.
  if (vigente && diaDeRegistro(vigente.fechaInicial) === diaISO(new Date())) {
    return Number(vigente.cotizacion);
  }

  // 2) PRIMER pedido del día (vigente de otro día o inexistente).
  //    Solo consultar la API si ya pasó la apertura del mercado de divisas.
  if (mercadoAbierto()) {
    try {
      const tasa = await tasaDesdeAPI(origen, destino);
      if (vigente) {
        await cerrarVigente(
          em,
          origen.id,
          destino.id,
          new Date(f.getTime() - 86400000)
        );
      }
      await abrirVigente(em, origen, destino, f, tasa);
      return tasa;
    } catch (apiError) {
      // Fallback: última cotización guardada.
      if (vigente) return Number(vigente.cotizacion);
      const ultima = await repo.findOne({
        where: {
          monedaOrigen: { id: origen.id },
          monedaDestino: { id: destino.id },
          usuario: IsNull(),
          eliminado: false,
        },
        order: { fechaInicial: "DESC" },
      });
      if (ultima) return Number(ultima.cotizacion);
      throw new Error(
        `No se pudo obtener la cotización ${origen.codigoISO}→${destino.codigoISO}: ${(apiError as Error).message}`
      );
    }
  }

  // 3) Antes de la apertura del mercado → usar la última disponible.
  if (vigente) return Number(vigente.cotizacion);
  const ultimaAntes = await repo.findOne({
    where: {
      monedaOrigen: { id: origen.id },
      monedaDestino: { id: destino.id },
      usuario: IsNull(),
      eliminado: false,
    },
    order: { fechaInicial: "DESC" },
  });
  if (ultimaAntes) return Number(ultimaAntes.cotizacion);

  // Sin datos y antes de la apertura → consultar igual (no hay alternativa).
  try {
    const tasa = await tasaDesdeAPI(origen, destino);
    await abrirVigente(em, origen, destino, f, tasa);
    return tasa;
  } catch (apiError) {
    throw new Error(
      `No se pudo obtener la cotización ${origen.codigoISO}→${destino.codigoISO}: ${(apiError as Error).message}`
    );
  }
}

/** Convierte un monto de `origen` a `destino` para la fecha. */
export async function convertir(
  monto: number,
  origen: Moneda | undefined,
  destino: Moneda | undefined,
  fecha: Date,
  manager?: EntityManager
): Promise<number> {
  if (!origen || !destino) return monto;
  if (origen.id === destino.id) return monto;
  const tasa = await getTasa(origen, destino, fecha, manager);
  return redondear(monto * tasa);
}

/**
 * Monto de un movimiento en la moneda predeterminada del usuario autenticado.
 * `monto` está en la moneda de la cuenta (`cuentaId`). Si ambas monedas
 * coinciden devuelve el monto sin cambios (sin llamada a la API).
 */
export async function montoEnMonedaPredeterminada(
  cuentaId: number,
  monto: number,
  fecha: Date
): Promise<number> {
  const sesion = await getSessionUser();
  const predeterminada = sesion?.monedaPredeterminada;
  if (!predeterminada) return monto;
  const ds = await getDb();
  const cuenta = await ds.getRepository(Cuenta).findOne({
    where: { id: cuentaId },
    relations: { moneda: true },
  });
  if (!cuenta?.moneda) return monto;
  return convertir(monto, cuenta.moneda, predeterminada, fecha);
}

/**
 * Refresca (o crea) la cotización vigente de un par consultando la API ahora.
 * Usado por el panel admin ("cerrar vigente + re-consultar a la API").
 */
export async function refrescarCotizacion(
  monedaOrigenId: number,
  monedaDestinoId: number
): Promise<number> {
  const ds = await getDb();
  const em = ds.manager;
  const repo = em.getRepository(Moneda);
  const origen = await repo.findOneBy({ id: monedaOrigenId });
  const destino = await repo.findOneBy({ id: monedaDestinoId });
  if (!origen || !destino) {
    throw new Error("Moneda origen/destino no encontrada");
  }
  const hoy = new Date();
  const tasa = await tasaDesdeAPI(origen, destino);
  await cerrarVigente(em, origen.id, destino.id, new Date(hoy.getTime() - 86400000));
  await abrirVigente(em, origen, destino, hoy, tasa);
  return tasa;
}
