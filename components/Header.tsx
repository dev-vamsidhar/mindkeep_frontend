"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cardList, folderPath, noteList, useData } from "@/lib/store";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";

export default function Header({ onMenu }: { onMenu: () => void }) {
  const data = useData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const needle = q.trim().toLowerCase();
  // Notes first (title or text, so "#tag" finds tagged notes), then cards.
  const hits = needle ? [
    ...noteList(data).filter((n) => `${n.title}\n${n.body}`.toLowerCase().includes(needle))
      .map((n) => ({ id: n.id, href: `/note?id=${n.id}`, title: n.title || "Untitled", where: folderPath(data, n.folder_id), icon: "description" })),
    ...cardList(data).filter((c) => `${c.front}\n${c.back}\n${c.tags.join(" ")}`.toLowerCase().includes(needle))
      .map((c) => ({ id: c.id, href: `/folder?id=${c.folder_id}#${c.id}`, title: c.front, where: folderPath(data, c.folder_id), icon: "style" })),
  ].slice(0, 10) : [];

  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  return (
    <header className="fixed top-0 left-0 md:left-60 right-0 h-14 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 z-40 flex items-center justify-between gap-space-sm px-space-md md:px-space-xl">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="md:hidden -ml-1 p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
        <Icon n="menu" className="text-[22px]" />
      </button>
      <div ref={ref} className="relative flex items-center flex-1 min-w-0 md:flex-none">
        <Icon n="search" className="absolute left-3 text-outline text-[18px]" />
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && (setOpen(false), e.currentTarget.blur())}
          placeholder="Search notes and cards..."
          className="w-full md:w-72 pl-9 pr-3 py-1.5 bg-surface-container-lowest border border-outline-variant/50 rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
        />
        {open && needle && (
          <div className="absolute top-full left-0 mt-1 w-[min(24rem,calc(100vw-2rem))] bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-lg p-space-xs flex flex-col">
            {hits.length === 0 ? (
              <span className="px-space-md py-space-sm font-body-sm text-body-sm text-outline">Nothing matches “{q.trim()}”.</span>
            ) : hits.map((h) => (
              <Link key={h.id} href={h.href} onClick={() => setOpen(false)} className="px-space-md py-space-sm rounded-lg hover:bg-surface-container-high transition-colors flex items-start gap-space-sm">
                <Icon n={h.icon} className="text-[16px] text-outline mt-0.5 shrink-0" />
                <span className="flex flex-col min-w-0">
                  <span className="font-body-sm text-body-sm text-on-surface truncate">{h.title}</span>
                  <span className="font-label-sm text-label-sm text-outline truncate">{h.where}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <ThemeToggle />
    </header>
  );
}
