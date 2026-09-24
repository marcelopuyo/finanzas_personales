import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/src/lib/auth";
import { getVocabularioSeguro } from "@/backend/src/queries/voz";
import AppLayout from "@/components/layout/app-layout";
import { VozProvider } from "@/components/voz/voz-provider";
import { VozPantallaProvider } from "@/components/voz/dictado-pantalla";
import { RouteCache } from "@/components/pwa/route-cache";

// Layout del grupo protegido (app): si no hay sesión válida, redirige a /login.
// Luego renderiza el AppLayout (top bar global con logo → Resumen y avatar →
// Perfil). No hay sidebar lateral.
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Vocabulario de voz: **una sola consulta** por render del layout (capa de
  // sistema + lo aprendido por el usuario). `Seguro` = si la BD falla devuelve
  // vacío en vez de tirar abajo toda el área protegida (capa opcional).
  const vocabulario = await getVocabularioSeguro();

  // Etiqueta del usuario (tooltip/aria del avatar de la top bar): nombre del
  // usuario logueado (o su email si no tiene nombre), y su primera letra.
  const userLabel = (user.nombre?.trim() || user.email || "Perfil").trim();
  const initial = userLabel.charAt(0).toUpperCase();

  return (
    <VozProvider rows={vocabulario}>
      {/* Puente pantalla ↔ FAB 🎤 (G3): la pantalla actual se declara dictable y
          el FAB global la consulta. Envuelve al contenido **y** al FAB. */}
      <VozPantallaProvider>
        <AppLayout initial={initial} userLabel={userLabel}>
          {/* PWA: guarda/refresca el documento de cada pantalla visitada para poder
              verla sin conexión. Solo acá (área autenticada): /login nunca se cachea. */}
          <RouteCache />
          {children}
        </AppLayout>
      </VozPantallaProvider>
    </VozProvider>
  );
}
