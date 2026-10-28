"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addFolder, cardList, noteList, stats, subFolders, topFolders, useData, type Data, type Folder, type Kind, type Note } from "@/lib/store";
import Icon from "./Icon";
import ProfileMenu from "./ProfileMenu";

const row = (on: boolean) =>
  `flex items-center justify-between px-space-md py-1.5 rounded-lg font-body-sm text-body-sm transition-colors ${
    on ? "bg-secondary-container text-on-secondary-fixed-variant font-medium" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
  }`;
const KEY = "sidebar-collapsed"; // per-device UI preference, so it stays out of sync

export default function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const id = useSearchParams().get("id");
  const path = id ? `${pathname}?id=${id}` : pathname; // compared against row hrefs to highlight the open item
  const router = useRouter();
  const data = useData();
  const [collapsed, setCollapsed] = useState<string[]>([]); // main folders are expanded by default
  useEffect(() => { try { setCollapsed(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch {} }, []);
  const toggle = (id: string) => setCollapsed((c) => {
    const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  const inReview = pathname === "/review-queue" || pathname === "/review";
  const due = stats(data).dueToday;
  const nav = [
    { href: "/", icon: "home", label: "Home" },
    { href: "/review-queue", icon: "style", label: "Review", badge: due > 0 ? String(due) : "" },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-[100dvh] w-64 md:w-60 bg-surface z-50 flex flex-col transition-transform md:translate-x-0 ${open ? "translate-x-0 shadow-xl" : "-translate-x-full"} border-r border-outline-variant/40 px-space-md py-space-lg gap-space-lg overflow-y-auto`}>
      <Link href="/" className="px-space-md font-headline-sm text-headline-sm tracking-tight">Recall</Link>

      <nav className="flex flex-col gap-0.5">
        {nav.map((i) => (
          <Link key={i.href} href={i.href} className={row(i.href === "/" ? pathname === "/" : inReview)}>
            <span className="flex items-center gap-space-sm"><Icon n={i.icon} className="text-[18px]" />{i.label}</span>
            {i.badge && <span className="font-label-sm text-label-sm text-primary font-semibold">{i.badge}</span>}
          </Link>
        ))}
      </nav>

      <Tree kind="notes" title="Notes" data={data} path={path} collapsed={collapsed} toggle={toggle} onCreate={(id) => router.push(`/note-folder?id=${id}`)} />
      <Tree kind="cards" title="Library" data={data} path={path} collapsed={collapsed} toggle={toggle} onCreate={(id) => router.push(`/folder?id=${id}`)} />
      <ProfileMenu />
    </aside>
  );
}

const folderHref = (kind: Kind, id: string) => (kind === "notes" ? `/note-folder?id=${id}` : `/folder?id=${id}`);

function Chevron({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      className="w-5 h-5 -mr-1 shrink-0 flex items-center justify-center rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors">
      <Icon n="chevron_right" className={`text-[16px] transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
  );
}
const Spacer = () => <span className="w-5 -mr-1 shrink-0" />;

function Row({ href, path, icon, name, count }: { href: string; path: string; icon: string; name: string; count?: number }) {
  return (
    <Link href={href} className={`flex-1 min-w-0 ${row(path === href)}`}>
      <span className="flex items-center gap-space-sm truncate">
        <Icon n={icon} className="text-[18px] text-outline shrink-0" />
        <span className="truncate">{name}</span>
      </span>
      {count !== undefined && <span className="font-label-sm text-label-sm text-outline shrink-0 ml-1">{count}</span>}
    </Link>
  );
}

// One sidebar section: main folders, their sub-folders, and (for notes) the notes inside each folder.
// Any folder with something inside can be collapsed; the state is kept per device by the caller.
function Tree({ kind, title, data, path, collapsed, toggle, onCreate }: {
  kind: Kind; title: string; data: Data; path: string; collapsed: string[]; toggle: (id: string) => void; onCreate: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const notes = kind === "notes";
  const create = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    setAdding(false);
    if (name) onCreate(addFolder(name, null, kind));
  };
  const noteRows = (f: Folder, indent: string) =>
    notes && noteList(data, f.id).map((n: Note) => (
      <div key={n.id} className={`flex ${indent}`}><Spacer /><Row href={`/note?id=${n.id}`} path={path} icon="description" name={n.title || "Untitled"} /></div>
    ));
  const folder = (f: Folder, depth: 0 | 1) => {
    const subs = depth === 0 ? subFolders(data, f.id) : [];
    const hasKids = subs.length > 0 || (notes && noteList(data, f.id).length > 0);
    const open = !collapsed.includes(f.id);
    const href = folderHref(kind, f.id);
    const indent = depth ? "pl-space-lg" : "";
    return (
      <div key={f.id} className="flex flex-col gap-0.5">
        <div className={`flex items-center ${indent}`}>
          {hasKids ? <Chevron open={open} label={f.name} onClick={() => toggle(f.id)} /> : <Spacer />}
          <Row href={href} path={path} icon={path === href ? "folder_open" : "folder"} name={f.name}
            count={notes ? undefined : cardList(data, f.id).length} />
        </div>
        {open && <>{subs.map((s) => folder(s, 1))}{noteRows(f, depth ? "pl-space-xl" : "pl-space-lg")}</>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center justify-between px-space-md pb-space-xs font-label-sm text-label-sm text-outline uppercase tracking-wider">
        {title}
        <button type="button" onClick={() => setAdding(true)} aria-label={`New ${notes ? "note folder" : "folder"}`} title={`New ${notes ? "note folder" : "folder"}`} className="p-0.5 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors">
          <Icon n="add" className="text-[16px]" />
        </button>
      </span>
      {topFolders(data, kind).map((f) => folder(f, 0))}
      {notes && !adding && topFolders(data, kind).length === 0 && (
        <button type="button" onClick={() => setAdding(true)} className="px-space-md py-1 text-left font-body-sm text-body-sm text-outline hover:text-on-surface transition-colors">+ Create a notes folder</button>
      )}
      {adding && (
        <form onSubmit={create} className="px-space-xs pt-space-xs">
          <input
            name="name" autoFocus placeholder="Folder name" maxLength={200}
            onBlur={(e) => !e.currentTarget.value.trim() && setAdding(false)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            className="w-full px-space-sm py-1.5 bg-surface-container-lowest border border-outline-variant/50 rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
          />
        </form>
      )}
    </div>
  );
}
