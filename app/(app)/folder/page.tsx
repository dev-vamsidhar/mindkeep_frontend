"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import CardForm from "@/components/CardForm";
import Icon from "@/components/Icon";
import Md from "@/components/Md";
import { addFolder, cardList, deleteCard, deleteFolder, dueLabel, inQueue, isFolder, moveFolder, parentOf, renameFolder, subFolders, topFolders, updateCard, useData, type Card } from "@/lib/store";

const btn = "p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors";

function FolderPage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const data = useData();
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [moving, setMoving] = useState(false);
  const folder = data.folders[id];

  if (!data.ready) return null;
  if (!isFolder(data, id)) return <p className="text-on-surface-variant">This folder doesn’t exist. <Link href="/" className="text-primary hover:underline">Go home</Link></p>;

  const parent = parentOf(data, folder);
  const subs = subFolders(data, id);
  const all = cardList(data, id); // includes sub-folders
  const due = all.filter((c) => inQueue(c)).length;
  const cards = all.filter((c) => c.folder_id === id).sort((a, b) => a.due - b.due || a.created_at - b.created_at);
  // Where this folder can move: top level, or under another top-level folder (only if it has no sub-folders itself).
  const targets = subs.length ? [] : topFolders(data).filter((f) => f.id !== id);

  const rename = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    if (name && name !== folder.name) renameFolder(id, name);
    setRenaming(false);
  };
  const remove = () => {
    const what = [subs.length && `${subs.length} sub-folder${subs.length === 1 ? "" : "s"}`, `${all.length} card${all.length === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
    if (!confirm(`Delete “${folder.name}” and its ${what}?`)) return;
    deleteFolder(id);
    router.push(parent ? `/folder?id=${parent.id}` : "/");
  };
  const createSub = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    setAddingSub(false);
    if (name) addFolder(name, id);
  };
  const move = (to: string) => {
    setMoving(false);
    try { moveFolder(id, to || null); } catch (err) { alert((err as Error).message); }
  };

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex items-end justify-between gap-space-md">
        <div className="min-w-0">
          {parent && (
            <Link href={`/folder?id=${parent.id}`} className="flex items-center gap-1 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors">
              <Icon n="arrow_upward" className="text-[14px]" />{parent.name}
            </Link>
          )}
          {renaming ? (
            <form onSubmit={rename}>
              <input name="name" autoFocus defaultValue={folder.name} maxLength={200} onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                className="font-headline-lg text-headline-lg tracking-tight bg-transparent border-b border-primary-container focus:outline-none w-full" />
            </form>
          ) : (
            <h1 className="font-headline-lg text-headline-lg tracking-tight flex items-center gap-space-sm">
              {folder.name}
              <button type="button" onClick={() => setRenaming(true)} aria-label="Rename folder" title="Rename" className={btn}><Icon n="edit" className="text-[18px]" /></button>
              {(targets.length > 0 || parent) && (
                <button type="button" onClick={() => setMoving((v) => !v)} aria-label="Move folder" title="Move" className={btn}><Icon n="drive_file_move" className="text-[18px]" /></button>
              )}
              <button type="button" onClick={remove} aria-label="Delete folder" title="Delete folder" className={`${btn} hover:text-error`}><Icon n="delete" className="text-[18px]" /></button>
            </h1>
          )}
          {moving && (
            <select autoFocus defaultValue={parent?.id ?? ""} onChange={(e) => move(e.target.value)} onBlur={() => setMoving(false)} aria-label="Move to"
              className="mt-1 px-space-sm py-1 bg-surface-container-lowest border border-outline-variant/50 rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary-container">
              <option value="">Top level</option>
              {targets.map((f) => <option key={f.id} value={f.id}>Inside {f.name}</option>)}
            </select>
          )}
          <p className="font-label-sm text-label-sm text-on-surface-variant">{all.length} cards · {due} due</p>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          {!parent && (
            <button type="button" onClick={() => setAddingSub(true)} className="flex items-center gap-1 px-space-md py-1.5 border border-outline-variant/60 hover:bg-surface-container-high rounded-xl font-body-sm text-body-sm font-medium transition-colors">
              <Icon n="create_new_folder" className="text-[18px]" />Sub-folder
            </button>
          )}
          <button type="button" onClick={() => setEditing("new")} className="flex items-center gap-1 px-space-md py-1.5 border border-outline-variant/60 hover:bg-surface-container-high rounded-xl font-body-sm text-body-sm font-medium transition-colors">
            <Icon n="add" className="text-[18px]" />Add card
          </button>
          {due > 0 && (
            <Link href={`/review-queue?folder=${id}`} className="px-space-md py-1.5 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-body-sm text-body-sm font-medium transition-colors">
              Review
            </Link>
          )}
        </div>
      </div>

      {(subs.length > 0 || addingSub) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md">
          {subs.map((f) => {
            const c = cardList(data, f.id);
            const d = c.filter((x) => inQueue(x)).length;
            return (
              <Link key={f.id} href={`/folder?id=${f.id}`} className="bg-surface-container-low border border-outline-variant/40 hover:border-primary-container/60 rounded-xl px-space-lg py-space-md flex items-center justify-between transition-colors">
                <span className="flex items-center gap-space-sm min-w-0"><Icon n="folder" className="text-[18px] text-outline shrink-0" /><span className="font-medium truncate">{f.name}</span></span>
                <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">{c.length} cards{d > 0 && <span className="text-primary"> · {d} due</span>}</span>
              </Link>
            );
          })}
          {addingSub && (
            <form onSubmit={createSub} className="bg-surface-container-low border border-primary-container/60 rounded-xl px-space-lg py-space-md flex items-center gap-space-sm">
              <Icon n="create_new_folder" className="text-[18px] text-outline" />
              <input name="name" autoFocus placeholder="Sub-folder name" maxLength={200} onBlur={(e) => !e.currentTarget.value.trim() && setAddingSub(false)} onKeyDown={(e) => e.key === "Escape" && setAddingSub(false)}
                className="flex-1 bg-transparent font-body-md text-body-md focus:outline-none" />
            </form>
          )}
        </section>
      )}

      {cards.length === 0 ? (
        <p className="text-on-surface-variant">{subs.length ? "No cards directly in this folder." : "No cards yet. Add your first one."}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md">
          {cards.map((c) => {
            const label = dueLabel(c);
            return (
              <article key={c.id} id={c.id} className="group bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-space-lg flex flex-col gap-space-md hover:border-primary-container/60 target:border-primary-container transition-colors">
                <p className="font-card text-[17px] leading-snug font-semibold"><Md text={c.front} /></p>
                <hr className="border-outline-variant/40" />
                <p className="font-card text-[15px] leading-relaxed text-on-surface-variant flex-1"><Md text={c.back} /></p>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{c.tags.map((t) => <span key={t} className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded text-outline">#{t}</span>)}</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-outline">{label === "Today" ? <span className="text-primary">Due today</span> : label === "New" ? <span className="text-primary">New</span> : `Due ${label}`}</span>
                  <span className="flex items-center gap-0.5">
                    <button type="button" onClick={() => updateCard(c.id, { starred: c.starred ? 0 : 1 })} aria-pressed={!!c.starred} aria-label="Star card" className={`${btn} ${c.starred ? "text-amber-500" : "opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-amber-500"}`}>
                      <Icon n="star" fill={!!c.starred} className="text-[16px]" />
                    </button>
                    <button type="button" onClick={() => setEditing(c)} aria-label="Edit card" className={`${btn} opacity-0 group-hover:opacity-100 focus:opacity-100`}><Icon n="edit" className="text-[16px]" /></button>
                    <button type="button" onClick={() => confirm("Delete this card?") && deleteCard(c.id)} aria-label="Delete card" className={`${btn} opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-error`}><Icon n="delete" className="text-[16px]" /></button>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && <CardForm card={editing === "new" ? undefined : editing} folderId={id} onClose={() => setEditing(null)} />}
    </div>
  );
}

// Static export: the id comes from the query string, read inside a Suspense boundary.
export default function Page() {
  return <Suspense><FolderPage /></Suspense>;
}
