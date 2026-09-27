import pg from "pg";

/**
 * **Backfill de la Fase 1 del rediseño "períodos gestionados → liquidaciones"**
 * (`DeepSeek/plan-liquidaciones.md`, §6 Fase 1). Complementa a la migración
 * `1790200000000-AddMontoCobradoLiquidacion`, que sólo hizo DDL.
 *
 * Hace **dos** cosas, las dos **idempotentes**:
 *
 * 1. **`periodo_trabajo.montoCobrado`** (lo que realmente entró) para las filas históricas:
 *    - `exacto`      → la fila tiene un movimiento vivo vinculado (`movimiento.periodoTrabajoId`):
 *                      se copia `montoCuentaMonedaOrigen` (**nominal**, no el convertido).
 *    - `heuristico`  → sin vínculo (94 de 107 casos: cobros anteriores a esa migración): se busca
 *                      **un** movimiento "Cobro Sueldo" **sin período**, del **mismo usuario**, con
 *                      fecha a **±1 día** de `fechaDeCobro`. Sólo se asigna si ese movimiento
 *                      matchea **un único** período (si es ambiguo, se descarta).
 *    - `asumido`     → no hay forma de saberlo ⇒ `montoCobrado = montoCalculado` (documentado).
 *      Los períodos **sin cobrar** quedan con `montoCobrado = NULL` (después se disuelven, punto 2).
 * 2. **Disolución de los períodos SIN fecha de cobro**: en el modelo nuevo la liquidación **nace
 *    al cobrar**, así que una fila sin cobro no existe: se **liberan sus ítems**
 *    (`periodoTrabajoId = NULL` ⇒ vuelven a "pendientes") y se **soft-deletea** el período.
 *    Antes de soltar el vínculo, cada ítem **hereda el `trabajoId` del período** (si la columna
 *    ya existe): un ítem pendiente tiene que poder responder a qué trabajo pertenece, porque de
 *    eso dependen el paso "Cobrar trabajo" y la tarjeta "Por cobrar" (hueco detectado en R2).
 *    ⚠️ Los ítems liberados dejan de sumar al panel de ingresos hasta que se cobren (comportamiento
 *    buscado: el panel cuenta ítems **cobrados**).
 *
 * ⚠️ **Orden de despliegue**: primero las migraciones (`1790200000000` y `1790300000000`) y recién
 * después este script; si no, los ítems liberados quedarían sin trabajo (el script lo avisa).
 *
 * ⚠️ El `down` de la migración **no** reconstruye la disolución: este script imprime el detalle
 * (ids de período e ids de ítems) para poder re-vincularlos a mano si hiciera falta.
 *
 * Uso:
 *   # informe, NO escribe nada (default)
 *   node --env-file=.env.local backend/scripts/backfill-liquidaciones.mjs
 *   # aplica los cambios
 *   node --env-file=.env.local backend/scripts/backfill-liquidaciones.mjs --apply
 */
const aplicar = process.argv.includes("--apply");

const c = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

await c.connect();

const dia = 86400000;
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const money = (n) => Number(n ?? 0).toFixed(2);

// ---------------------------------------------------------------------------
// 1. montoCobrado de los períodos COBRADOS que todavía lo tienen en NULL
// ---------------------------------------------------------------------------
const pendientes = (
  await c.query(`
    SELECT pt.id,
           pt."fechaDeCobro"   AS fecha_cobro,
           pt."montoCalculado" AS calculado,
           t."usuarioId"       AS uid
    FROM periodo_trabajo pt
    JOIN trabajo t ON t.id = pt."trabajoId"
    WHERE pt.eliminado = false
      AND pt."fechaDeCobro" >= DATE '1901-01-02'
      AND pt."montoCobrado" IS NULL
    ORDER BY pt.id
  `)
).rows;

// Movimientos vivos vinculados a un período (fuente exacta). `n` > 1 = ambiguo.
const vinculados = new Map(
  (
    await c.query(`
      SELECT "periodoTrabajoId" AS pid,
             COUNT(*)                                    AS n,
             MIN("montoCuentaMonedaOrigen")              AS monto
      FROM movimiento
      WHERE eliminado = false AND "periodoTrabajoId" IS NOT NULL
      GROUP BY 1
    `)
  ).rows.map((r) => [Number(r.pid), { n: Number(r.n), monto: Number(r.monto) }])
);

// Candidatos heurísticos: movimientos "Cobro Sueldo" que NO tienen período asignado.
const candidatos = (
  await c.query(`
    SELECT mv.id,
           cu."usuarioId"                AS uid,
           mv.fecha                      AS fecha,
           mv."montoCuentaMonedaOrigen"  AS monto
    FROM movimiento mv
    JOIN concepto c  ON c.id = mv."conceptoId"
    JOIN cuenta cu   ON cu.id = mv."cuentaId"
    WHERE mv.eliminado = false
      AND c.nombre = 'Cobro Sueldo'
      AND mv."periodoTrabajoId" IS NULL
    ORDER BY mv.id
  `)
).rows;

const asignaciones = [];
for (const p of pendientes) {
  const exacto = vinculados.get(Number(p.id));
  if (exacto && exacto.n === 1) {
    asignaciones.push({ id: p.id, fuente: "exacto", monto: exacto.monto, calculado: Number(p.calculado), fecha: iso(p.fecha_cobro) });
    continue;
  }
  const mias = candidatos.filter(
    (m) => Number(m.uid) === Number(p.uid) && Math.abs(new Date(m.fecha) - new Date(p.fecha_cobro)) <= dia
  );
  // El movimiento tiene que matchear UN ÚNICO período (si no, no se puede atribuir).
  const unico =
    mias.length === 1 &&
    pendientes.filter(
      (q) =>
        Number(q.uid) === Number(p.uid) &&
        Math.abs(new Date(mias[0].fecha) - new Date(q.fecha_cobro)) <= dia
    ).length === 1;
  asignaciones.push(
    unico
      ? { id: p.id, fuente: "heuristico", monto: Number(mias[0].monto), calculado: Number(p.calculado), fecha: iso(p.fecha_cobro) }
      : {
          id: p.id,
          fuente: mias.length ? "ambiguo" : "asumido",
          monto: Number(p.calculado),
          calculado: Number(p.calculado),
          fecha: iso(p.fecha_cobro),
        }
  );
}

// ---------------------------------------------------------------------------
// 2. Períodos SIN fecha de cobro ⇒ se disuelven (liberar ítems + soft-delete)
// ---------------------------------------------------------------------------
const sinCobro = (
  await c.query(`
    SELECT pt.id,
           pt."trabajoId" AS trabajo_id,
           pt."fechaDesde" AS desde,
           pt."fechaHasta" AS hasta,
           pt."montoCalculado" AS calculado,
           (SELECT COUNT(*) FROM jornada_trabajo j WHERE j."periodoTrabajoId" = pt.id) AS jornadas,
           (SELECT COUNT(*) FROM tarea_trabajo   t WHERE t."periodoTrabajoId" = pt.id) AS tareas,
           (SELECT COALESCE(SUM(j."montoJornada"), 0) FROM jornada_trabajo j
              WHERE j."periodoTrabajoId" = pt.id AND j.eliminado = false) AS monto_jornadas
    FROM periodo_trabajo pt
    WHERE pt.eliminado = false AND pt."fechaDeCobro" IS NULL
    ORDER BY pt.id
  `)
).rows;

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
const porFuente = asignaciones.reduce((acc, a) => {
  acc[a.fuente] = (acc[a.fuente] ?? 0) + 1;
  return acc;
}, {});
const conDiferencia = asignaciones.filter((a) => Math.abs(a.monto - a.calculado) > 0.005);

console.log(`\n=== montoCobrado (periodos cobrados sin el dato) ===`);
console.log(`Total a completar: ${asignaciones.length}`);
for (const f of ["exacto", "heuristico", "ambiguo", "asumido"]) {
  if (porFuente[f]) console.log(`  ${f.padEnd(11)} ${porFuente[f]}`);
}
if (conDiferencia.length) {
  console.log(`\nCon diferencia entre calculado y cobrado (${conDiferencia.length}):`);
  for (const a of conDiferencia) {
    console.log(`  #${a.id} ${a.fecha} [${a.fuente}] calculado ${money(a.calculado)} -> cobrado ${money(a.monto)} (dif ${money(a.monto - a.calculado)})`);
  }
}

console.log(`\n=== periodos SIN fecha de cobro (se disuelven) ===`);
console.log(`Total: ${sinCobro.length}`);
for (const p of sinCobro) {
  console.log(
    `  #${p.id} ${iso(p.desde)} -> ${iso(p.hasta)} | calculado ${money(p.calculado)} | ` +
      `liberando ${p.jornadas} jornadas / ${p.tareas} tareas (Sum jornadas ${money(p.monto_jornadas)})`
  );
}

if (!aplicar) {
  console.log(`\n(!) INFORME SOLO - no se escribio nada. Para aplicar: --apply\n`);
  await c.end();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------
/**
 * ¿Existe ya la columna `trabajoId` en los ítems? (migración
 * `1790300000000-AddTrabajoIdItems`). Si no está, el script igual disuelve, pero
 * avisa: los ítems liberados quedarían **sin trabajo** (hueco R2).
 */
const tieneTrabajoId =
  (
    await c.query(`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
       WHERE table_name IN ('jornada_trabajo', 'tarea_trabajo')
         AND column_name = 'trabajoId'`)
  ).rows[0].n === 2;
if (!tieneTrabajoId) {
  console.log(
    `\n(!) ATENCION: los items no tienen la columna trabajoId (falta la migracion\n` +
      `    1790300000000-AddTrabajoIdItems). Los items liberados quedaran SIN trabajo.\n`
  );
}

await c.query("BEGIN");
let escritos = 0;
for (const a of asignaciones) {
  await c.query(`UPDATE periodo_trabajo SET "montoCobrado" = $1 WHERE id = $2`, [a.monto, a.id]);
  escritos++;
}
let disueltos = 0;
for (const p of sinCobro) {
  // El ítem hereda el TRABAJO del período ANTES de perder el vínculo: un ítem
  // pendiente tiene que poder responder a qué trabajo pertenece (si no, ni el
  // paso "Cobrar trabajo" ni la tarjeta "Por cobrar" pueden agruparlo).
  if (tieneTrabajoId && p.trabajo_id != null) {
    await c.query(
      `UPDATE jornada_trabajo SET "trabajoId" = $1 WHERE "periodoTrabajoId" = $2 AND "trabajoId" IS NULL`,
      [p.trabajo_id, p.id]
    );
    await c.query(
      `UPDATE tarea_trabajo SET "trabajoId" = $1 WHERE "periodoTrabajoId" = $2 AND "trabajoId" IS NULL`,
      [p.trabajo_id, p.id]
    );
  }
  await c.query(`UPDATE jornada_trabajo SET "periodoTrabajoId" = NULL WHERE "periodoTrabajoId" = $1`, [p.id]);
  await c.query(`UPDATE tarea_trabajo   SET "periodoTrabajoId" = NULL WHERE "periodoTrabajoId" = $1`, [p.id]);
  await c.query(`UPDATE periodo_trabajo SET eliminado = true WHERE id = $1`, [p.id]);
  disueltos++;
}
await c.query("COMMIT");

console.log(`\nOK - Aplicado: montoCobrado en ${escritos} periodos, ${disueltos} periodos disueltos.`);
console.log(`   (los items liberados quedan "pendientes de liquidar" y se cobran desde la UI)\n`);
await c.end();
