import Sidebar from "./sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#151517] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-14 lg:p-6 lg:pt-6">{children}</main>
    </div>
  );
}
