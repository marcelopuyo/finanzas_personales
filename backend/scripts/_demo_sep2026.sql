-- ============================================================
-- DEMO usuario 7 — continuación 2026-08-10 → 2026-09-16
-- Idempotente y agnóstico de entorno (base de saldo = cuenta.saldo)
-- ============================================================

-- ===== 1) GASTOS DE AGOSTO QUE ESTABAN PENDIENTES (se pagan) =====
UPDATE gasto SET monto = 58.74, saldo = 0, "fechaPago" = '2026-08-05', "isPeriodico" = true
 WHERE id = '10000000-0000-4000-8000-000000000018' AND "usuarioId" = 7 AND "fechaPago" IS NULL AND "categoriaId" = (SELECT id FROM categoria_gasto WHERE nombre='Alquiler' AND "usuarioId"=7);
UPDATE gasto SET monto = 20.1, saldo = 0, "fechaPago" = '2026-08-20', "isPeriodico" = true
 WHERE id = '10000000-0000-4000-8000-000000000020' AND "usuarioId" = 7 AND "fechaPago" IS NULL AND "categoriaId" = (SELECT id FROM categoria_gasto WHERE nombre='Servicios' AND "usuarioId"=7);

-- ===== 2) GASTOS NUEVOS (monto/saldo en USD; el pago usa la moneda de la cuenta) =====
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000301', 'Combustible', 17.42, 0, NULL, '2026-08-18', true, false, (SELECT id FROM categoria_gasto WHERE nombre='Transporte' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000302', 'Supermercado', 34.17, 0, NULL, '2026-08-25', true, false, (SELECT id FROM categoria_gasto WHERE nombre='Alimentacion' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000303', 'Alquiler', 61, 0, NULL, '2026-09-05', true, false, (SELECT id FROM categoria_gasto WHERE nombre='Alquiler' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000304', 'Supermercado', 27.86, 0, NULL, '2026-09-08', true, false, (SELECT id FROM categoria_gasto WHERE nombre='Alimentacion' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000305', 'Luz', 23.18, 0, NULL, '2026-09-15', true, false, (SELECT id FROM categoria_gasto WHERE nombre='Servicios' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000306', 'Farmacia', 9.27, 0, NULL, '2026-09-16', true, false, (SELECT id FROM categoria_gasto WHERE nombre='Salud' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;
INSERT INTO gasto (id, descripcion, monto, saldo, "fechaVencimiento", "fechaPago", "isPeriodico", eliminado, "categoriaId", "usuarioId") VALUES ('30000000-0000-4000-8000-000000000307', 'Internet', 21.19, 21.19, '2026-09-20', NULL, false, false, (SELECT id FROM categoria_gasto WHERE nombre='Servicios' AND "usuarioId"=7), 7) ON CONFLICT (id) DO NOTHING;

-- ===== 3) PERÍODOS DE TRABAJO (agosto cobrado el 05-09; septiembre EN CURSO) =====
INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (5200, '2026-08-01', '2026-08-31', 576, '2026-09-01', '2026-09-05', false, (SELECT id FROM trabajo WHERE nombre='Dev Freelance' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (5201, '2026-08-01', '2026-08-31', 200000, '2026-09-01', '2026-09-05', false, (SELECT id FROM trabajo WHERE nombre='Cafe Express' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (5202, '2026-08-01', '2026-08-31', 60000, '2026-09-01', '2026-09-05', false, (SELECT id FROM trabajo WHERE nombre='Clases Particulares' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (5203, '2026-09-01', '2026-09-30', 288, '2026-10-01', NULL, false, (SELECT id FROM trabajo WHERE nombre='Dev Freelance' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (5204, '2026-09-01', '2026-09-30', 80000, '2026-10-01', NULL, false, (SELECT id FROM trabajo WHERE nombre='Cafe Express' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO periodo_trabajo (id, "fechaDesde", "fechaHasta", "montoACobrar", "fechaEstimadaCobro", "fechaDeCobro", eliminado, "trabajoId") VALUES (5205, '2026-09-01', '2026-09-30', 30000, '2026-10-01', NULL, false, (SELECT id FROM trabajo WHERE nombre='Clases Particulares' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;

-- ===== 4) JORNADAS =====
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-06', '2026-08-06', 9, 17, 144, 0, 18, false, 5200 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5200 AND j."fechaJornada" = '2026-08-06');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-13', '2026-08-13', 9, 17, 144, 0, 18, false, 5200 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5200 AND j."fechaJornada" = '2026-08-13');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-20', '2026-08-20', 9, 17, 144, 0, 18, false, 5200 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5200 AND j."fechaJornada" = '2026-08-20');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-27', '2026-08-27', 9, 17, 144, 0, 18, false, 5200 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5200 AND j."fechaJornada" = '2026-08-27');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-06', '2026-08-06', 8, 16, 40000, 0, 5000, false, 5201 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5201 AND j."fechaJornada" = '2026-08-06');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-13', '2026-08-13', 8, 16, 40000, 0, 5000, false, 5201 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5201 AND j."fechaJornada" = '2026-08-13');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-20', '2026-08-20', 8, 16, 40000, 0, 5000, false, 5201 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5201 AND j."fechaJornada" = '2026-08-20');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-27', '2026-08-27', 8, 16, 40000, 0, 5000, false, 5201 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5201 AND j."fechaJornada" = '2026-08-27');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-31', '2026-08-31', 8, 16, 40000, 0, 5000, false, 5201 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5201 AND j."fechaJornada" = '2026-08-31');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-07', '2026-08-07', 10, 20, 15000, 0, 1500, false, 5202 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5202 AND j."fechaJornada" = '2026-08-07');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-14', '2026-08-14', 10, 20, 15000, 0, 1500, false, 5202 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5202 AND j."fechaJornada" = '2026-08-14');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-21', '2026-08-21', 10, 20, 15000, 0, 1500, false, 5202 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5202 AND j."fechaJornada" = '2026-08-21');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-08-28', '2026-08-28', 10, 20, 15000, 0, 1500, false, 5202 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5202 AND j."fechaJornada" = '2026-08-28');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-09-03', '2026-09-03', 9, 17, 144, 0, 18, false, 5203 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5203 AND j."fechaJornada" = '2026-09-03');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-09-10', '2026-09-10', 9, 17, 144, 0, 18, false, 5203 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5203 AND j."fechaJornada" = '2026-09-10');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-09-03', '2026-09-03', 8, 16, 40000, 0, 5000, false, 5204 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5204 AND j."fechaJornada" = '2026-09-03');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-09-10', '2026-09-10', 8, 16, 40000, 0, 5000, false, 5204 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5204 AND j."fechaJornada" = '2026-09-10');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-09-04', '2026-09-04', 10, 20, 15000, 0, 1500, false, 5205 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5205 AND j."fechaJornada" = '2026-09-04');
INSERT INTO jornada_trabajo ("fechaJornada", "fechaCarga", "horaDesde", "horaHasta", "montoJornada", "montoPropina", precioHora, eliminado, "periodoTrabajoId") SELECT '2026-09-11', '2026-09-11', 10, 20, 15000, 0, 1500, false, 5205 WHERE NOT EXISTS (SELECT 1 FROM jornada_trabajo j WHERE j."periodoTrabajoId" = 5205 AND j."fechaJornada" = '2026-09-11');

-- ===== 5) MOVIMIENTOS (monto = USD predeterminada; montoCuentaMonedaOrigen = moneda de la cuenta) =====
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000001', '2026-08-05', 58.74, 88000, false, 1, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '10000000-0000-4000-8000-000000000018') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "prestamoId") VALUES ('30000000-0000-4000-8000-000000000012', '2026-08-10', 26.7, 40000, false, 9, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '10000000-0000-4000-8000-000000000002') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "prestamoId") VALUES ('30000000-0000-4000-8000-000000000013', '2026-08-15', 16.75, 25000, false, 8, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '10000000-0000-4000-8000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000003', '2026-08-18', 17.42, 26000, false, 1, (SELECT id FROM cuenta WHERE nombre='Billetera' AND "usuarioId"=7), '30000000-0000-4000-8000-000000000301') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000002', '2026-08-20', 20.1, 30000, false, 1, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '10000000-0000-4000-8000-000000000020') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000004', '2026-08-25', 34.17, 51000, false, 1, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '30000000-0000-4000-8000-000000000302') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId") VALUES ('30000000-0000-4000-8000-000000000017', '2026-09-01', 26.42, 40000, false, 12, (SELECT id FROM cuenta WHERE nombre='Billetera' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId") VALUES ('30000000-0000-4000-8000-000000000016', '2026-09-01', 26.42, 40000, false, 13, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId") VALUES ('30000000-0000-4000-8000-000000000009', '2026-09-05', 576, 576, false, 3, (SELECT id FROM cuenta WHERE nombre='Banco Nacion USD' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId") VALUES ('30000000-0000-4000-8000-000000000010', '2026-09-05', 132.61, 200000, false, 3, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId") VALUES ('30000000-0000-4000-8000-000000000011', '2026-09-05', 39.78, 60000, false, 3, (SELECT id FROM cuenta WHERE nombre='Caja Principal' AND "usuarioId"=7)) ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000005', '2026-09-05', 61, 92000, false, 1, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '30000000-0000-4000-8000-000000000303') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000006', '2026-09-08', 27.86, 42000, false, 1, (SELECT id FROM cuenta WHERE nombre='Billetera' AND "usuarioId"=7), '30000000-0000-4000-8000-000000000304') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "prestamoId") VALUES ('30000000-0000-4000-8000-000000000014', '2026-09-10', 26.4, 40000, false, 9, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '10000000-0000-4000-8000-000000000002') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000007', '2026-09-15', 23.18, 35000, false, 1, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '30000000-0000-4000-8000-000000000305') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "prestamoId") VALUES ('30000000-0000-4000-8000-000000000015', '2026-09-15', 16.56, 25000, false, 8, (SELECT id FROM cuenta WHERE nombre='Banco Nacion' AND "usuarioId"=7), '10000000-0000-4000-8000-000000000003') ON CONFLICT (id) DO NOTHING;
INSERT INTO movimiento (id, fecha, monto, "montoCuentaMonedaOrigen", eliminado, "conceptoId", "cuentaId", "gastoId") VALUES ('30000000-0000-4000-8000-000000000008', '2026-09-16', 9.27, 14000, false, 1, (SELECT id FROM cuenta WHERE nombre='Billetera' AND "usuarioId"=7), '30000000-0000-4000-8000-000000000306') ON CONFLICT (id) DO NOTHING;

-- ===== 6) SALDO DE PRÉSTAMOS (tras 2 cuotas nuevas cada uno) =====
UPDATE prestamo SET saldo = 40000 WHERE id = '10000000-0000-4000-8000-000000000002' AND "usuarioId" = 7;
UPDATE prestamo SET saldo = 175000 WHERE id = '10000000-0000-4000-8000-000000000003' AND "usuarioId" = 7;

-- ===== 7) INFLACIÓN SEPTIEMBRE =====
INSERT INTO inflacion ("fechaInicial", "fechaFinal", indice, eliminado, "usuarioId") SELECT '2026-09-01', '2026-09-30', 2.6, false, 7 WHERE NOT EXISTS (SELECT 1 FROM inflacion i WHERE i."usuarioId" = 7 AND i."fechaInicial" = '2026-09-01');

-- ===== 8) HISTÓRICO DE CUENTA (base = cuenta.saldo actual + running de los movs nuevos) =====
-- base = cuenta.saldo (que todavía es el saldo PRE-lote: el update de saldos va después)
INSERT INTO historico_cuenta ("fechaDesde", saldo, eliminado, "cuentaId", "movimientoId")
WITH b AS (
  SELECT id, nombre, saldo FROM cuenta WHERE "usuarioId" = 7
), todos AS (
  SELECT v.fecha, v.hora, b.id AS cuenta, v.delta, v.mov, b.saldo AS base
  FROM (VALUES
  ('2026-08-05'::date, 9, 'Banco Nacion', -88000, '30000000-0000-4000-8000-000000000001'::uuid),
  ('2026-08-10'::date, 9, 'Banco Nacion', 40000, '30000000-0000-4000-8000-000000000012'::uuid),
  ('2026-08-15'::date, 9, 'Banco Nacion', -25000, '30000000-0000-4000-8000-000000000013'::uuid),
  ('2026-08-18'::date, 9, 'Billetera', -26000, '30000000-0000-4000-8000-000000000003'::uuid),
  ('2026-08-20'::date, 9, 'Banco Nacion', -30000, '30000000-0000-4000-8000-000000000002'::uuid),
  ('2026-08-25'::date, 9, 'Banco Nacion', -51000, '30000000-0000-4000-8000-000000000004'::uuid),
  ('2026-09-01'::date, 9, 'Billetera', 40000, '30000000-0000-4000-8000-000000000017'::uuid),
  ('2026-09-01'::date, 9, 'Banco Nacion', -40000, '30000000-0000-4000-8000-000000000016'::uuid),
  ('2026-09-05'::date, 9, 'Banco Nacion USD', 576, '30000000-0000-4000-8000-000000000009'::uuid),
  ('2026-09-05'::date, 9, 'Banco Nacion', 200000, '30000000-0000-4000-8000-000000000010'::uuid),
  ('2026-09-05'::date, 9, 'Caja Principal', 60000, '30000000-0000-4000-8000-000000000011'::uuid),
  ('2026-09-05'::date, 10, 'Banco Nacion', -92000, '30000000-0000-4000-8000-000000000005'::uuid),
  ('2026-09-08'::date, 9, 'Billetera', -42000, '30000000-0000-4000-8000-000000000006'::uuid),
  ('2026-09-10'::date, 9, 'Banco Nacion', 40000, '30000000-0000-4000-8000-000000000014'::uuid),
  ('2026-09-15'::date, 9, 'Banco Nacion', -35000, '30000000-0000-4000-8000-000000000007'::uuid),
  ('2026-09-15'::date, 10, 'Banco Nacion', -25000, '30000000-0000-4000-8000-000000000015'::uuid),
  ('2026-09-16'::date, 9, 'Billetera', -14000, '30000000-0000-4000-8000-000000000008'::uuid)
  ) AS v(fecha, hora, nombre, delta, mov)
  JOIN b ON b.nombre = v.nombre
), calc AS (
  SELECT fecha, hora, cuenta, mov,
         base + SUM(delta) OVER (PARTITION BY cuenta ORDER BY fecha, hora) AS saldo
  FROM todos
)
SELECT (c.fecha + make_interval(hours => c.hora)), c.saldo, false, c.cuenta, c.mov
FROM calc c
WHERE NOT EXISTS (SELECT 1 FROM historico_cuenta h WHERE h."movimientoId" = c.mov);

-- ===== 9) SALDO DE CUENTAS (= saldo del último histórico) =====
UPDATE cuenta c
SET saldo = (
  SELECT h.saldo FROM historico_cuenta h
  WHERE h."cuentaId" = c.id AND h.eliminado = false
  ORDER BY h."fechaDesde" DESC LIMIT 1
)
WHERE c."usuarioId" = 7;