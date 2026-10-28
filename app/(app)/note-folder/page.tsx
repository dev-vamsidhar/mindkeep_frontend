"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Icon from "@/components/Icon";
import { addFolder, addNote, deleteFolder, isFolder, moveFolder, noteList, parentOf, renameFolder, subFolders, topFolders, useData } from "@/lib/store";

const btn = "p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors";
const pill = "flex items-center gap-1 px-space-md py-1.5 border border-outline-variant/60 hover:bg-surface-container-high rounded-xl font-body-sm text-body-sm font-medium transition-colors";
const snippet = (body: string) => body.replace(/[#>*_`=\[\]-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
const ago = (t: number) => { const d = Math.floor((Date.now() - t) / 86_400_000); return d < 1 ? "today" : d === 1 ? "yesterday" : `${d}d ago`; };

function NoteFolderPage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const data = useData();
  const [renaming, setRenaming] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [moving, setMoving] = useState(false);
  const folder = data.folders[id];

  if (!data.ready) return null;
  if (!isFolder(data, id, "notes")) return <p className="text-on-surface-variant">This folder doesn’t exist. <Link href="/" className="text-primary hover:underline">Go home</Link></p>;

  const parent = parentOf(data, folder);
  const subs = subFolders(data, id);
  const notes = noteList(data, id).sort((a, b) => b.updated_at - a.updated_at);
  const total = notes.length + subs.reduce((n, s) => n + noteList(data, s.id).length, 0);
  const targets = subs.length ? [] : topFolders(data, "notes").filter((f) => f.id !== id);

  const rename = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name")).trim();
    if (name && name !== folder.name) renameFolder(id, name);
    setRenaming(false);
  };
  const remove = () => {
    const what = [subs.length && `${subs.length} sub-folder${subs.length === 1 ? "" : "s"}`, `${total} note${total === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
    if (!confirm(`Delete “${folder.name}” and its ${what}?`)) return;
    deleteFolder(id);
    router.push(parent ? `/note-folder?id=${parent.id}` : "/");
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md">
        <div className="min-w-0">
          {parent && (
            <Link href={`/note-folder?id=${parent.id}`} className="flex items-center gap-1 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors">
              <Icon n="arrow_upward" className="text-[14px]" />{parent.name}
            </Link>
          )}
          {renaming ? (
            <form onSubmit={rename}>
              <input name="name" autoFocus defaultValue={folder.name} maxLength={200} onBlur={(e) => e.currentTarget.form?.requestSubmit()} onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                className="font-headline-lg text-[24px] leading-tight font-semibold sm:text-headline-lg tracking-tight bg-transparent border-b border-primary-container focus:outline-none w-full" />
            </form>
          ) : (
            <h1 className="font-headline-lg text-[24px] leading-tight font-semibold sm:text-headline-lg tracking-tight flex flex-wrap items-center gap-x-space-sm gap-y-1 break-words">
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
          <p className="font-label-sm text-label-sm text-on-surface-variant">{total} note{total === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm shrink-0">
          {!parent && <button type="button" onClick={() => setAddingSub(true)} className={pill}><Icon n="create_new_folder" className="text-[18px]" />Sub-folder</button>}
          <button type="button" onClick={() => router.push(`/note?id=${addNote(id)}&edit=1`)} className="flex items-center gap-1 px-space-md py-1.5 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-body-sm text-body-sm font-medium transition-colors">
            <Icon n="note_add" className="text-[18px]" />New note
          </button>
        </div>
      </div>

      {(subs.length > 0 || addingSub) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-space-md">
          {subs.map((f) => (
            <Link key={f.id} href={`/note-folder?id=${f.id}`} className="bg-surface-container-low border border-outline-variant/40 hover:border-primary-container/60 rounded-xl px-space-lg py-space-md flex items-center justify-between transition-colors">
              <span className="flex items-center gap-space-sm min-w-0"><Icon n="folder" className="text-[18px] text-outline shrink-0" /><span className="font-medium truncate">{f.name}</span></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">{noteList(data, f.id).length} notes</span>
            </Link>
          ))}
          {addingSub && (
            <form onSubmit={createSub} className="bg-surface-container-low border border-primary-container/60 rounded-xl px-space-lg py-space-md flex items-center gap-space-sm">
              <Icon n="create_new_folder" className="text-[18px] text-outline" />
              <input name="name" autoFocus placeholder="Sub-folder name" maxLength={200} onBlur={(e) => !e.currentTarget.value.trim() && setAddingSub(false)} onKeyDown={(e) => e.key === "Escape" && setAddingSub(false)}
                className="flex-1 bg-transparent font-body-md text-body-md focus:outline-none" />
            </form>
          )}
        </section>
      )}

      {notes.length === 0 ? (
        <p className="text-on-surface-variant">{subs.length ? "No notes directly in this folder." : "No notes yet. Create your first one."}</p>
      ) : (
        <div className="flex flex-col divide-y divide-outline-variant/40 bg-surface-container-lowest border border-outline-variant/40 rounded-xl">
          {notes.map((n) => (
            <Link key={n.id} href={`/note?id=${n.id}`} className="px-space-lg py-space-md flex flex-col gap-0.5 hover:bg-surface-container-low transition-colors first:rounded-t-xl last:rounded-b-xl">
              <span className="flex items-center justify-between gap-space-md">
                <span className="font-medium truncate">{n.title || "Untitled"}</span>
                <span className="font-label-sm text-label-sm text-outline shrink-0">{ago(n.updated_at)}</span>
              </span>
              {n.body && <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{snippet(n.body)}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Static export: the id comes from the query string, read inside a Suspense boundary.
export default function Page() {
  return <Suspense><NoteFolderPage /></Suspense>;
}
