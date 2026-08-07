// Migración de datos: SQL Server → PostgreSQL (finanzas_pg_dev)
// Conserva IDs (integridad referencial), es idempotente (TRUNCATE previo) y
// sincroniza las secuencias SERIAL.
// Uso: node --env-file=.env.local backend/scripts/migrate-to-pg.mjs
// Fuente por defecto: DB_NAME (.env). Se puede elegir otra con DB_SOURCE=<bd>.
// Las tablas con `usuarioId` (multiusuario) se rellenan con el usuario ADMIN
// actual de la tabla `usuario` (la tabla `usuario` NO se toca).
import pkg from "mssql";
import pg from "pg";
const { ConnectionPool } = pkg;
const { Client } = pg;

const SRC_DB = process.env.DB_SOURCE ?? process.env.DB_NAME;

// Orden de dependencias: padres antes que hijos
const TABLES = [
  "concepto",
  "tipo_cuenta",
  "moneda",
  "persona",
  "categoria_gasto",
  "periodo_gasto",
  "trabajo",
  "tarjeta",
  "cuenta",            // tipo, moneda
  "cotizacion",        // moneda
  "inflacion",         // moneda
  "periodo_tarjeta",   // tarjeta
  "gasto",             // periodo_gasto, categoria_gasto
  "periodo_trabajo",   // trabajo
  "prestamo",          // personaOrigen/personaDestino, cuenta
  "jornada_trabajo",   // periodo_trabajo
  "movimiento",        // concepto, cuenta, prestamo, gasto
  "historico_cuenta",  // cuenta, movimiento
  "movimiento_tarjeta",// tarjeta, persona, periodo_tarjeta
];

const msCfg = {
  server: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: SRC_DB,
  port: Number(process.env.DB_PORT),
  options: { trustServerCertificate: true },
};

const pgCfg = {
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
};

// Columnas `date` → 'YYYY-MM-DD' (componentes UTC, como las devuelve mssql)
function fmtDate(v) {
  return v instanceof Date ? v.toISOString().split("T")[0] : v;
}

async function main() {
  const ms = await new ConnectionPool(msCfg).connect();
  const pgc = new Client(pgCfg);
  await pgc.connect();

  // 0) Usuario ADMIN actual (para el backfill de usuarioId) + tablas que lo requieren
  const adminRes = await pgc.query(
    `SELECT id FROM usuario WHERE "esAdmin" = true AND eliminado = false ORDER BY id LIMIT 1`
  );
  if (adminRes.rows.length === 0) {
    throw new Error("No hay usuario admin en la tabla usuario (imposible backfill usuarioId)");
  }
  const ADMIN_ID = adminRes.rows[0].id;
  console.log(`✅ Usuario admin para backfill de usuarioId: ${ADMIN_ID}`);

  const { rows: uidTables } = await pgc.query(
    `SELECT table_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name='usuarioId'`
  );
  const withUsuarioId = new Set(uidTables.map((r) => r.table_name));

  // 1) TRUNCATE (idempotente) — la tabla `usuario` NO está en TABLES y no se toca
  const rev = [...TABLES].reverse();
  await pgc.query(
    `TRUNCATE TABLE ${rev.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
  console.log("✅ PostgreSQL truncado (tabla usuario intacta)");

  // 2) Migrar tabla por tabla
  let total = 0;
  const report = [];
  for (const table of TABLES) {
    const res = await ms.request().query(`SELECT * FROM ${table}`);
    const rows = res.recordset;
    if (rows.length === 0) {
      report.push({ table, sql: 0 });
      console.log(`  ${table}: 0 filas (omitida)`);
      continue;
    }
    const cols = res.recordset.columns;
    const colNames = Object.keys(cols);
    const hasUid = withUsuarioId.has(table);
    for (const row of rows) {
      const values = colNames.map((c) => {
        const meta = cols[c];
        const v = row[c];
        if (v === null || v === undefined) return null;
        if (meta.type.declaration === "date" && v instanceof Date) return fmtDate(v);
        if (v instanceof Date) return v.toISOString(); // datetime → UTC ISO
        return v;
      });
      let ph = colNames.map((_, i) => `$${i + 1}`).join(", ");
      let qc = colNames.map((c) => `"${c}"`).join(", ");
      if (hasUid) {
        values.push(ADMIN_ID);
        ph += `, $${colNames.length + 1}`;
        qc += `, "usuarioId"`;
      }
      await pgc.query(`INSERT INTO "${table}" (${qc}) VALUES (${ph})`, values);
    }
    report.push({ table, sql: rows.length });
    total += rows.length;
    console.log(`  ${table}: ${rows.length} filas${hasUid ? " (+usuarioId=" + ADMIN_ID + ")" : ""}`);
  }

  // 3) Sincronizar secuencias SERIAL
  for (const table of TABLES) {
    try {
      const { rows } = await pgc.query(
        `SELECT pg_get_serial_sequence('${table}', 'id') AS seq`
      );
      if (rows[0].seq) {
        await pgc.query(
          `SELECT setval($1, (SELECT COALESCE(MAX(id), 1) FROM "${table}"))`,
          [rows[0].seq]
        );
      }
    } catch {
      /* tabla sin secuencia (PK uuid) */
    }
  }
  console.log("✅ Secuencias sincronizadas");

  // 4) Verificación: conteos SQL vs PG
  console.log("\n=== VERIFICACIÓN DE CONTEOS ===");
  for (const r of report) {
    const { rows } = await pgc.query(`SELECT COUNT(*)::int AS n FROM "${r.table}"`);
    const ok = rows[0].n === r.sql;
    console.log(`  ${ok ? "✅" : "❌"} ${r.table}: SQL=${r.sql} PG=${rows[0].n}`);
  }

  // 5) Verificación de fechas (posible desfase por zona horaria)
  console.log("\n=== VERIFICACIÓN DE FECHAS ===");
  const msd = await ms.request().query(
    `SELECT CONVERT(varchar(10), MIN(fecha), 23) AS mn, CONVERT(varchar(10), MAX(fecha), 23) AS mx FROM movimiento`
  );
  const pgd = await pgc.query(
    `SELECT MIN(fecha)::text AS mn, MAX(fecha)::text AS mx FROM movimiento`
  );
  console.log(
    `  movimiento fecha: SQL ${msd.recordset[0].mn} → ${msd.recordset[0].mx} | PG ${pgd.rows[0].mn} → ${pgd.rows[0].mx}`
  );
  const msh = await ms.request().query(
    `SELECT CONVERT(varchar(19), MIN(fechaDesde), 120) AS mn, CONVERT(varchar(19), MAX(fechaDesde), 120) AS mx FROM historico_cuenta`
  );
  const pgh = await pgc.query(
    `SELECT MIN("fechaDesde")::text AS mn, MAX("fechaDesde")::text AS mx FROM historico_cuenta`
  );
  console.log(
    `  historico_cuenta fechaDesde: SQL ${msh.recordset[0].mn} → ${msh.recordset[0].mx} | PG ${pgh.rows[0].mn} → ${pgh.rows[0].mx}`
  );

  // 6) Valor conocido: saldo de la cuenta 10 (Truist USD = 1011.79)
  const saldo = await pgc.query(`SELECT saldo FROM cuenta WHERE id = 10`);
  console.log(
    `  cuenta 10 saldo PG: ${saldo.rows[0]?.saldo} (esperado 1011.79)`
  );

  await ms.close();
  await pgc.end();
  console.log(`\n✅ Migración completa: ${total} filas`);
}

main().catch((e) => {
  console.error("❌ Error de migración:", e);
  process.exit(1);
});
