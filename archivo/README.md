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

## Qué NO se archivó (a propósito)

- **`backend/scripts/*.mjs`** (`migrate-to-pg.mjs`, `backfill-*.mjs`, `seed-admin.mjs`,
  `test-db.mjs`, `gen-demo-ejemplo.mjs`): son herramientas de operación. La bitácora
  (`DeepSeek/bitacora.backend.md` §514) marca `mssql` + `migrate-to-pg.mjs` como
  **“se CONSERVAN a propósito, NO eliminar”**.
- **`favicons/`**: fuentes de los íconos (`p-transparente.svg` → `app/icon.svg`) y
  galerías de preview de diseño que se siguen usando como referencia.
- **`DeepSeek/`**: documentación del proyecto (además está en `.gitignore`).
