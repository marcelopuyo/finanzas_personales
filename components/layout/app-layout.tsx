import TopBar from "./top-bar";
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
    <div className="h-dvh overflow-hidden bg-background">
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
        {children}
        {/* Espaciador del FAB de voz: reserva la franja inferior para que el
            último elemento del contenido (típicamente los botones "Siguiente"
            /"Guardar" de los formularios, que van EN EL FLUJO) nunca quede
            debajo del FAB. Va como elemento y no como `padding-bottom` del
            contenedor de scroll porque el padding de un `overflow: auto` no es
            confiable en iOS. La altura suma el safe-area porque el FAB también
            sube con él (PWA standalone en iPhone con home indicator). */}
        <div
          aria-hidden="true"
          style={{ height: "calc(5rem + env(safe-area-inset-bottom))" }}
        />
      </PullToRefresh>
      {/* FAB 🎤 global (2026-09-23, fase G1 del replanteo de la voz). Va FUERA de
          PullToRefresh porque maneja sus propios touch events y no debe disparar
          el gesto de "tirar para actualizar". */}
      <VozFab />
    </div>
  );
}
