// ⚠️ TEMPORAL de QA — BORRAR antes de commitear.
import pg from "pg";

const c = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

console.log("=== historico_cuenta de la cuenta 1 desde hoy ===");
console.log(
  await q(
    `select id, "fechaDesde", saldo, "movimientoId", eliminado
     from historico_cuenta
     where "cuentaId" = $1 and "fechaDesde" >= $2
     order by "fechaDesde"`,
    [1, "2026-09-24"]
  )
);

console.log("=== movimientos de la cuenta 1 desde hoy ===");
console.log(
  await q(
    `select id, fecha, monto, "montoCuentaMonedaOrigen", eliminado
     from movimiento
     where "cuentaId" = $1 and fecha >= $2
     order by fecha`,
    [1, "2026-09-24"]
  )
);

// ── Limpieza: el saldo quedó bajo por un bug preexistente de `eliminarGasto`
// (revierte con `mov.monto` —moneda del usuario— en vez de
// `mov.montoCuentaMonedaOrigen`, la moneda de la cuenta).
const SALDO_ORIGINAL = 454403.84;
console.log("=== limpieza ===");
const hist = await c.query(
  `delete from historico_cuenta
   where "cuentaId" = 1 and "fechaDesde" >= $1 returning id`,
  ["2026-09-24"]
);
console.log(`histórico de pruebas borrado: ${hist.rowCount} filas`);
await c.query(`update cuenta set saldo = $1 where id = 1`, [SALDO_ORIGINAL]);
console.log(await q(`select id, nombre, saldo from cuenta where id = 1`));

await c.end();
