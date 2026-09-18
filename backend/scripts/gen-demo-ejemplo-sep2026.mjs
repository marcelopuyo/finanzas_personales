// Genera SQL (a stdout y a backend/scripts/_demo_sep2026.sql) para CONTINUAR el
// set de datos de ejemplo del usuario 7 (PROD: ejemplo@finanzaspersonales.com) desde
// el 2026-08-10 (último dato cargado) hasta HOY 2026-09-16.
//
// NO conecta a la BD: solo emite SQL que luego se ejecuta (DEV con psql, PROD vía API).
//
// Diseño:
// - Idempotente: ON CONFLICT DO NOTHING / WHERE NOT EXISTS / valores absolutos.
// - Agnóstico del entorno: la base de saldo se toma de `cuenta.saldo` en runtime,
//   así el mismo SQL sirve para DEV y PROD.
// - Continúa el ritmo del demo: períodos mensuales de trabajo + jornadas, gastos
//   mensuales (alquiler/supermercado/servicios), extracción a Billetera, cuotas de
//   préstamos y el cobro de sueldos del 5 de cada mes.
// - `monto` (= moneda predeterminada del usuario, USD) se convierte con las
//   cotizaciones ARS→USD reales de la tabla `cotizacion` según la fecha.
// - `montoCuentaMonedaOrigen` queda en la moneda de la cuenta (ARS/USD).
// - El histórico de cuenta usa el saldo EN MONEDA DE LA CUENTA (igual que los datos
//   ya cargados): saldo nuevo = saldo base de la cuenta + Σ ±montoCuentaMonedaOrigen.
import { writeFileSync } from "node:fs";

const U = 7; // usuario "Prueba" / ejemplo
const PREFIX = "30000000-0000-4000-8000-"; // ids nuevos (10000000/20000000 ya usados)
const uuid = (i) => `${PREFIX}${String(i).padStart(12, "0")}`;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const D = (d) => (d == null ? "NULL" : `'${d}'`);
const N = (n) => String(n);

// ids del set original que se referencian
const G_ALQUILER_AGO = "10000000-0000-4000-8000-000000000018";
const G_INTERNET_AGO = "10000000-0000-4000-8000-000000000020";
const P_LAURA = "10000000-0000-4000-8000-000000000002";
const P_PEDRO = "10000000-0000-4000-8000-000000000003";

const cuentaId = (n) => `(SELECT id FROM cuenta WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const catId = (n) => `(SELECT id FROM categoria_gasto WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const trabId = (n) => `(SELECT id FROM trabajo WHERE nombre=${q(n)} AND "usuarioId"=${U})`;

// ── Cotizaciones ARS→USD reales (tabla `cotizacion`, monedaOrigenId=1 → Destino=2) ──
const RATES = [
  ["2026-08-05", 0.00066751],
  ["2026-08-11", 0.00066751],
  ["2026-08-13", 0.00067000],
  ["2026-08-27", 0.00066043],
  ["2026-09-02", 0.00066106],
  ["2026-09-04", 0.00066304],
  ["2026-09-07", 0.00066341],
  ["2026-09-09", 0.00066221],
  ["2026-09-10", 0.00066002],
  ["2026-09-11", 0.00066094],
  ["2026-09-12", 0.00066229],
];
const usd = (ars, fecha) => {
  let r = RATES[0][1];
  for (const [f, v] of RATES) if (f <= fecha) r = v;
  return Math.round(ars * r * 100) / 100;
};
const red = (n) => Math.round(n * 100) / 100;

// ============================== DATOS ==============================

// Gastos que quedaron PENDIENTES en agosto (ya existen) y que ahora se pagan.
const gastosAPagar = [
  { id: G_ALQUILER_AGO, desc: "Alquiler agosto", ars: 88000, fecha: "2026-08-05", cuenta: "Banco Nacion", cat: "Alquiler" },
  { id: G_INTERNET_AGO, desc: "Internet agosto", ars: 30000, fecha: "2026-08-20", cuenta: "Banco Nacion", cat: "Servicios" },
];

// Gastos nuevos (uuid 301+). `pago` ⇒ pagado (genera movimiento); `venc` ⇒ pendiente.
const gastos = [
  { i: 301, desc: "Combustible", ars: 26000, cat: "Transporte", pago: "2026-08-18", cuenta: "Billetera" },
  { i: 302, desc: "Supermercado", ars: 51000, cat: "Alimentacion", pago: "2026-08-25", cuenta: "Banco Nacion" },
  { i: 303, desc: "Alquiler", ars: 92000, cat: "Alquiler", pago: "2026-09-05", cuenta: "Banco Nacion" },
  { i: 304, desc: "Supermercado", ars: 42000, cat: "Alimentacion", pago: "2026-09-08", cuenta: "Billetera" },
  { i: 305, desc: "Luz", ars: 35000, cat: "Servicios", pago: "2026-09-15", cuenta: "Banco Nacion" },
  { i: 306, desc: "Farmacia", ars: 14000, cat: "Salud", pago: "2026-09-16", cuenta: "Billetera" },
  { i: 307, desc: "Internet", ars: 32000, cat: "Servicios", venc: "2026-09-20" }, // PENDIENTE
];

// Períodos de trabajo + jornadas. `cobro` null ⇒ período EN CURSO (sin cobrar).
const precioHoraDe = { "Dev Freelance": 18, "Cafe Express": 5000, "Clases Particulares": 1500 };
const cuentaCobroDe = { "Dev Freelance": "Banco Nacion USD", "Cafe Express": "Banco Nacion", "Clases Particulares": "Caja Principal" };
const periodos = [
  {
    id: 5200, trabajo: "Dev Freelance", desde: "2026-08-01", hasta: "2026-08-31",
    est: "2026-09-01", cobro: "2026-09-05",
    jornadas: [["2026-08-06", 9, 17], ["2026-08-13", 9, 17], ["2026-08-20", 9, 17], ["2026-08-27", 9, 17]],
  },
  {
    id: 5201, trabajo: "Cafe Express", desde: "2026-08-01", hasta: "2026-08-31",
    est: "2026-09-01", cobro: "2026-09-05",
    jornadas: [["2026-08-06", 8, 16], ["2026-08-13", 8, 16], ["2026-08-20", 8, 16], ["2026-08-27", 8, 16], ["2026-08-31", 8, 16]],
  },
  {
    id: 5202, trabajo: "Clases Particulares", desde: "2026-08-01", hasta: "2026-08-31",
    est: "2026-09-01", cobro: "2026-09-05",
    jornadas: [["2026-08-07", 10, 20], ["2026-08-14", 10, 20], ["2026-08-21", 10, 20], ["2026-08-28", 10, 20]],
  },
  {
    id: 5203, trabajo: "Dev Freelance", desde: "2026-09-01", hasta: "2026-09-30",
    est: "2026-10-01", cobro: null,
    jornadas: [["2026-09-03", 9, 17], ["2026-09-10", 9, 17]],
  },
  {
    id: 5204, trabajo: "Cafe Express", desde: "2026-09-01", hasta: "2026-09-30",
    est: "2026-10-01", cobro: null,
    jornadas: [["2026-09-03", 8, 16], ["2026-09-10", 8, 16]],
  },
  {
    id: 5205, trabajo: "Clases Particulares", desde: "2026-09-01", hasta: "2026-09-30",
    est: "2026-10-01", cobro: null,
    jornadas: [["2026-09-04", 10, 20], ["2026-09-11", 10, 20]],
  },
];

// montoACobrar de cada período = Σ jornadas (en la moneda de la cuenta de cobro)
periodos.forEach((p) => {
  const ph = precioHoraDe[p.trabajo];
  p.montoACobrar = red(p.jornadas.reduce((s, [, d, h]) => s + (h - d) * ph, 0));
});

// Inflación de septiembre (el demo cargaba una por mes).
const inflacionSep = { desde: "2026-09-01", hasta: "2026-09-30", indice: 2.6 };

// Cuotas de préstamos (mismo ritmo que las existentes: día 10 y 15).
const cuotasPrestamo = [
  { i: 401, fecha: "2026-08-10", concepto: 9, cuenta: "Banco Nacion", importe: 40000, prestamo: P_LAURA },
  { i: 402, fecha: "2026-08-15", concepto: 8, cuenta: "Banco Nacion", importe: 25000, prestamo: P_PEDRO },
  { i: 403, fecha: "2026-09-10", concepto: 9, cuenta: "Banco Nacion", importe: 40000, prestamo: P_LAURA },
  { i: 404, fecha: "2026-09-15", concepto: 8, cuenta: "Banco Nacion", importe: 25000, prestamo: P_PEDRO },
];
const saldoFinalPrestamos = [
  { id: P_LAURA, saldo: 40000 }, // 120000 - 2 cuotas de 40000
  { id: P_PEDRO, saldo: 175000 }, // 225000 - 2 cuotas de 25000
];

// Conceptos INGRESO (el resto son Egreso). De aca sale el signo del historico.
const CONCEPTOS_INGRESO = new Set([3, 4, 7, 9, 10, 12, 14, 16, 19, 21]);
const signoDe = (concepto) => (CONCEPTOS_INGRESO.has(concepto) ? 1 : -1);

// ============================== MOVIMIENTOS ==============================
// `importe`/`moneda` están en la moneda de la CUENTA (ARS o USD).
const movs = [];
const mov = (i, fecha, concepto, cuenta, importe, moneda, refCol, refVal) =>
  movs.push({ i, fecha, concepto, cuenta, importe, moneda, refCol, refVal });

let mv = 1;
// Pagos de los gastos que estaban pendientes (concepto 1 = Pago Gasto)
gastosAPagar.forEach((g) => mov(mv++, g.fecha, 1, g.cuenta, g.ars, "ARS", '"gastoId"', q(g.id)));
// Gastos nuevos pagados
gastos.filter((g) => g.pago).forEach((g) => mov(mv++, g.pago, 1, g.cuenta, g.ars, "ARS", '"gastoId"', q(uuid(g.i))));
// Cobro de sueldos (concepto 3) de los períodos de agosto
periodos.filter((p) => p.cobro).forEach((p) => mov(mv++, p.cobro, 3, cuentaCobroDe[p.trabajo], p.montoACobrar, p.trabajo === "Dev Freelance" ? "USD" : "ARS"));
// Cuotas de préstamos
cuotasPrestamo.forEach((c) => mov(mv++, c.fecha, c.concepto, c.cuenta, c.importe, "ARS", '"prestamoId"', q(c.prestamo)));
// Extracción mensual Banco Nacion → Billetera (conceptos 13/12)
mov(mv++, "2026-09-01", 13, "Banco Nacion", 40000, "ARS");
mov(mv++, "2026-09-01", 12, "Billetera", 40000, "ARS");

// Orden cronológico estable + hora por cuenta/día (para que el histórico quede ordenado).
// Mismo día: primero INGRESOS y después EGRESOS (así el saldo no queda negativo a mitad de día).
movs.sort((a, b) =>
  a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : signoDe(b.concepto) - signoDe(a.concepto) || a.i - b.i
);
const horaPorCuentaDia = {};
movs.forEach((m) => {
  const k = `${m.cuenta}|${m.fecha}`;
  horaPorCuentaDia[k] = (horaPorCuentaDia[k] ?? 0) + 1;
  m.hora = 8 + horaPorCuentaDia[k];
  m.montoUSD = m.moneda === "USD" ? m.importe : usd(m.importe, m.fecha);
});

// ============================== EMISIÓN SQL ==============================
const out = [];
out.push("-- ============================================================");
out.push("-- DEMO usuario 7 — continuación 2026-08-10 → 2026-09-16");
out.push("-- Idempotente y agnóstico de entorno (base de saldo = cuenta.saldo)");
out.push("-- ============================================================");

// ── 1) GASTOS PENDIENTES QUE SE PAGAN ──
out.push("\n-- ===== 1) GASTOS DE AGOSTO QUE ESTABAN PENDIENTES (se pagan) =====");
gastosAPagar.forEach((g) => {
  const cat = catId(g.cat);
  out.push(
    `UPDATE gasto SET monto = ${N(usd(g.ars, g.fecha))}, saldo = 0, "fechaPago" = ${D(g.fecha)}, "isPeriodico" = true\n` +
      ` WHERE id = ${q(g.id)} AND "usuarioId" = ${U} AND "fechaPago" IS NULL AND "categoriaId" = ${cat};`
  );
});

// ── 2) GASTOS NUEVOS ──
out.push("\n-- ===== 2) GASTOS NUEVOS (monto/saldo en USD; el pago usa la moneda de la cuenta) =====");
gastos.forEach((g) => {
  const pagado = !!g.pago;
  const montoUSD = usd(g.ars, g.pago ?? g.venc);
  out.push(
    `INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") ` +
      `VALUES (${q(uuid(g.i))}, ${q(g.desc)}, ${N(montoUSD)}, ${N(pagado ? 0 : montoUSD)}, ${D(g.venc ?? null)}, ${D(g.pago ?? null)}, ${pagado ? "true" : "false"}, false, ${catId(g.cat)}, ${U}) ` +
      `ON CONFLICT (id) DO NOTHING;`
  );
});

// ── 3) PERÍODOS DE TRABAJO ──
out.push("\n-- ===== 3) PERÍODOS DE TRABAJO (agosto cobrado el 05-09; septiembre EN CURSO) =====");
periodos.forEach((p) => {
  out.push(
    `INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") ` +
      `VALUES (${p.id}, ${D(p.desde)}, ${D(p.hasta)}, ${N(p.montoACobrar)}, ${D(p.est)}, ${D(p.cobro ?? null)}, false, ${trabId(p.trabajo)}) ` +
      `ON CONFLICT (id) DO NOTHING;`
  );
});

// ── 4) JORNADAS ──
out.push("\n-- ===== 4) JORNADAS =====");
periodos.forEach((p) => {
  const ph = precioHoraDe[p.trabajo];
  p.jornadas.forEach(([fecha, d, h]) => {
    out.push(
      `INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") ` +
        `SELECT ${D(fecha)}, ${D(fecha)}, ${N(d)}, ${N(h)}, ${N(red((h - d) * ph))}, 0, ${N(ph)}, false, ${p.id} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = ${p.id} AND j."fechaJornada" = ${D(fecha)});`
    );
  });
});

// ── 5) MOVIMIENTOS ──
out.push("\n-- ===== 5) MOVIMIENTOS (monto = USD predeterminada; montoCuentaMonedaOrigen = moneda de la cuenta) =====");
movs.forEach((m) => {
  const ref = m.refCol ? `, ${m.refCol}` : "";
  const refV = m.refVal ? `, ${m.refVal}` : "";
  out.push(
    `INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId"${ref}) ` +
      `VALUES (${q(uuid(m.i))}, ${D(m.fecha)}, ${N(m.montoUSD)}, ${N(m.importe)}, false, ${m.concepto}, ${cuentaId(m.cuenta)}${refV}) ` +
      `ON CONFLICT (id) DO NOTHING;`
  );
});

// ── 6) CUOTAS: saldo de préstamos ──
out.push("\n-- ===== 6) SALDO DE PRÉSTAMOS (tras 2 cuotas nuevas cada uno) =====");
saldoFinalPrestamos.forEach((p) => {
  out.push(`UPDATE prestamo SET saldo = ${N(p.saldo)} WHERE id = ${q(p.id)} AND "usuarioId" = ${U};`);
});

// ── 7) INFLACIÓN ──
out.push("\n-- ===== 7) INFLACIÓN SEPTIEMBRE =====");
out.push(
  `INSERT INTO inflacion ("fechaInicial", "fechaFinal", indice, eliminado, "usuarioId") ` +
    `SELECT ${D(inflacionSep.desde)}, ${D(inflacionSep.hasta)}, ${N(inflacionSep.indice)}, false, ${U} ` +
    `WHERE NOT EXISTS (SELECT 1 FROM inflacion i WHERE i."usuarioId" = ${U} AND i."fechaInicial" = ${D(inflacionSep.desde)});`
);

// ── 8) HISTÓRICO DE CUENTA (running balance en moneda de la cuenta) ──
out.push("\n-- ===== 8) HISTÓRICO DE CUENTA (base = cuenta.saldo actual + running de los movs nuevos) =====");
const valores = movs
  .map((m) => `  (${D(m.fecha)}::date, ${N(m.hora)}, ${q(m.cuenta)}, ${N(m.importe * signoDe(m.concepto))}, ${q(uuid(m.i))}::uuid)`)
  .join(",\n");
out.push(`-- base = cuenta.saldo (que todavía es el saldo PRE-lote: el update de saldos va después)
INSERT INTO historico_cuenta ("fechaDesde", saldo, eliminado, "cuentaId", "movimientoId")
WITH b AS (
  SELECT id, nombre, saldo FROM cuenta WHERE "usuarioId" = ${U}
), todos AS (
  SELECT v.fecha, v.hora, b.id AS cuenta, v.delta, v.mov, b.saldo AS base
  FROM (VALUES
${valores}
  ) AS v(fecha, hora, nombre, delta, mov)
  JOIN b ON b.nombre = v.nombre
), calc AS (
  SELECT fecha, hora, cuenta, mov,
         base + SUM(delta) OVER (PARTITION BY cuenta ORDER BY fecha, hora) AS saldo
  FROM todos
)
SELECT (c.fecha + make_interval(hours => c.hora)), c.saldo, false, c.cuenta, c.mov
FROM calc c
WHERE NOT EXISTS (SELECT 1 FROM historico_cuenta h WHERE h."movimientoId" = c.mov);`);

// ── 9) SALDO DE CUENTAS = último histórico ──
out.push("\n-- ===== 9) SALDO DE CUENTAS (= saldo del último histórico) =====");
out.push(`UPDATE cuenta c
SET saldo = (
  SELECT h.saldo FROM historico_cuenta h
  WHERE h."cuentaId" = c.id AND h.eliminado = false
  ORDER BY h."fechaDesde" DESC LIMIT 1
)
WHERE c."usuarioId" = ${U};`);

const sql = out.join("\n");
writeFileSync("backend/scripts/_demo_sep2026.sql", sql, "utf8");
console.log("SQL generado:", sql.length, "bytes");
console.log("Movimientos:", movs.length, "| Gastos nuevos:", gastos.length, "| Gastos que se pagan:", gastosAPagar.length);
console.log("Períodos:", periodos.length, "| Jornadas:", periodos.reduce((s, p) => s + p.jornadas.length, 0));
console.log("\n--- resumen de movimientos ---");
movs.forEach((m) =>
  console.log(
    `  ${m.fecha}  c${m.concepto}  ${m.cuenta.padEnd(16)} ${String(m.importe).padStart(7)} ${m.moneda}  (USD ${m.montoUSD})  [${uuid(m.i).slice(-6)}]`
  )
);
console.log("\n--- saldos esperados por cuenta (delta neto) ---");
const porCuenta = {};
movs.forEach((m) => {
  porCuenta[m.cuenta] = (porCuenta[m.cuenta] ?? 0) + signoDe(m.concepto) * m.importe;
});
Object.entries(porCuenta).forEach(([c, d]) => console.log(`  ${c.padEnd(16)} ${d >= 0 ? "+" : ""}${d}`));
