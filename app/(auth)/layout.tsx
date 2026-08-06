// Layout del grupo (auth): login/register/verificación. NO tiene AppLayout
// (sin sidebar). El tema lo provee el layout raíz (ThemeProvider).
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
