// Prueba de conectividad a SQL Server (Fase 0)
// Uso: node --env-file=.env.local backend/scripts/test-db.mjs
import pkg from "mssql";
const { ConnectionPool } = pkg;

const config = {
  server: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  options: { trustServerCertificate: true },
};

async function main() {
  console.log(`Conectando a ${config.server}\\${config.database} ...`);
  const pool = await new ConnectionPool(config).connect();
  const result = await pool
    .request()
    .query("SELECT DB_NAME() AS db, @@VERSION AS version");
  console.log("✅ Conexión exitosa a SQL Server");
  console.log("Base de datos:", result.recordset[0].db);
  console.log("Versión:", result.recordset[0].version.split("\n")[0]);
  await pool.close();
}

main().catch((err) => {
  console.error("❌ Error de conexión:", err.message);
  process.exit(1);
});
