// Configuración de SSL para la conexión PostgreSQL.
// Los proveedores cloud (Supabase, Neon, Render, etc.) exigen SSL; la BD local
// normalmente no. Se activa con la variable de entorno `PG_SSL=true`.
//
// Uso:
//   new DataSource({ ..., ssl: pgSslOption() })
// En local (sin PG_SSL) devuelve undefined → conexión sin SSL (como hasta ahora).
export function pgSslOption():
  | { rejectUnauthorized: false }
  | undefined {
  return process.env.PG_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;
}
