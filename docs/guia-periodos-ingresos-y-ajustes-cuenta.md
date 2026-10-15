# Guía funcional: períodos, gastos y movimientos de cuentas

Guía funcional de los paneles de Ingresos y Gastos, los movimientos de cuentas
y el motivo de los ajustes manuales de cuenta.

## Períodos dentro de Ingresos

La pantalla `/dashboard/ingresos` presenta el listado de períodos en tres
pestañas:

- **En curso**: períodos estimados cuya ventana de cobro continúa abierta. El
  total de sus ítems pendientes aparece en el propio rótulo de la pestaña
  seleccionada, por ejemplo `En curso · $ 1.240,00`.
- **Por cobrar**: períodos estimados cuya ventana ya cerró y períodos pendientes
  sin una ventana estimada. El total aparece en el rótulo al seleccionar la
  pestaña, por ejemplo `Por cobrar · $ 860,00`.
- **Cobrados**: liquidaciones con cobro. El rótulo no añade un total.

Las pestañas muestran únicamente las filas de su categoría y un mensaje vacío
propio cuando no hay filas. El cambio de pestaña no modifica los datos ni el
estado de cobro.

### Detalle y acciones de las filas

Los períodos **En curso** y **Por cobrar** muestran sus jornadas y tareas
desplegadas directamente debajo del período; cada período aparece en su propio
subpanel para distinguirlo de los demás. No tienen un control para colapsarlas.
Las acciones de **Editar** y **Eliminar** están disponibles al
deslizar horizontalmente desde cualquier parte de una fila de jornada o tarea.
Los botones de swipe usan un formato compacto y se muestran centrados en la
altura de la fila; eliminar conserva el diálogo de confirmación existente.
En el encabezado, el conteo y el rango de fechas comparten una línea; debajo,
la fecha de cierre queda alineada a la izquierda y la fecha estimada de pago a
la derecha.

Los períodos **Cobrados** conservan el acordeón: al abrir una fila se ve el
detalle de la liquidación en modo de solo lectura. Para corregir un ítem cobrado
se debe anular el cobro y volver a cobrarlo. El listado de cobrados utiliza
paginación incremental (scroll infinito y botón **Cargar más** cuando aplica).
En cada fila, el rango de fechas y la fecha de cobro se muestran en una sola
línea.

## Gráficos históricos del dashboard

Los gráficos **Histórico** de Ingresos y Gastos, y el gráfico de **Resultados**,
usan una reserva compacta para el eje Y (36 px), etiquetas de 10 px y un padding
izquierdo de 8 px. El ajuste se aplica a estos gráficos sin alterar los demás
gráficos del dashboard. En los gráficos con desplazamiento horizontal, el eje Y
permanece fijo mientras se desplaza el historial.

## Detalle de gastos

Al tocar una fila de gasto se abre el popup **Detalle del gasto**, tanto en la
lista móvil como en la tabla de escritorio. Muestra descripción, categoría,
cuenta, importe y fecha. El área de datos se presenta directamente sobre el
popup, sin un recuadro de fondo adicional.

En móvil, el deslizamiento horizontal de la fila conserva la acción **Eliminar**
y puede comenzar desde cualquier parte de la fila. Un toque simple abre los
detalles; no reemplaza ni interfiere con el gesto de swipe. El campo de búsqueda
usa el placeholder **Buscar**.

## Movimientos de cuentas

En la lista móvil de movimientos, el swipe puede iniciarse desde cualquier parte
de la fila. Las acciones reveladas son **Detalles** y **Eliminar**. **Detalles**
abre un popup con el motivo, categoría, fecha, importe en la moneda de la cuenta,
su equivalente en la moneda predeterminada cuando corresponde y el saldo
posterior. **Eliminar** mantiene el diálogo de confirmación y la reversión del
movimiento.

### Exportar un período

Cada fila de período tiene un botón para exportarla a PDF. El documento incluye:

- nombre del trabajo y estado del período;
- rango de fechas y monto total;
- fecha de cobro, si se trata de una liquidación cobrada con fecha disponible;
- detalle de jornadas y tareas, con fecha, descripción, importe y propina.

Si una liquidación no tiene jornadas ni tareas detalladas, el PDF lo indica y
mantiene el rango y el monto declarados. La descarga se genera en el navegador.

## Motivo del ajuste de cuenta

En el flujo **Ajuste de cuenta**, el campo **Motivo** es opcional. El monto y la
cuenta siguen siendo necesarios para continuar.

El motivo persistido en `movimiento.motivo` sigue estas reglas:

| Texto ingresado | Texto guardado y mostrado |
| --- | --- |
| `Corrección de saldo` | `Ajuste - Corrección de saldo` |
| `Ajuste - Corrección de saldo` | `Ajuste - Corrección de saldo` |
| vacío u omitido | `Ajuste` |

La normalización se aplica en la acción de servidor, es idempotente y limita el
texto para que el motivo completo no exceda los 60 caracteres de la columna
`movimiento.motivo`. La pantalla muestra una vista previa del texto final y la
confirmación presenta ese mismo texto. El campo también está disponible en la
configuración de dictado por voz.

El motivo se comparte con el historial de movimientos de la cuenta, que ya lee
`movimiento.motivo` como descripción antes de recurrir al concepto.

## Referencias de implementación

- Pestañas, filas, swipe y exportación: [`app/(app)/trabajo/components/periodos-grid.tsx`](../app/(app)/trabajo/components/periodos-grid.tsx)
- Integración de períodos y cálculo de ventanas: [`app/(app)/trabajo/trabajo-client.tsx`](../app/(app)/trabajo/trabajo-client.tsx) y [`app/(app)/trabajo/components/use-ventanas-cobro.ts`](../app/(app)/trabajo/components/use-ventanas-cobro.ts)
- Entrada del panel Ingresos: [`app/(app)/dashboard/ingresos/page.tsx`](../app/(app)/dashboard/ingresos/page.tsx)
- Gráficos históricos, márgenes del eje y y paneles de Gastos/Resultados: [`app/(app)/dashboard/dashboard-client.tsx`](../app/(app)/dashboard/dashboard-client.tsx) y [`app/(app)/dashboard/components/line-chart.tsx`](../app/(app)/dashboard/components/line-chart.tsx)
- Popup de detalle de gastos y filas: [`app/(app)/gastos/gastos-client.tsx`](../app/(app)/gastos/gastos-client.tsx) y [`app/(app)/gastos/gasto-row.tsx`](../app/(app)/gastos/gasto-row.tsx)
- Historial, acciones y popup de movimientos de cuentas: [`app/(app)/cuentas/[id]/movimientos-client.tsx`](../app/(app)/cuentas/[id]/movimientos-client.tsx) y [`app/(app)/cuentas/[id]/movimiento-row.tsx`](../app/(app)/cuentas/[id]/movimiento-row.tsx)
- Motivo y vista previa del ajuste: [`app/(app)/movimientos/stepper/ajuste-cuenta.tsx`](../app/(app)/movimientos/stepper/ajuste-cuenta.tsx)
- Confirmación y guardado desde el wizard: [`app/(app)/movimientos/stepper/confirmacion.tsx`](../app/(app)/movimientos/stepper/confirmacion.tsx)
- Validación y persistencia del ajuste: [`backend/src/validation/movimientos.ts`](../backend/src/validation/movimientos.ts) y [`backend/src/actions/movimientos.ts`](../backend/src/actions/movimientos.ts)
- Normalización del motivo: [`lib/motivos-ajuste.ts`](../lib/motivos-ajuste.ts)
- Gestos de swipe compartidos: [`components/crud/SwipeRowActions.tsx`](../components/crud/SwipeRowActions.tsx)
