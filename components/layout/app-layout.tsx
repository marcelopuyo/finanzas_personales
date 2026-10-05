import TopBar from "./top-bar";
import BottomNav from "./bottom-nav";
import { AnclajeBarras } from "./anclaje-barras";
import { ZoomContenido } from "./zoom-contenido";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { NavProgress } from "@/components/ui/nav-progress";
import { OfflineNotice } from "@/components/pwa/offline-notice";
import { VozFab } from "@/components/voz/voz-fab";

/**
 * Layout del área protegida de la app: una ÚNICA top bar fija (logo a la
 * izquierda → Resumen, avatar a la derecha → Perfil) + el contenido que
 * scrollea debajo. No hay sidebar lateral (2026-09-09): la navegación vive en
 * el dashboard y el contenido deja 3.5rem (h-14) arriba en todos los tamaños.
 *
 * El contenido va dentro de `PullToRefresh`, que es quien renderiza el `<main>`
 * que scrollea: ahí vive el gesto de "tirar para actualizar" (con el dedo en
 * mobile, y en desktop con la rueda/trackpad o arrastrando con el mouse).
 *
 * Los dos providers de la voz (`VozProvider` + `VozPantallaProvider`) se montan
 * **por fuera**, en `app/(app)/layout.tsx`: así envuelven al contenido y al FAB.
 */
export default function AppLayout({
  children,
  initial = "U",
  userLabel = "Perfil",
}: {
  children: React.ReactNode;
  initial?: string;
  userLabel?: string;
}) {
  return (
    <div data-app-shell="" className="h-dvh overflow-hidden bg-background">
      <TopBar initial={initial} userLabel={userLabel} />
      {/* Barra de progreso global de navegación (2026-09-14): se enciende con
          `startNav()`/`usePendingNav()` y se apaga al cambiar de ruta. */}
      <NavProgress />
      <PullToRefresh
        variant="android"
        // El padding superior (`--app-top`, en globals.css) suma el safe-area: en
        // standalone (PWA) la top bar es `fixed` y crece con
        // `env(safe-area-inset-top)` para no quedar bajo el notch / la barra de
        // estado (viewport-fit: cover).
        //
        // El inferior vuelve a 4/6 y la reserva del FAB se hace con el
        // espaciador `h-20` de abajo (más confiable en iOS).
        className="px-4 pt-[var(--app-top)] pb-4 lg:px-6 lg:pb-6"
      >
        {/* Aviso "sin conexión": es `sticky`, así que empuja el contenido solo
            cuando está visible. */}
        <OfflineNotice />
        {/* Zoom propio del contenido (2026-10-04): la capa que recibe el `zoom` de
            CSS. Deja afuera las barras y los FAB (que van fuera del `<main>`) y el
            espaciador del pie, que tiene que seguir midiendo lo mismo que la barra
            inferior **sin** escalar. Se apaga con `ZOOM_ACTIVO = false`. */}
        <ZoomContenido>{children}</ZoomContenido>
        {/* Espaciador del pie: reserva la **barra inferior** (4rem) + la franja de
            los FAB (el "+" de Inicio) para que el último elemento del contenido —
            típicamente los botones "Siguiente"/"Guardar" de los formularios, que van
            EN EL FLUJO— nunca quede tapado. Va como elemento y no como
            `padding-bottom` del contenedor de scroll porque el padding de un
            `overflow: auto` no es confiable en iOS. La altura suma el safe-area
            porque la barra y los FAB también suben con él. */}
        <div
          aria-hidden="true"
          style={{ height: "calc(8.75rem + env(safe-area-inset-bottom))" }}
        />
      </PullToRefresh>
      {/* Barra inferior de navegación (2026-10-01, rama `rediseno-ui`): 5 destinos
          de primer nivel. Va FUERA de PullToRefresh para no participar del gesto. */}
      <BottomNav />
      {/* Anclaje de las barras a los bordes **visibles** (2026-10-04): con
          pinch-zoom, teclado o un viewport trabado, `fixed` deja de coincidir con
          lo que se ve y las barras “se despegan”. No dibuja nada: publica dos
          variables CSS que consumen la barra de arriba y la de abajo. */}
      <AnclajeBarras />
      {/* Panel de diagnóstico de las barras: ⚠️ **queda en el repo pero NO montado**
          (2026-10-05, al cerrar el caso de la barra despegada en iOS). Para volver a
          usarlo, montá `<DiagBarras />` acá y abrí la app con `?diag=1` (en la PWA
          instalada se enciende solo). Ver `components/layout/diag-barras.tsx` y
          `DeepSeek/bitacora.md` §224-§225. */}
      {/* FAB 🎤 global (2026-09-23, fase G1 del replanteo de la voz). Va FUERA de
          PullToRefresh porque maneja sus propios touch events y no debe disparar
          el gesto de "tirar para actualizar".
          ⚠️ Desde la rama `rediseno-ui` su **disparador vive en la top bar** y este
          componente solo se ocupa de la burbuja (ver `top-bar.tsx`). */}
      <VozFab />
    </div>
  );
}
