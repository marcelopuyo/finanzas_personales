// Seed del usuario ADMIN (id=1) — a este usuario se le asignan los datos
// existentes durante la migración multiusuario (Paso 5).
// Uso: node --env-file=.env.local backend/scripts/seed-admin.mjs
// Opcional: ADMIN_EMAIL y ADMIN_PASSWORD para sobreescribir los defaults de dev.
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@finanzas.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";

async function main() {
  const exists = await pool.query(
    "SELECT id, \"esAdmin\" FROM usuario WHERE email = $1",
    [EMAIL]
  );
  if (exists.rowCount > 0) {
    const row = exists.rows[0];
    if (row.esAdmin) {
      console.log(`Admin ya existe (id ${row.id}).`);
    } else {
      await pool.query("UPDATE usuario SET \"esAdmin\" = true WHERE id = $1", [row.id]);
      console.log(`Admin existente marcado como administrador (id ${row.id}).`);
    }
    await pool.end();
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  const r = await pool.query(
    `INSERT INTO usuario (email, "passwordHash", nombre, "emailVerificado", activo, "esAdmin")
     VALUES ($1, $2, 'Admin', true, true, true)
     RETURNING id, email, "esAdmin"`,
    [EMAIL, hash]
  );
  console.log("Admin creado:", JSON.stringify(r.rows[0]));
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
