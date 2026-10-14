# Análisis de oportunidades para mejorar el control financiero

> **Estado:** análisis exploratorio; no implica aprobación ni implementación.
> **Fecha:** 2026-10-10.
> **Alcance:** revisión acotada del dashboard, algunas entidades/consultas y páginas
> oficiales de YNAB, Copilot Money, Monarch y Wallet by BudgetBakers. No es una
> auditoría exhaustiva de todas las pantallas ni una verificación independiente
> de las afirmaciones comerciales de las aplicaciones comparadas.

## 1. Qué ofrece hoy la aplicación

En las superficies revisadas, la aplicación ya permite:

- Consultar el **balance actual**, sumando las cuentas que el usuario incluye,
  convirtiendo monedas a la predeterminada y, si se activa la opción, agregando
  el saldo neto de préstamos. Los gastos pendientes también se descuentan.
- Ver la **evolución de cuentas** y gráficos mensuales de ingresos, gastos y
  resultados.
- Registrar **gastos por categoría**, con monto/saldo, vencimiento, fecha de pago
  e indicador de periodicidad.
- Seguir **ingresos vinculados al trabajo**, calculados por criterio devengado,
  incluyendo ítems que pueden estar pendientes de cobro.
- Registrar **préstamos otorgados o recibidos**, con contraparte, cuenta y saldo
  pendiente.

Referencias internas consultadas:

- [`app/(app)/dashboard/dashboard-data.ts`](../app/(app)/dashboard/dashboard-data.ts)
- [`backend/src/queries/reportes.ts`](../backend/src/queries/reportes.ts)
- [`backend/src/entities/gasto.entity.ts`](../backend/src/entities/gasto.entity.ts)
- [`backend/src/entities/prestamo.entity.ts`](../backend/src/entities/prestamo.entity.ts)
- [`backend/src/entities/cuenta.entity.ts`](../backend/src/entities/cuenta.entity.ts)

### Distinción importante para interpretar las métricas

El resultado mensual compara ingresos **devengados** con gastos por **fecha de
pago**. No es necesariamente el cambio de efectivo del mes ni una previsión del
dinero disponible. El balance actual, por su parte, descuenta gastos pendientes.
Conviene conservar y explicar estas diferencias al añadir indicadores para que
el usuario no confunda resultado, saldo presente y caja futura.

## 2. Referentes del mercado

La comparación toma como referencia las capacidades descritas en las páginas
oficiales de cada producto. Las páginas son material de los proveedores, no
validaciones independientes.

| Aplicación | Capacidades destacadas oficialmente | Aprendizaje aplicable |
|---|---|---|
| [YNAB](https://www.ynab.com/features) | Planificación de gastos por categorías, seguimiento de objetivos y herramienta de planificación de pago de deudas. | Complementar el registro y los gráficos con límites, prioridades y progreso hacia objetivos. |
| [Copilot Money](https://www.copilot.money/) | Presupuestos con rollover, flujo de caja, cuentas próximas, suscripciones, inversiones y patrimonio neto. | Poner en primer plano los próximos compromisos y conectar el histórico con decisiones futuras. |
| [Monarch](https://www.monarch.com/) | Seguimiento, presupuestos, colaboración y objetivos financieros personalizados. | Los objetivos y, potencialmente, la colaboración pueden ser extensiones de producto; su prioridad depende del público objetivo. |
| [Wallet by BudgetBakers](https://budgetbakers.com/en/features/) | Presupuestos recurrentes y puntuales, rollover, recordatorios/calendario de pagos, previsiones, detección de anomalías e informes. | Los vencimientos y la detección de variaciones son formas de hacer más accionables los datos registrados. |

## 3. Oportunidades priorizadas

La prioridad pondera valor potencial para el usuario, factibilidad con los datos
actuales y riesgo de presentar estimaciones como certezas.

### P1. Presupuesto mensual por categoría

**Impacto:** alto. **Factibilidad:** media-alta.

Permitir definir un monto mensual por categoría y mostrar:

- monto consumido, disponible y porcentaje utilizado;
- ritmo de gasto y una advertencia si el gasto observado sugiere que se superará
  el límite;
- comparación entre meses, conservando la distinción entre gasto pagado y
  pendiente.

Ya existen categorías, gastos y fechas de pago. Para implementarlo haría falta
persistir los montos objetivo y decidir reglas para gastos pendientes, meses
parciales y cambios de categoría. Se recomienda empezar sin rollover; puede
añadirse después de validar el uso del presupuesto básico.

### P2. Calendario de pagos y vencimientos

**Impacto:** alto. **Factibilidad:** media.

Ofrecer una lista o calendario de gastos pendientes por fecha de vencimiento,
con saldo pendiente, días restantes y total próximo. La entidad de gastos ya
incluye vencimiento y saldo.

Antes de alertas automáticas, definir el comportamiento para vencimientos
pasados o ausentes, pagos parciales y gastos periódicos. Las notificaciones
push/email y sus preferencias no se verificaron en esta revisión.

### P3. Flujo de caja futuro

**Impacto potencial:** alto. **Factibilidad actual:** media-baja.

Proyectar saldos futuros combinando saldos actuales, pagos próximos y cobros
esperados podría ayudar a anticipar faltantes. Sin embargo, un ingreso devengado
por trabajo realizado no equivale a dinero ya cobrado ni garantiza una fecha de
cobro.

Como primer paso, se puede mostrar el calendario de obligaciones conocidas. Una
proyección completa requiere distinguir cobros confirmados de estimados y,
posiblemente, registrar fechas previstas de cobro y supuestos de periodicidad.
La interfaz debe presentar los resultados como estimaciones y explicar qué datos
los producen.

### P4. Metas de ahorro y reservas

**Impacto:** medio-alto. **Factibilidad:** media.

Permitir crear metas —por ejemplo, fondo de emergencia o viaje— con monto
objetivo, fecha deseada, saldo asignado y progreso. Una contribución sugerida por
período puede calcularse cuando exista una fecha límite.

No se identificó un módulo de metas en las entidades revisadas. Antes de
implementarlo, definir cómo se asigna dinero a una meta sin duplicar saldos de
cuentas ni inflar el balance, y cómo se registran aportes/retiros.

### P5. Análisis accionable de préstamos

**Impacto:** medio. **Factibilidad:** baja-media para simulaciones; mayor para
resúmenes.

La app ya guarda sentido del préstamo, monto original, saldo, fecha, contraparte
y cuenta. Un resumen de cuánto se debe y cuánto se espera cobrar, separado por
moneda, puede construirse con datos existentes.

Una simulación de cancelación, intereses ahorrados o fecha de pago —como la
herramienta de YNAB— exige datos adicionales, como tasa de interés, cuotas,
frecuencia y vencimientos. No conviene estimar esos valores si no se conocen las
condiciones del préstamo.

### P6. Alertas de variaciones inusuales

**Impacto:** medio. **Factibilidad:** media.

Se podrían destacar categorías cuyo gasto difiere sustancialmente de la historia
del propio usuario. Para evitar alarmas engañosas, se debería exigir suficiente
historial, contemplar valores atípicos y comunicarlo como una **variación
llamativa**, no como un diagnóstico. El volumen de datos y la estabilidad de las
categorías deben verificarse antes de elegir el método.

### P7. Patrimonio neto histórico

**Impacto:** medio. **Factibilidad:** por verificar.

El balance actual ya incluye opciones de cuentas y préstamos, pero una serie
histórica requiere saldos históricos consistentes para activos y pasivos. Antes
de priorizar este indicador, comprobar cobertura, retención y tratamiento
multimoneda de los históricos de cuentas y préstamos. Un saldo actual por sí
solo no permite reconstruir correctamente el pasado.

## 4. Secuencia sugerida

1. **Presupuesto por categoría con progreso y ritmo**, aprovechando categorías y
   gastos existentes.
2. **Calendario de próximos vencimientos**, reutilizando fechas y saldos
   pendientes.
3. **Flujo de caja estimado**, después de aclarar cómo se registran y distinguen
   los cobros previstos.
4. **Metas de ahorro** y mejoras de análisis de préstamos, con reglas explícitas
   para no duplicar fondos ni crear estimaciones financieras infundadas.
5. **Variaciones inusuales y patrimonio neto histórico**, cuando se haya
   confirmado calidad y cobertura suficientes de los datos históricos.

Esta secuencia es una recomendación analítica, no una decisión de producto. La
prioridad final debería validarse con las necesidades de los usuarios y el costo
de mantenimiento de cada función.

## 5. Aspectos por verificar antes de diseñar

- Qué significa operativamente `isPeriodico`: si es solo una clasificación o si
  existe una regla confiable para generar/anticipar próximos gastos.
- Si hay funcionalidades de presupuestos, metas, recordatorios o notificaciones
  en rutas/modelos no cubiertos por esta revisión.
- Qué canales de notificación están disponibles y qué preferencias puede
  configurar cada usuario.
- Cómo se registra el cobro de ingresos de trabajo y si existe una fecha
  estimada además de la fecha devengada o liquidada.
- La cobertura y calidad de los históricos de saldos, incluyendo deudas y
  conversión multimoneda.
- Cómo tratar pagos parciales, períodos incompletos, gastos sin fecha y cambios
  retroactivos de categoría.
- Si la aplicación busca sincronización bancaria. Esta revisión no confirmó una
  integración bancaria; no debe asumirse como existente.

## 6. Conclusión

La oportunidad más inmediata es pasar de **mostrar lo ocurrido** a ayudar a
**decidir qué hacer**: primero cuánto queda disponible por categoría y qué pagos
se acercan; luego, una proyección de caja que separe claramente efectivo,
devengado y estimado. Metas, simulaciones y patrimonio neto pueden ampliar el
producto, pero dependen de reglas de asignación y datos adicionales para ser
fiables.
