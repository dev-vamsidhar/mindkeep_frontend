"use client";
import { useEffect } from "react";
import { addCard, folderPath, folderTree, updateCard, useData, type Card } from "@/lib/store";

const field = "px-space-md py-2 bg-surface border border-outline-variant/50 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container";
const label = "flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant";

// Add a card to `folderId`, or edit `card`. Closes itself on save, cancel, or Escape.
export default function CardForm({ card, folderId, onClose }: { card?: Card; folderId?: string; onClose: () => void }) {
  const data = useData();
  const folders = folderTree(data);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [onClose]);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const [front, back, folder] = ["front", "back", "folder"].map((k) => String(f.get(k) ?? "").trim());
    const tags = String(f.get("tags")).split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
    if (card) updateCard(card.id, { front, back, tags, folder_id: folder });
    else addCard(folder, front, back, tags);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-space-lg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save} className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-lg p-space-lg sm:p-space-xl flex flex-col gap-space-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <h2 className="font-headline-md text-headline-md tracking-tight">{card ? "Edit card" : "New card"}</h2>
        <label className={label}>Prompt<textarea name="front" required rows={3} autoFocus defaultValue={card?.front} className={field} /></label>
        <label className={label}>Answer<textarea name="back" required rows={5} defaultValue={card?.back} className={field} /></label>
        <p className="font-label-sm text-label-sm text-outline -mt-1">Supports **bold**, *italic* and `code`.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <label className={label}>Folder
            <select name="folder" defaultValue={card?.folder_id ?? folderId} className={field}>
              {folders.map((f) => <option key={f.id} value={f.id}>{folderPath(data, f.id)}</option>)}
            </select>
          </label>
          <label className={label}>Tags<input name="tags" placeholder="algorithms, interviews" defaultValue={card?.tags.join(", ")} className={field} /></label>
        </div>
        <div className="flex gap-space-sm pt-space-xs">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors">Cancel</button>
          <button type="submit" className="flex-1 py-2 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-medium transition-colors">{card ? "Save" : "Add card"}</button>
        </div>
      </form>
    </div>
  );
}
