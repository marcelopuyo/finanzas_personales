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
        // El inferior reserva la franja del **FAB de voz** (`pb-[4.5rem]`): como el
        // FAB es `fixed` y el pie de los formularios va en el flujo (botones
        // "Siguiente"/"Guardar"), sin esta reserva el botón quedaría tapado por el
        // FAB al llegar al final. Es la implementación de "apilado sobre la acción
        // primaria" (R4) cuando la acción no es flotante.
        className="px-4 pt-[var(--app-top)] pb-[4.5rem] lg:px-6"
      >
        {/* Aviso "sin conexión": es `sticky`, así que empuja el contenido solo
            cuando está visible. */}
        <OfflineNotice />
        {children}
      </PullToRefresh>
      {/* FAB 🎤 global (2026-09-23, fase G1 del replanteo de la voz). Va FUERA de
          PullToRefresh porque maneja sus propios touch events y no debe disparar
          el gesto de "tirar para actualizar". */}
      <VozFab />
    </div>
  );
}
