"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import LiveEditor from "@/components/LiveEditor";
import { linksIn, renderMarkdown, toggleTask } from "@/lib/markdown";
import { addNote, deleteNote, findNote, folderPath, folderTree, isFolder, noteList, updateNote, useData } from "@/lib/store";

const SAVE_MS = 400; // typing is saved locally after a short pause; syncing to the server is lazier still

function NotePage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const data = useData();
  const note = data.notes[id];
  const [editing, setEditing] = useState(true); // Live Preview by default; the toggle switches to Reading view
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<{ id: string; title: string; body: string } | null>(null);

  const flush = () => {
    clearTimeout(pending.current);
    pending.current = undefined;
    const l = latest.current;
    if (l) { latest.current = null; updateNote(l.id, { title: l.title, body: l.body }); }
  };

  // Take the stored version whenever we have no unsaved typing (first load, or a change synced from another device).
  useEffect(() => { if (note && !pending.current) setDraft({ title: note.title, body: note.body }); }, [note]);
  useEffect(() => () => flush(), [id]); // save on leaving the note

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") { e.preventDefault(); setEditing((v) => !v); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const folderId = note?.folder_id;
  const resolve = (title: string) => findNote(data, title, folderId)?.id;
  const html = useMemo(() => (draft && !editing ? renderMarkdown(draft.body, resolve) : ""), [draft, editing, data.notes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.ready || !draft) return null;
  if (!note || note.deleted || !isFolder(data, note.folder_id, "notes")) {
    return <p className="text-on-surface-variant">This note doesn’t exist. <Link href="/" className="text-primary hover:underline">Go home</Link></p>;
  }

  const change = (patch: Partial<{ title: string; body: string }>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    latest.current = { id, ...next };
    clearTimeout(pending.current);
    pending.current = setTimeout(flush, SAVE_MS);
  };
  const remove = () => {
    if (!confirm(`Delete “${draft.title || "Untitled"}”?`)) return;
    clearTimeout(pending.current);
    pending.current = undefined;
    latest.current = null;
    deleteNote(id);
    router.push(`/note-folder?id=${note.folder_id}`);
  };

  const openNote = (title: string) => {
    flush();
    const hit = findNote(data, title, note.folder_id);
    router.push(hit ? `/note?id=${hit.id}` : `/note?id=${addNote(note.folder_id, title)}`);
  };

  // Reading view: follow [[links]] (creating missing notes, like Obsidian) and tick checkboxes.
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const a = t.closest("a");
    if (a?.classList.contains("wiki")) {
      e.preventDefault();
      flush();
      const missing = a.getAttribute("data-missing");
      router.push(missing ? `/note?id=${addNote(note.folder_id, missing)}&edit=1` : a.getAttribute("href")!);
    } else if (t instanceof HTMLInputElement && t.type === "checkbox") {
      const boxes = [...e.currentTarget.querySelectorAll('input[type="checkbox"]')];
      const body = toggleTask(draft.body, boxes.indexOf(t));
      setDraft({ ...draft, body });
      flush();
      updateNote(id, { body });
    }
  };

  const title = draft.title.trim().toLowerCase();
  const backlinks = title ? noteList(data).filter((n) => n.id !== id && linksIn(n.body).includes(title)) : [];

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-space-lg">
      <div className="flex items-center justify-between gap-space-md">
        <Link href={`/note-folder?id=${note.folder_id}`} className="flex items-center gap-1 font-label-sm text-label-sm text-outline hover:text-on-surface transition-colors truncate">
          <Icon n="folder" className="text-[14px]" />{folderPath(data, note.folder_id)}
        </Link>
        <div className="flex items-center gap-space-xs shrink-0">
          <select value={note.folder_id} onChange={(e) => { flush(); updateNote(id, { folder_id: e.target.value }); }} aria-label="Move note to folder"
            className="px-space-sm py-1 bg-transparent border border-outline-variant/50 rounded-lg font-label-sm text-label-sm text-on-surface-variant focus:outline-none focus:border-primary-container">
            {folderTree(data, "notes").map((f) => <option key={f.id} value={f.id}>{folderPath(data, f.id)}</option>)}
          </select>
          <button type="button" onClick={() => { flush(); setEditing((v) => !v); }} title="Switch between Live Preview and Reading view (Ctrl/⌘ E)"
            className="flex items-center gap-1 px-space-md py-1 rounded-lg border border-outline-variant/60 hover:bg-surface-container-high font-body-sm text-body-sm transition-colors">
            <Icon n={editing ? "menu_book" : "edit"} className="text-[16px]" />{editing ? "Reading view" : "Edit"}
          </button>
          <button type="button" onClick={remove} aria-label="Delete note" title="Delete note" className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-surface-container-high transition-colors">
            <Icon n="delete" className="text-[18px]" />
          </button>
        </div>
      </div>

      <input value={draft.title} onChange={(e) => change({ title: e.target.value })} placeholder="Untitled" maxLength={300} aria-label="Note title"
        className="font-headline-xl text-headline-xl tracking-tight bg-transparent focus:outline-none placeholder:text-outline" />

      {editing ? (
        <LiveEditor key={id} value={draft.body} onChange={(body) => change({ body })} resolve={resolve} onOpenNote={openNote}
          autoFocus={new URLSearchParams(location.search).get("edit") === "1"} />
      ) : draft.body.trim() ? (
        <div className="md font-card text-[17px]" onClick={onClick} onDoubleClick={() => setEditing(true)} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-left text-outline hover:text-on-surface transition-colors">Empty note. Click to start writing.</button>
      )}

      {backlinks.length > 0 && (
        <section className="flex flex-col gap-space-xs border-t border-outline-variant/40 pt-space-md">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Linked from</span>
          {backlinks.map((n) => (
            <Link key={n.id} href={`/note?id=${n.id}`} className="flex items-center gap-space-sm font-body-sm text-body-sm text-primary hover:underline">
              <Icon n="description" className="text-[16px] text-outline" />{n.title || "Untitled"}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

// Static export: the id comes from the query string, read inside a Suspense boundary.
export default function Page() {
  return <Suspense><NotePage /></Suspense>;
}
