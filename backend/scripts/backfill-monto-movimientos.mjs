import pg from "pg";

// Corrección del backfill de `movimiento.monto` para los movimientos existentes.
// La migración `AddMontoCuentaMovimiento` seteó `montoCuentaMonedaOrigen = monto`
// (tasa 1). `montoCuentaMonedaOrigen` (moneda de la cuenta) quedó correcto, pero
// `monto` (moneda predeterminada del usuario) debe quedar CONVERTIDO con la
// cotización USD/ARS de hoy (vigente o la más reciente guardada).
//
// Idempotente: recalcula `monto` siempre desde `montoCuentaMonedaOrigen`.
const c = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

await c.connect();

// ---- Tasa ARS→USD (vigente o la más reciente guardada) ----
const tasaRes = await c.query(
  `SELECT c.cotizacion, c."fechaInicial", c."fechaFinal"
   FROM cotizacion c
   JOIN moneda mo ON mo.id = c."monedaOrigenId"
   JOIN moneda md ON md.id = c."monedaDestinoId"
   WHERE mo."codigoISO" = 'ARS' AND md."codigoISO" = 'USD'
     AND c."usuarioId" IS NULL AND c.eliminado = false
   ORDER BY (c."fechaFinal" IS NULL) DESC, c."fechaInicial" DESC
   LIMIT 1`
);
if (tasaRes.rowCount === 0) {
  throw new Error("No hay cotización ARS→USD guardada. Refrescá una en /admin/cotizaciones y volvé a correr.");
}
const tasa = Number(tasaRes.rows[0].cotizacion);
console.log("Tasa ARS→USD usada:", tasa, "| vigente:", tasaRes.rows[0].fechaFinal === null);

// ---- Movimientos con moneda de cuenta y moneda predeterminada del usuario ----
const movs = await c.query(
  `SELECT m.id, m."montoCuentaMonedaOrigen",
          mcm."codigoISO" AS "cuentaISO",
          um."codigoISO" AS "usuarioISO"
   FROM movimiento m
   JOIN cuenta c ON c.id = m."cuentaId"
   JOIN moneda mcm ON mcm.id = c."monedaId"
   JOIN usuario u ON u.id = c."usuarioId"
   JOIN moneda um ON um.id = u."monedaPredeterminadaId"
   WHERE m.eliminado = false`
);
console.log("Total movimientos activos:", movs.rowCount);

let actualizados = 0;
let sinCambio = 0;
let sinConvertir = 0;
for (const m of movs.rows) {
  const base = Number(m.montoCuentaMonedaOrigen);
  let nuevo;
  if (m.cuentaISO === m.usuarioISO) {
    nuevo = base; // misma moneda → sin conversión
    sinCambio++;
  } else if (m.cuentaISO === "ARS" && m.usuarioISO === "USD") {
    nuevo = Math.round(base * tasa * 100) / 100;
    actualizados++;
  } else if (m.cuentaISO === "USD" && m.usuarioISO === "ARS") {
    nuevo = Math.round((base / tasa) * 100) / 100;
    actualizados++;
  } else {
    console.log("  ⚠️ par sin conversión:", m.cuentaISO, "→", m.usuarioISO, "(id", m.id + ")");
    sinConvertir++;
    continue;
  }
  if (nuevo !== base) {
    await c.query(`UPDATE movimiento SET monto = $1 WHERE id = $2`, [nuevo, m.id]);
  }
}

console.log("Actualizados (conversión):", actualizados);
console.log("Sin cambios (misma moneda):", sinCambio);
console.log("Sin conversión (par desconocido):", sinConvertir);

await c.end();
