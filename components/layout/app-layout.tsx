import TopBar from "./top-bar";

/**
 * Layout del área protegida de la app: una ÚNICA top bar fija (logo a la
 * izquierda → Resumen, avatar a la derecha → Perfil) + el contenido que
 * scrollea debajo. No hay sidebar lateral (2026-09-09): la navegación vive en
 * el dashboard y el contenido deja 3.5rem (h-14) arriba en todos los tamaños.
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
    <div className="h-screen overflow-hidden bg-background">
      <TopBar initial={initial} userLabel={userLabel} />
      <main className="h-full overflow-y-auto px-4 pt-14 pb-4 lg:px-6 lg:pb-6 lg:pt-14">
        {children}
      </main>
    </div>
  );
}
