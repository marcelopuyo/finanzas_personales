import Sidebar from "./sidebar";

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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar initial={initial} userLabel={userLabel} />
      <main className="flex-1 overflow-y-auto p-4 pt-14 lg:p-6 lg:pt-6">{children}</main>
    </div>
  );
}
