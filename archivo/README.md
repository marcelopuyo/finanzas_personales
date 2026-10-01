# `archivo/` — código y assets muertos (2026-09-16)

Carpeta de **archivo**: aquí se mueven los componentes/archivos que **no se usan** en
ninguna parte de la app (verificado con búsqueda de referencias en `app/`, `components/`,
`lib/`, `types/`, `backend/` y `public/`).

**Se conserva la ruta original** debajo de `archivo/`, así reponer un archivo es un solo
`Move-Item` a su ubicación de origen. Nada de lo que está acá se importa desde la app, así
que no afecta al build ni al runtime.

> 🚫 Esta carpeta está **excluida del type-check y del lint**: `"archivo"` en el
> `exclude` de `tsconfig.json` y `"archivo/**"` en `globalIgnores` de `eslint.config.mjs`.
> Es decir, nada de acá se compila, se lintea ni entra al build de Next.
>
> ℹ️ Los imports relativos de los 2 `.tsx` archivados se reescribieron igual con el alias
> `@/` (ej. `@/components/layout/theme-provider`) para que **si algún día se reponen** en su
> ubicación original no haya que arreglarlos a mano.

## Contenido y motivo

| Archivo | Motivo |
| --- | --- |
| `components/layout/theme-toggle.tsx` | Botón claro/oscuro. Solo lo importaba el sidebar viejo, que quedó copiado en `temp_sidebar.txt`; el sidebar actual (`components/layout/top-bar.tsx`) ya no lo usa. |
| `components/ui/stat-card.tsx` | `StatCard` + `StatCardSkeleton`: quedaron sin uso tras el rediseño del dashboard (hoy se usan `stat-badge.tsx` y las tarjetas propias). |
| `app/(app)/dashboard/components/bar-chart.tsx` | `StackedBarChart` (barras apiladas). Ningún componente lo importa; el dashboard usa `line-chart.tsx`, `donut-chart.tsx`, `prestamos-chart.tsx` y `sparkline-chart.tsx`. |
| `types/index.ts` | DTOs y enums del backend original (SQL Server: `ResponseXDto`, `CategoriaConcepto`, `MotivoMovimiento`). Hoy los tipos viven junto a cada módulo y **nadie importa este archivo**. |
| `temp_sidebar.txt` | Copia de trabajo del sidebar anterior (código viejo, no es parte del build). |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | SVGs de ejemplo que trae el starter de Next.js; no se referencian en ninguna página ni en `app/manifest.ts`. |
| `backend/scripts/_shot-balance2.png` | Captura suelta de QA. |
| `app/(app)/dashboard/components/gastos-detalle.tsx` | `GastosDetalle` (grilla `DataTable` del panel **Gastos → Detalle**) + `gastosDetalleColumns`. La pestaña pasó a **tarjetas de los últimos 3 días** (`gastos-tarjetas.tsx`) y el buscador + la lista completa viven en la pantalla **`/gastos`** (2026-09-30). |
| `app/(app)/dashboard/components/ingresos-detalle.tsx` | `IngresosDetalle` (grilla `DataTable` del panel **Ingresos → Detalle**, con el sparkline de jornadas/tareas) + `ingresosDetalleColumns` y sus helpers. La pestaña pasó a **tarjetas de los últimos 3 meses** (`ingresos-tarjetas.tsx`, con el modelo de fila en `ingresos-filas.ts`) y la lista completa es la pantalla **`/trabajo`** (2026-09-30). ⚠️ Su otro consumidor era `ActividadCell`, que sólo usaba el `list-client.tsx` **archivado** de `periodos-trabajo` ⇒ si algún día se repone ese CRUD, hay que reponer los dos juntos. |

### Rediseño "períodos gestionados → liquidaciones" (2026-09-26)

El usuario **deja de gestionar períodos**: la **liquidación nace al cobrar** y sólo
existe como hecho del cobro (`DeepSeek/plan-liquidaciones.md`, decisiones P1/P1.b/P1.a.5).
Los 3 CRUDs que administraban el circuito viejo quedaron **sin punto de entrada** (el
panel "Trabajo" del dashboard ahora lista **ítems pendientes de cobro** y la carga de
jornadas/tareas se hace desde el wizard de movimientos) ⇒ se archivan enteros.

| Archivo | Motivo |
| --- | --- |
| `app/(app)/cruds/periodos-trabajo/**` | CRUD de períodos: en el modelo nuevo no hay nada que gestionar (el cobro crea la liquidación) y su acción "cobrar" quedó reemplazada por el paso **"Cobrar trabajo"** del wizard. |
| `app/(app)/cruds/jornadas-trabajo/**` | CRUD de jornadas: la jornada se carga desde el wizard (nace **pendiente de liquidar**) y su edición se resuelve anulando/recargando. |
| `app/(app)/cruds/tareas-trabajo/**` | Ídem tareas (`por_tarea`). |
| `app/(app)/dashboard/components/periodos-modal.tsx` | Popup de las **tarjetas sintéticas** de períodos ("Por cobrar"/"Actuales"): las tarjetas ya no se renderizan y el modal quedó sin ningún disparador. |

⚠️ **Al reponerlos** (no debería hacer falta): el circuito viejo de "período abierto" **ya no existe en el
backend** — `cobrarSueldo` fue retirada, `actions/trabajos.ts` quedó **sólo con las acciones de TRABAJO**
(alta/edición/baja) y los schemas de período/jornada/tarea se borraron de `validation/trabajos.ts`; tampoco
existen `calcularMontoACobrarPorModalidad`, `encontrarPeriodoSuperpuesto`, `aporteProrrateado`,
`cobroAdelantado`, `periodoCobrable` ni `periodoComenzado` ⇒ **habría que rehacer las acciones**, no sólo
mover los archivos. Las páginas de `app/(app)/cruds/{periodos,jornadas,tareas}-trabajo/` son las únicas que
importaban esas acciones (por eso están acá).

## Qué NO se archivó (a propósito)

- **`backend/scripts/*.mjs`** (`migrate-to-pg.mjs`, `backfill-*.mjs`, `seed-admin.mjs`,
  `test-db.mjs`, `gen-demo-ejemplo.mjs`): son herramientas de operación. La bitácora
  (`DeepSeek/bitacora.backend.md` §514) marca `mssql` + `migrate-to-pg.mjs` como
  **“se CONSERVAN a propósito, NO eliminar”**.
- **`favicons/`**: fuentes de los íconos (`p-transparente.svg` → `app/icon.svg`) y
  galerías de preview de diseño que se siguen usando como referencia.
- **`DeepSeek/`**: documentación del proyecto (además está en `.gitignore`).
