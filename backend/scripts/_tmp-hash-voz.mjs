// 🧪 TEMPORAL (2026-09-24) — hash del seed de DEV para comparar con PROD.
// Uso: node --env-file=.env.local backend/scripts/_tmp-hash-voz.mjs
import pg from "pg";

const client = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});
await client.connect();
const r = await client.query(
  `select count(*)::int as total,
          count(*) filter (where "usuarioId" is null)::int as sistema,
          count(distinct "destinoValor")::int as conceptos,
          md5(string_agg("ambito" || '|' || "terminoNorm" || '|' || "destinoValor", ','
              order by "ambito", "terminoNorm", "destinoValor")) as hash
     from voz_alias`
);
console.log("DEV " + JSON.stringify(r.rows[0]));
await client.end();
