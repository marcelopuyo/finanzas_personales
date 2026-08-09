// TEMPORAL — Genera SQL (a stdout) para un set de datos de ejemplo del usuario
// ejemplo@google.com (id 7) en Supabase, período 2026-01-01 → 2026-08-09.
// NO conecta a la BD: solo emite SQL que luego se ejecuta vía API de Supabase.
import { writeFileSync } from "node:fs";

const U = 7; // usuarioId del usuario ejemplo
const out = [];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const S = (s) => (s == null ? "NULL" : q(s)); // string nullable
const D = (d) => (d == null ? "NULL" : `'${d}'`); // fecha nullable
const N = (n) => String(n);
const uuid = (i) => `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

// referencias por nombre (los IDs enteros los asigna la BD)
const cuentaId = (n) => `(SELECT id FROM cuenta WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const catId = (n) => `(SELECT id FROM categoria_gasto WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const perId = (n) => `(SELECT id FROM periodo_gasto WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const trabId = (n) => `(SELECT id FROM trabajo WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const persId = (n) => `(SELECT id FROM persona WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const tarjetaId = (n) => `(SELECT id FROM tarjeta WHERE nombre=${q(n)} AND "usuarioId"=${U})`;
const perTarjetaId = (n, t) => `(SELECT id FROM periodo_tarjeta WHERE nombre=${q(n)} AND "tarjetaId"=${tarjetaId(t)})`;

// ============================== DATOS ==============================

const personas = [
  { nombre: "Marcelo Ejemplo", telefono: "11 5555-0001", mail: "ejemplo@google.com" },
  { nombre: "Laura Gomez", telefono: "11 5555-0102", mail: "laura@example.com" },
  { nombre: "Pedro Martinez", telefono: "11 5555-0103", mail: "pedro@example.com" },
];

const categorias = [
  "Alimentacion", "Alquiler", "Servicios", "Transporte", "Salud", "Ocio",
];

const cuentas = [
  // nombre, tipoId, monedaId
  { nombre: "Caja Principal", tipoId: 2, monedaId: 1 }, // Caja Fisica, Peso
  { nombre: "Banco Nacion", tipoId: 1, monedaId: 1 }, // Cuenta Bancaria, Peso
  { nombre: "Banco Nacion USD", tipoId: 1, monedaId: 2 }, // Cuenta Bancaria, Dolar
  { nombre: "Billetera", tipoId: 2, monedaId: 1 }, // Caja Fisica, Peso
];
// Saldo inicial al 01-01-2026 por cuenta
const saldoInicial = {
  "Banco Nacion": 400000,
  "Banco Nacion USD": 1500,
  "Caja Principal": 100000,
  Billetera: 100000,
};

const trabajos = [
  // nombre, fechaInicio, precioHora, memos, cuenta de cobro
  { nombre: "Dev Freelance", fechaInicio: "2026-01-05", precioHora: 18, memos: "Desarrollo web freelance (USD)", cuenta: "Banco Nacion USD" },
  { nombre: "Cafe Express", fechaInicio: "2026-02-01", precioHora: 5000, memos: "Barista part-time", cuenta: "Banco Nacion" },
  { nombre: "Clases Particulares", fechaInicio: "2026-03-01", precioHora: 1500, memos: "Tutorías de matemática", cuenta: "Caja Principal" },
];

const periodosGasto = [
  { nombre: "Enero 26", apertura: "2026-01-01", cierre: "2026-01-31" },
  { nombre: "Febrero 26", apertura: "2026-02-01", cierre: "2026-02-28" },
  { nombre: "Marzo 26", apertura: "2026-03-01", cierre: "2026-03-31" },
  { nombre: "Abril 26", apertura: "2026-04-01", cierre: "2026-04-30" },
  { nombre: "Mayo 26", apertura: "2026-05-01", cierre: "2026-05-31" },
  { nombre: "Junio 26", apertura: "2026-06-01", cierre: "2026-06-30" },
  { nombre: "Julio 26", apertura: "2026-07-01", cierre: "2026-07-31" },
  { nombre: "Agosto 26", apertura: "2026-08-01", cierre: "2026-08-31" },
];

// gastos: uuidIdx, desc, monto, categoria, periodo, cuenta (si pagado), fechaPago, fechaVenc, isPeriodico
const gastos = [
  { i: 1, desc: "Supermercado", monto: 45000, cat: "Alimentacion", per: "Enero 26", cuenta: "Billetera", pago: "2026-01-14" },
  { i: 2, desc: "Alquiler", monto: 80000, cat: "Alquiler", per: "Enero 26", cuenta: "Banco Nacion", pago: "2026-01-05" },
  { i: 3, desc: "Luz", monto: 18000, cat: "Servicios", per: "Enero 26", cuenta: "Banco Nacion", pago: "2026-01-20" },
  { i: 4, desc: "Supermercado", monto: 47000, cat: "Alimentacion", per: "Febrero 26", cuenta: "Billetera", pago: "2026-02-12" },
  { i: 5, desc: "Alquiler", monto: 82000, cat: "Alquiler", per: "Febrero 26", cuenta: "Banco Nacion", pago: "2026-02-05" },
  { i: 6, desc: "Gas", monto: 15000, cat: "Servicios", per: "Febrero 26", cuenta: "Banco Nacion", pago: "2026-02-22" },
  { i: 7, desc: "Supermercado", monto: 46000, cat: "Alimentacion", per: "Marzo 26", cuenta: "Billetera", pago: "2026-03-10" },
  { i: 8, desc: "Alquiler", monto: 82000, cat: "Alquiler", per: "Marzo 26", cuenta: "Banco Nacion", pago: "2026-03-05" },
  { i: 9, desc: "Supermercado", monto: 49000, cat: "Alimentacion", per: "Abril 26", cuenta: "Billetera", pago: "2026-04-11" },
  { i: 10, desc: "Alquiler", monto: 84000, cat: "Alquiler", per: "Abril 26", cuenta: "Banco Nacion", pago: "2026-04-05" },
  { i: 11, desc: "Farmacia", monto: 12000, cat: "Salud", per: "Abril 26", cuenta: "Billetera", pago: "2026-04-18" },
  { i: 12, desc: "Supermercado", monto: 50000, cat: "Alimentacion", per: "Mayo 26", cuenta: "Billetera", pago: "2026-05-09" },
  { i: 13, desc: "Alquiler", monto: 84000, cat: "Alquiler", per: "Mayo 26", cuenta: "Banco Nacion", pago: "2026-05-05" },
  { i: 14, desc: "Alquiler", monto: 86000, cat: "Alquiler", per: "Junio 26", cuenta: "Banco Nacion", pago: "2026-06-05" },
  { i: 15, desc: "Combustible", monto: 25000, cat: "Transporte", per: "Junio 26", cuenta: "Billetera", pago: "2026-06-15" },
  { i: 16, desc: "Alquiler", monto: 86000, cat: "Alquiler", per: "Julio 26", cuenta: "Banco Nacion", pago: "2026-07-05" },
  { i: 17, desc: "Supermercado", monto: 52000, cat: "Alimentacion", per: "Julio 26", cuenta: "Billetera", pago: "2026-07-12" },
  { i: 18, desc: "Alquiler", monto: 88000, cat: "Alquiler", per: "Agosto 26", venc: "2026-08-05" }, // pendiente
  { i: 19, desc: "Supermercado", monto: 48000, cat: "Alimentacion", per: "Agosto 26", cuenta: "Billetera", pago: "2026-08-04" },
  { i: 20, desc: "Internet", monto: 30000, cat: "Servicios", per: "Agosto 26", venc: "2026-08-20" }, // pendiente
];

// prestamos: uuidIdx, detalle, fecha, monto, saldo, cuotas, sentido, origen, destino, cuenta
const prestamos = [
  { i: 2, detalle: "Prestamo a Laura", fecha: "2026-02-10", monto: 240000, saldo: 120000, cuotas: 6, sentido: "otorgado", origen: "Marcelo Ejemplo", destino: "Laura Gomez", cuenta: "Banco Nacion" },
  { i: 3, detalle: "Prestamo de Pedro", fecha: "2026-04-15", monto: 300000, saldo: 225000, cuotas: 12, sentido: "obtenido", origen: "Pedro Martinez", destino: "Marcelo Ejemplo", cuenta: "Banco Nacion" },
];

// movimientos de préstamos: fecha, conceptoId, monto, cuenta, prestamoIdx
const movsPrestamo = [
  { fecha: "2026-02-10", c: 8, monto: -240000, cuenta: "Banco Nacion", p: 2 },
  { fecha: "2026-05-10", c: 9, monto: 40000, cuenta: "Banco Nacion", p: 2 },
  { fecha: "2026-06-10", c: 9, monto: 40000, cuenta: "Banco Nacion", p: 2 },
  { fecha: "2026-07-10", c: 9, monto: 40000, cuenta: "Banco Nacion", p: 2 },
  { fecha: "2026-04-15", c: 9, monto: 300000, cuenta: "Banco Nacion", p: 3 },
  { fecha: "2026-05-15", c: 8, monto: -25000, cuenta: "Banco Nacion", p: 3 },
  { fecha: "2026-06-15", c: 8, monto: -25000, cuenta: "Banco Nacion", p: 3 },
  { fecha: "2026-07-15", c: 8, monto: -25000, cuenta: "Banco Nacion", p: 3 },
];

// periodos trabajo: trabajo, desde, hasta, monto, estCobro, fechaCobro, jornadas [{fecha,hastaHora,propina}]
// Dev Freelance (18/h): jornadas de 8h → 144 c/u
const dev = (mes, dias, cobro) => ({
  trabajo: "Dev Freelance", desde: mes[0], hasta: mes[1], monto: dias.length * 144, estCobro: mes[2], cobro,
  jornadas: dias.map((d) => ({ fecha: d, horaDesde: 9, horaHasta: 17, propina: 0 })),
});
const cafe = (mes, dias, cobro) => ({
  trabajo: "Cafe Express", desde: mes[0], hasta: mes[1], monto: dias.length * 40000, estCobro: mes[2], cobro,
  jornadas: dias.map((d) => ({ fecha: d, horaDesde: 8, horaHasta: 16, propina: 0 })),
});
const clases = (mes, dias, cobro) => ({
  trabajo: "Clases Particulares", desde: mes[0], hasta: mes[1], monto: dias.length * 15000, estCobro: mes[2], cobro,
  jornadas: dias.map((d) => ({ fecha: d, horaDesde: 10, horaHasta: 20, propina: 0 })), // 10h
});

const periodosTrabajo = [
  dev(["2026-01-01", "2026-01-31", "2026-02-01"], ["2026-01-06", "2026-01-13", "2026-01-20", "2026-01-27"], "2026-02-05"),
  dev(["2026-02-01", "2026-02-28", "2026-03-01"], ["2026-02-03", "2026-02-10", "2026-02-17", "2026-02-24"], "2026-03-05"),
  dev(["2026-03-01", "2026-03-31", "2026-04-01"], ["2026-03-05", "2026-03-12", "2026-03-19", "2026-03-26"], "2026-04-05"),
  dev(["2026-04-01", "2026-04-30", "2026-05-01"], ["2026-04-02", "2026-04-09", "2026-04-16", "2026-04-23"], "2026-05-05"),
  dev(["2026-05-01", "2026-05-31", "2026-06-01"], ["2026-05-07", "2026-05-14", "2026-05-21", "2026-05-28"], "2026-06-05"),
  dev(["2026-06-01", "2026-06-30", "2026-07-01"], ["2026-06-04", "2026-06-11", "2026-06-18", "2026-06-25"], "2026-07-05"),
  dev(["2026-07-01", "2026-07-31", "2026-08-01"], ["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23"], "2026-08-05"),
  cafe(["2026-03-01", "2026-03-31", "2026-04-01"], ["2026-03-03", "2026-03-08", "2026-03-13", "2026-03-18", "2026-03-23"], "2026-04-05"),
  cafe(["2026-04-01", "2026-04-30", "2026-05-01"], ["2026-04-01", "2026-04-06", "2026-04-11", "2026-04-16", "2026-04-21"], "2026-05-05"),
  cafe(["2026-05-01", "2026-05-31", "2026-06-01"], ["2026-05-04", "2026-05-08", "2026-05-12", "2026-05-19", "2026-05-26"], "2026-06-05"),
  cafe(["2026-06-01", "2026-06-30", "2026-07-01"], ["2026-06-03", "2026-06-10", "2026-06-17", "2026-06-24", "2026-06-29"], "2026-07-05"),
  cafe(["2026-07-01", "2026-07-31", "2026-08-01"], ["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23", "2026-07-30"], "2026-08-05"),
  clases(["2026-03-01", "2026-03-31", "2026-04-01"], ["2026-03-06", "2026-03-13", "2026-03-20", "2026-03-27"], "2026-04-05"),
  clases(["2026-04-01", "2026-04-30", "2026-05-01"], ["2026-04-03", "2026-04-10", "2026-04-17", "2026-04-24"], "2026-05-05"),
  clases(["2026-05-01", "2026-05-31", "2026-06-01"], ["2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29"], "2026-06-05"),
  clases(["2026-06-01", "2026-06-30", "2026-07-01"], ["2026-06-05", "2026-06-12", "2026-06-19", "2026-06-26"], "2026-07-05"),
  clases(["2026-07-01", "2026-07-31", "2026-08-01"], ["2026-07-03", "2026-07-10", "2026-07-17", "2026-07-24"], "2026-08-05"),
];

// transferencias: extracciones mensuales Banco Nacion → Billetera
const extracciones = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"];

// compra de dólares
const compraDolares = { fecha: "2026-03-15", ars: 300000, usd: 200 };

// tarjetas demo
const tarjetaDemo = {
  nombre: "Visa Nacion", banco: "Banco Nacion", numero: "4509 **** **** 0011", cuenta: "Banco Nacion",
  periodos: [
    { nombre: "Marzo 26", apertura: "2026-03-01", cierre: "2026-03-31", venc: "2026-04-10", movs: [{ detalle: "Compra supermercado", fecha: "2026-03-12", monto: 45000, cuotas: 3, persona: "Marcelo Ejemplo" }] },
    { nombre: "Abril 26", apertura: "2026-04-01", cierre: "2026-04-30", venc: "2026-05-10", movs: [{ detalle: "Cena restaurante", fecha: "2026-04-08", monto: 32000, cuotas: 1, persona: "Marcelo Ejemplo" }] },
  ],
};

// cotizaciones e inflación mensuales (2026-01..2026-08)
const cotizaciones = [
  ["2026-01-01", "2026-01-31", 1400], ["2026-02-01", "2026-02-28", 1450], ["2026-03-01", "2026-03-31", 1500],
  ["2026-04-01", "2026-04-30", 1480], ["2026-05-01", "2026-05-31", 1520], ["2026-06-01", "2026-06-30", 1550],
  ["2026-07-01", "2026-07-31", 1530], ["2026-08-01", "2026-08-31", 1560],
];
const inflaciones = [
  ["2026-01-01", "2026-01-31", 2.5], ["2026-02-01", "2026-02-28", 2.2], ["2026-03-01", "2026-03-31", 2.8],
  ["2026-04-01", "2026-04-30", 3.1], ["2026-05-01", "2026-05-31", 2.9], ["2026-06-01", "2026-06-30", 2.4],
  ["2026-07-01", "2026-07-31", 2.7], ["2026-08-01", "2026-08-31", 2.3],
];

// ============================== EMISIÓN SQL ==============================

out.push("-- ===== MAESTROS (usuario 7) =====");
personas.forEach((p) =>
  out.push(`INSERT INTO persona (nombre, telefono, mail, eliminado, "usuarioId") VALUES (${q(p.nombre)}, ${S(p.telefono)}, ${S(p.mail)}, false, ${U});`)
);
categorias.forEach((c) => out.push(`INSERT INTO categoria_gasto (nombre, eliminado, "usuarioId") VALUES (${q(c)}, false, ${U});`));
cuentas.forEach((c) => out.push(`INSERT INTO cuenta (nombre, saldo, eliminado, "tipoId", "monedaId", "usuarioId") VALUES (${q(c.nombre)}, 0, false, ${c.tipoId}, ${c.monedaId}, ${U});`));
trabajos.forEach((t) =>
  out.push(`INSERT INTO trabajo (nombre, "fechaInicio", "precioHora", memos, eliminado, "usuarioId") VALUES (${q(t.nombre)}, ${D(t.fechaInicio)}, ${N(t.precioHora)}, ${q(t.memos)}, false, ${U});`)
);
periodosGasto.forEach((p) =>
  out.push(`INSERT INTO periodo_gasto (nombre, "fechaApertura", "fechaCierre", eliminado, "usuarioId") VALUES (${q(p.nombre)}, ${D(p.apertura)}, ${D(p.cierre)}, false, ${U});`)
);
cotizaciones.forEach((c) =>
  out.push(`INSERT INTO cotizacion ("fechaInicial", "fechaFinal", cotizacion, eliminado, "monedaId", "usuarioId") VALUES (${D(c[0])}, ${D(c[1])}, ${N(c[2])}, false, 2, ${U});`)
);
inflaciones.forEach((c) =>
  out.push(`INSERT INTO inflacion ("fechaInicial", "fechaFinal", indice, eliminado, "usuarioId") VALUES (${D(c[0])}, ${D(c[1])}, ${N(c[2])}, false, ${U});`)
);
out.push(`INSERT INTO tarjeta (nombre, banco, numero, eliminado, "cuentaId", "usuarioId") VALUES (${q(tarjetaDemo.nombre)}, ${q(tarjetaDemo.banco)}, ${q(tarjetaDemo.numero)}, false, ${cuentaId(tarjetaDemo.cuenta)}, ${U});`);
tarjetaDemo.periodos.forEach((p) =>
  out.push(`INSERT INTO periodo_tarjeta (nombre, "fechaApertura", "fechaCierre", "fechaVencimiento", eliminado, "tarjetaId") VALUES (${q(p.nombre)}, ${D(p.apertura)}, ${D(p.cierre)}, ${D(p.venc)}, false, ${tarjetaId(tarjetaDemo.nombre)});`)
);
tarjetaDemo.periodos.forEach((p) =>
  p.movs.forEach((m) =>
    out.push(`INSERT INTO movimiento_tarjeta (detalle, fecha, monto, cuotas, eliminado, "tarjetaId", "personaId", "periodoId") VALUES (${q(m.detalle)}, ${D(m.fecha)}, ${N(m.monto)}, ${m.cuotas}, false, ${tarjetaId(tarjetaDemo.nombre)}, ${persId(m.persona)}, ${perTarjetaId(p.nombre, tarjetaDemo.nombre)});`)
  )
);

out.push("-- ===== GASTOS =====");
gastos.forEach((g) => {
  const pagado = !!g.cuenta;
  out.push(
    `INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "periodoId", "categoriaId", "usuarioId") VALUES (${q(uuid(g.i))}, ${q(g.desc)}, ${N(g.monto)}, ${N(pagado ? 0 : g.monto)}, ${D(g.venc ?? null)}, ${D(g.pago ?? null)}, ${pagado ? "true" : "false"}, false, ${perId(g.per)}, ${catId(g.cat)}, ${U});`
  );
});

out.push("-- ===== PRESTAMOS =====");
prestamos.forEach((p) =>
  out.push(
    `INSERT INTO prestamo (id, detalle, fecha, monto, saldo, cuotas, sentido, eliminado, "personaOrigenId", "personaDestinoId", "cuentaId", "usuarioId") VALUES (${q(uuid(p.i))}, ${q(p.detalle)}, ${D(p.fecha)}, ${N(p.monto)}, ${N(p.saldo)}, ${p.cuotas}, ${q(p.sentido)}, false, ${persId(p.origen)}, ${persId(p.destino)}, ${cuentaId(p.cuenta)}, ${U});`
  )
);

out.push("-- ===== PERIODOS TRABAJO + JORNADAS =====");
let ptIdx = 100;
periodosTrabajo.forEach((pt) => {
  out.push(
    `INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (${ptIdx}, ${D(pt.desde)}, ${D(pt.hasta)}, ${N(pt.monto)}, ${D(pt.estCobro)}, ${D(pt.cobro ?? null)}, false, ${trabId(pt.trabajo)});`
  );
  const precioHora = trabajos.find((t) => t.nombre === pt.trabajo).precioHora;
  pt.jornadas.forEach((j) => {
    const monto = Math.round((j.horaHasta - j.horaDesde) * precioHora * 100) / 100;
    out.push(
      `INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", eliminado, "periodoTrabajoId") VALUES (${D(j.fecha)}, ${D(j.fecha)}, ${N(j.horaDesde)}, ${N(j.horaHasta)}, ${N(monto)}, ${N(j.propina)}, false, ${ptIdx});`
    );
  });
  ptIdx += 1;
});

out.push("-- ===== MOVIMIENTOS =====");
let mvIdx = 100;
const pushMov = (fecha, conceptoId, monto, cuenta, refCol = "", refVal = "") => {
  out.push(
    `INSERT INTO movimiento (id, fecha, monto, eliminado, "conceptoId", "cuentaId"${refCol ? ", " + refCol : ""}) VALUES (${q(uuid(mvIdx))}, ${D(fecha)}, ${N(Math.abs(monto))}, false, ${conceptoId}, ${cuentaId(cuenta)}${refVal ? ", " + refVal : ""});`
  );
  mvIdx += 1;
};
// pagos de gastos
gastos.filter((g) => g.cuenta).forEach((g) => pushMov(g.pago, 1, g.monto, g.cuenta, '"gastoId"', q(uuid(g.i))));
// cobros de sueldos
periodosTrabajo.filter((pt) => pt.cobro).forEach((pt) => {
  const cuenta = trabajos.find((t) => t.nombre === pt.trabajo).cuenta;
  pushMov(pt.cobro, 3, pt.monto, cuenta);
});
// movimientos de préstamos
movsPrestamo.forEach((m) => pushMov(m.fecha, m.c, m.monto, m.cuenta, '"prestamoId"', q(uuid(m.p))));
// compra de dólares
pushMov(compraDolares.fecha, 11, compraDolares.ars, "Banco Nacion");
pushMov(compraDolares.fecha, 10, compraDolares.usd, "Banco Nacion USD");
// extracciones
extracciones.forEach((f) => {
  pushMov(f, 13, 40000, "Banco Nacion");
  pushMov(f, 12, 40000, "Billetera");
});

// ===== CIERRE: historico + saldos (scope usuario 7) =====
const baseVals = cuentas.map((c) => `(${q(c.nombre)}, ${N(saldoInicial[c.nombre])})`).join(", ");
out.push("-- ===== HISTORICO CUENTA (running balance con saldo inicial) =====");
out.push(`
INSERT INTO historico_cuenta ("fechaDesde", saldo, eliminado, "cuentaId", "movimientoId")
WITH base AS (
  SELECT cu.id, v.inicial
  FROM (VALUES ${baseVals}) AS v(nombre, inicial)
  JOIN cuenta cu ON cu.nombre = v.nombre AND cu."usuarioId" = ${U}
)
SELECT m.fecha::timestamp,
       b.inicial + SUM(CASE WHEN cc.categoria = 'Ingreso' THEN m.monto ELSE -m.monto END)
         OVER (PARTITION BY m."cuentaId" ORDER BY m.fecha, m.id),
       false, m."cuentaId", m.id
FROM movimiento m
JOIN concepto cc ON cc.id = m."conceptoId"
JOIN base b ON b.id = m."cuentaId"
WHERE m.eliminado = false;
`);
out.push("-- ===== ACTUALIZAR SALDO DE CUENTAS (inicial + neto) =====");
out.push(`
UPDATE cuenta c
SET saldo = v.inicial + COALESCE((
  SELECT SUM(CASE WHEN cc.categoria = 'Ingreso' THEN m.monto ELSE -m.monto END)
  FROM movimiento m JOIN concepto cc ON cc.id = m."conceptoId"
  WHERE m."cuentaId" = c.id AND m.eliminado = false
), 0)
FROM (VALUES ${baseVals}) AS v(nombre, inicial)
WHERE c.nombre = v.nombre AND c."usuarioId" = ${U};
`);

const sql = out.join("\n");
writeFileSync("backend/scripts/_demo_ejemplo.sql", sql, "utf8");
console.log("SQL generado:", sql.length, "bytes,", (sql.match(/INSERT INTO/g) || []).length, "INSERTs");
