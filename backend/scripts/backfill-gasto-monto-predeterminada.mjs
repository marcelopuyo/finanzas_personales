import pg from "pg";

// Backfill: gastos creados/pagados desde una cuenta de OTRA moneda quedaron con
// `monto`/`saldo` en la MONEDA DE LA CUENTA (sin convertir), mientras que
// `movimiento.monto` sí quedó convertido a la moneda predeterminada del usuario.
//
// Regla de detección (idempotente): un gasto está "sin convertir" si su
// `monto` guardado == `montoCuentaMonedaOrigen` de su primer pago activo
// (o sea, se guardó el valor de la cuenta) y ese pago tuvo conversión
// (`monto <> montoCuentaMonedaOrigen`).
//
// Corrección: `monto` = monto convertido del primer pago; `saldo` se recalcula
// como monto - total pagado (ambos en moneda predeterminada).
//
// Uso: node --env-file=.env.local backend/scripts/backfill-gasto-monto-predeterminada.mjs
const c = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

await c.connect();

const res = await c.query(`
  SELECT g.id,
         g.monto AS monto_actual,
         g.saldo AS saldo_actual,
         primer.monto_convertido,
         primer.monto_cuenta,
         COALESCE(pagado.total_convertido, 0) AS total_convertido
  FROM gasto g
  LEFT JOIN LATERAL (
    SELECT mv.monto AS monto_convertido,
           mv."montoCuentaMonedaOrigen" AS monto_cuenta
    FROM movimiento mv
    WHERE mv."gastoId" = g.id AND mv.eliminado = false
    ORDER BY mv.fecha ASC, mv.id ASC
    LIMIT 1
  ) primer ON true
  LEFT JOIN LATERAL (
    SELECT SUM(mv.monto) AS total_convertido
    FROM movimiento mv
    WHERE mv."gastoId" = g.id AND mv.eliminado = false
  ) pagado ON true
  WHERE g.eliminado = false
`);

let actualizados = 0;
for (const r of res.rows) {
  const montoActual = Number(r.monto_actual);
  const montoCuenta = r.monto_cuenta === null ? null : Number(r.monto_cuenta);
  const montoConvertido =
    r.monto_convertido === null ? null : Number(r.monto_convertido);
  // Sin pago o sin conversión → nada que corregir.
  if (montoCuenta === null || montoConvertido === null) continue;
  // ¿Guardado sin convertir? → monto guardado == monto de la cuenta del pago.
  if (montoActual === montoCuenta && montoCuenta !== montoConvertido) {
    const nuevoSaldo = Number(
      (montoConvertido - Number(r.total_convertido)).toFixed(2)
    );
    await c.query(`UPDATE gasto SET monto = $1, saldo = $2 WHERE id = $3`, [
      montoConvertido,
      nuevoSaldo,
      r.id,
    ]);
    console.log(
      `Gasto ${r.id}: monto ${montoActual} → ${montoConvertido} | saldo ${r.saldo_actual} → ${nuevoSaldo}`
    );
    actualizados++;
  }
}
console.log(`\nGastos corregidos: ${actualizados}`);
await c.end();
