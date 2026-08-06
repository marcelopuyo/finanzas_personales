import Sidebar from "./sidebar";

export default function AppLayout({
  children,
  esAdmin = false,
}: {
  children: React.ReactNode;
  esAdmin?: boolean;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar esAdmin={esAdmin} />
      <main className="flex-1 overflow-y-auto p-4 pt-14 lg:p-6 lg:pt-6">{children}</main>
    </div>
  );
}
