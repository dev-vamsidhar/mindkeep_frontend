import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <div className="pl-60 min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="pt-14 flex-1">
          <div className="max-w-7xl mx-auto p-space-xl w-full">{children}</div>
        </main>
      </div>
    </>
  );
}
