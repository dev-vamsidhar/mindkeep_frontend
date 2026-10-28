"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

// Desktop: sidebar always shown. Phones/tablets (< md): the sidebar slides in from the ☰ button.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => setMenu(false), [pathname, search]); // close after navigating

  return (
    <>
      <Sidebar open={menu} />
      {menu && <div className="fixed inset-0 z-[45] bg-black/50 md:hidden" onClick={() => setMenu(false)} aria-hidden />}
      <div className="md:pl-60 min-h-screen flex flex-col bg-surface">
        <Header onMenu={() => setMenu(true)} />
        <main className="pt-14 flex-1 min-w-0">
          <div className="max-w-7xl mx-auto p-space-md md:p-space-xl w-full">{children}</div>
        </main>
      </div>
    </>
  );
}
