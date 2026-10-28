// Local-first data store. Every read and write hits memory + IndexedDB on this device; changes are
// pushed to the backend lazily (see "sync" below), so the app works offline and D1 sees few requests.
import { useSyncExternalStore } from "react";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { auth } from "./firebase";
import { next, State, type Rating, type Sched } from "./fsrs";
import { sample } from "./data";

// parent_id: a top-level folder this one sits under (one level only), or null.
// kind: which tree the folder is in. Missing on rows from before notes existed, which means "cards".
export type Kind = "cards" | "notes";
export type Folder = { id: string; name: string; dot: string; parent_id?: string | null; kind?: Kind; updated_at: number; deleted: 0 | 1 };
export type Note = { id: string; folder_id: string; title: string; body: string; created_at: number; updated_at: number; deleted: 0 | 1 };
export type Card = Sched & {
  id: string; folder_id: string; front: string; back: string; tags: string[]; starred: 0 | 1;
  created_at: number; updated_at: number; deleted: 0 | 1;
};
export type Activity = { device: string; day: string; count: number }; // reviews per device per local day
type Meta = { cursor: number; device: string; owner?: string };
type Dirty = { _dirty?: 1 }; // local-only flag: changed here and not yet on the server

export type Data = {
  ready: boolean;
  folders: Record<string, Folder & Dirty>;
  cards: Record<string, Card & Dirty>;
  notes: Record<string, Note & Dirty>;
  activity: Record<string, Activity & Dirty>; // key `${device}|${day}`
};

const DAY = 86_400_000;
const DOTS = ["bg-primary-container", "bg-tertiary", "bg-[#D99A32]", "bg-primary", "bg-outline"];

// ---------- IndexedDB ----------

const TABLES = ["folders", "cards", "notes", "activity"] as const;
type Table = (typeof TABLES)[number];
let dbp: Promise<IDBDatabase> | undefined;
const idb = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open("mindkeep", 2); // v2 added notes
  r.onupgradeneeded = () => { for (const s of [...TABLES, "meta"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
const got = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function persist(rows: [Table | "meta", string, unknown][], clear = false) {
  const tx = (await idb()).transaction([...TABLES, "meta"], "readwrite");
  if (clear) for (const t of TABLES) tx.objectStore(t).clear();
  for (const [t, k, v] of rows) tx.objectStore(t).put(v, k);
  return done(tx);
}

// ---------- state ----------

let data: Data = { ready: false, folders: {}, cards: {}, notes: {}, activity: {} };
let meta: Meta = { cursor: 0, device: "" };
const listeners = new Set<() => void>();
const emit = (d: Data) => { data = d; listeners.forEach((l) => l()); };

let started = false;
function subscribe(l: () => void) {
  listeners.add(l);
  if (!started && typeof window !== "undefined") { started = true; start(); }
  return () => listeners.delete(l);
}
const empty = data;
// Returns the whole snapshot (stable until something changes); derive views with the helpers below.
export const useData = () => useSyncExternalStore(subscribe, () => data, () => empty);

async function start() {
  const db = await idb();
  const tx = db.transaction([...TABLES, "meta"]);
  const load = async (t: Table) => {
    const os = tx.objectStore(t);
    const [keys, vals] = await Promise.all([got(os.getAllKeys()), got(os.getAll())]);
    return Object.fromEntries(keys.map((k, i) => [String(k), vals[i]]));
  };
  const [folders, cards, notes, activity, m] = await Promise.all([load("folders"), load("cards"), load("notes"), load("activity"), got(tx.objectStore("meta").get("meta"))]);
  meta = m ?? { cursor: 0, device: crypto.randomUUID() };
  if (!m) await persist([["meta", "meta", meta]]);
  emit({ ready: true, folders, cards, notes, activity });

  onAuthStateChanged(auth(), async (u) => {
    if (!u) return;
    if (meta.owner && meta.owner !== u.uid) await wipe(); // someone else's leftovers; theirs were synced at sign-out
    if (meta.owner !== u.uid) { meta = { ...meta, owner: u.uid }; await persist([["meta", "meta", meta]]); }
    syncNow(); // data made before signing in is already dirty, so it gets adopted by this account
  });
  addEventListener("online", () => scheduleSync(2_000));
  document.addEventListener("visibilitychange", () => document.hidden && syncNow(true));
  setInterval(() => !document.hidden && syncNow(), PULL_EVERY);
}

async function wipe() {
  meta = { cursor: 0, device: meta.device };
  await persist([["meta", "meta", meta]], true);
  emit({ ready: true, folders: {}, cards: {}, notes: {}, activity: {} });
}

// Applies local edits: memory first, then IndexedDB, then a lazy sync.
function write(changes: { folders?: Folder[]; cards?: Card[]; notes?: Note[]; activity?: Activity[] }) {
  const d = { ...data };
  const rows: [Table, string, unknown][] = [];
  for (const t of TABLES) {
    const list = changes[t] as (Folder | Card | Note | Activity)[] | undefined;
    if (!list?.length) continue;
    const table = { ...d[t] } as Record<string, unknown>;
    for (const r of list) {
      const k = t === "activity" ? actKey(r as Activity) : (r as Folder).id;
      table[k] = { ...r, _dirty: 1 };
      rows.push([t, k, table[k]]);
    }
    (d as Record<Table, unknown>)[t] = table;
  }
  emit(d);
  persist(rows).catch((e) => console.error("Saving locally failed", e));
  scheduleSync();
}

// ---------- views ----------

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const actKey = (a: Activity) => `${a.device}|${a.day}`;
export const endOfToday = (now = Date.now()) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); };
export const isDue = (c: Card, now = Date.now()) => c.state !== State.New && c.due < endOfToday(now);
// In today's study queue: due reviews plus unseen cards.
export const inQueue = (c: Card, now = Date.now()) => c.state === State.New || isDue(c, now);

// Sub-folders go one level deep. A parent only counts if it is itself top-level, so even if two offline
// devices nest folders at the same time, every device flattens the result the same way, with no extra writes.
export const parentOf = (d: Data, f: Folder) => {
  const p = f.parent_id ? d.folders[f.parent_id] : undefined;
  return p && !p.parent_id && p.id !== f.id ? p : undefined;
};
// Deleting a folder hides its sub-folders and all their cards. Nothing else is tombstoned, which saves a write per row.
const visible = (d: Data, f?: Folder) => !!f && !f.deleted && !parentOf(d, f)?.deleted;
const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name);
const kindOf = (f: Folder): Kind => f.kind ?? "cards";
export const folderList = (d: Data, kind: Kind = "cards") => Object.values(d.folders).filter((f) => kindOf(f) === kind && visible(d, f)).sort(byName);
export const topFolders = (d: Data, kind: Kind = "cards") => folderList(d, kind).filter((f) => !parentOf(d, f));
export const subFolders = (d: Data, id: string) => Object.values(d.folders).filter((f) => visible(d, f) && parentOf(d, f)?.id === id).sort(byName);
export const isFolder = (d: Data, id: string, kind: Kind = "cards") => visible(d, d.folders[id]) && kindOf(d.folders[id]) === kind;
// "Parent / Sub" for a sub-folder, just the name for a top-level folder.
export const folderPath = (d: Data, id: string) => { const f = d.folders[id], p = f && parentOf(d, f); return p ? `${p.name} / ${f.name}` : f?.name ?? ""; };
// Every folder in tree order: each top-level folder followed by its sub-folders.
export const folderTree = (d: Data, kind: Kind = "cards") => topFolders(d, kind).flatMap((f) => [f, ...subFolders(d, f.id)]);
// Visible notes directly in a folder, or all of them.
export const noteList = (d: Data, folderId?: string) =>
  Object.values(d.notes).filter((n) => !n.deleted && visible(d, d.folders[n.folder_id]) && (!folderId || n.folder_id === folderId)).sort((a, b) => a.title.localeCompare(b.title));
// [[Title]] resolves to the note with that title (case-insensitive), preferring one in the same folder.
export const findNote = (d: Data, title: string, folderId?: string) => {
  const t = title.trim().toLowerCase();
  const hits = noteList(d).filter((n) => n.title.trim().toLowerCase() === t);
  return hits.find((n) => n.folder_id === folderId) ?? hits[0];
};
// Visible cards, optionally limited to one folder, including its sub-folders.
export const cardList = (d: Data, folderId?: string) =>
  Object.values(d.cards).filter((c) => {
    const f = d.folders[c.folder_id];
    return !c.deleted && visible(d, f) && (!folderId || f.id === folderId || parentOf(d, f)?.id === folderId);
  });

export function stats(d: Data, now = Date.now()) {
  const perDay: Record<string, number> = {};
  for (const a of Object.values(d.activity)) perDay[a.day] = (perDay[a.day] ?? 0) + a.count;
  // Streak: consecutive days with reviews, ending today (or yesterday if today has none yet).
  let t = perDay[dayKey(now)] ? now : now - DAY;
  let streak = 0;
  while (perDay[dayKey(t)]) { streak++; t -= DAY; }
  const cards = cardList(d);
  return { dueToday: cards.filter((c) => inQueue(c, now)).length, newCards: cards.filter((c) => c.state === State.New).length, reviewedToday: perDay[dayKey(now)] ?? 0, streak };
}

export type QueueOpts = { folder?: string; limit?: number; includeNew?: boolean; dueOnly?: boolean; shuffle?: boolean };
// Card ids for a study session: due reviews (most overdue first), then new cards in the order they were added,
// then, if dueOnly is off, cards scheduled later (study ahead).
export function buildQueue(d: Data, { folder, limit = Infinity, includeNew = true, dueOnly = true, shuffle = false }: QueueOpts, now = Date.now()) {
  const cards = cardList(d, folder);
  const due = cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due);
  const fresh = includeNew ? cards.filter((c) => c.state === State.New).sort((a, b) => a.created_at - b.created_at) : [];
  const ahead = dueOnly ? [] : cards.filter((c) => c.state !== State.New && !isDue(c, now)).sort((a, b) => a.due - b.due);
  const q = [...due, ...fresh, ...ahead].slice(0, limit);
  if (shuffle) for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  return q;
}

// Human label for when a card is due: "Today", "Tomorrow", "3d", "2w".
export function dueLabel(c: Card, now = Date.now()) {
  if (c.state === State.New) return "New";
  if (isDue(c, now)) return "Today";
  const days = Math.round((endOfToday(c.due) - endOfToday(now)) / DAY); // calendar days; round absorbs DST
  return days <= 1 ? "Tomorrow" : days < 14 ? `${days}d` : days < 60 ? `${Math.round(days / 7)}w` : `${Math.round(days / 30)}mo`;
}

// ---------- actions ----------

// Throws if the move would nest folders two levels deep.
function checkParent(id: string | undefined, parentId: string | null) {
  if (!parentId) return;
  const p = data.folders[parentId];
  if (!p || !visible(data, p) || parentOf(data, p)) throw new Error("A sub-folder can only go inside a top-level folder.");
  if (id && kindOf(p) !== kindOf(data.folders[id])) throw new Error("Note folders and card folders can't be mixed.");
  if (id && (id === parentId || subFolders(data, id).length)) throw new Error("A folder that has sub-folders can't become a sub-folder.");
}
export function addFolder(name: string, parentId: string | null = null, kind: Kind = "cards") {
  checkParent(undefined, parentId);
  if (parentId) kind = kindOf(data.folders[parentId]);
  const dot = parentId ? data.folders[parentId].dot : DOTS[topFolders(data, kind).length % DOTS.length];
  const f: Folder = { id: crypto.randomUUID(), name, dot, parent_id: parentId, kind, updated_at: Date.now(), deleted: 0 };
  write({ folders: [f] });
  return f.id;
}
export function moveFolder(id: string, parentId: string | null) {
  checkParent(id, parentId);
  write({ folders: [{ ...data.folders[id], parent_id: parentId, updated_at: Date.now() }] });
}
export const renameFolder = (id: string, name: string) => write({ folders: [{ ...data.folders[id], name, updated_at: Date.now() }] });
export const deleteFolder = (id: string) => write({ folders: [{ ...data.folders[id], deleted: 1, updated_at: Date.now() }] });

const newCard = (folder_id: string, front: string, back: string, tags: string[], now: number): Card => ({
  id: crypto.randomUUID(), folder_id, front, back, tags, starred: 0,
  state: State.New, due: now, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null,
  created_at: now, updated_at: now, deleted: 0,
});
export function addCard(folderId: string, front: string, back: string, tags: string[] = []) {
  write({ cards: [newCard(folderId, front, back, tags, Date.now())] });
}
export const updateCard = (id: string, patch: Partial<Pick<Card, "front" | "back" | "tags" | "starred" | "folder_id">>) =>
  write({ cards: [{ ...data.cards[id], ...patch, updated_at: Date.now() }] });
// Tombstone with the text dropped, so the deleted row costs little to store and sync.
export const deleteCard = (id: string) => write({ cards: [{ ...data.cards[id], front: "", back: "", tags: [], deleted: 1, updated_at: Date.now() }] });

export function reviewCard(id: string, rating: Rating) {
  const now = Date.now();
  const day = dayKey(now);
  const a = data.activity[actKey({ device: meta.device, day, count: 0 })];
  write({
    cards: [{ ...data.cards[id], ...next(data.cards[id], rating, now), updated_at: now }],
    activity: [{ device: meta.device, day, count: (a?.count ?? 0) + 1 }],
  });
}

// "Study later": push the given cards to tomorrow without touching their memory state.
export const postpone = (ids: string[]) => {
  const now = Date.now();
  write({ cards: ids.map((id) => ({ ...data.cards[id], due: Math.max(data.cards[id].due, endOfToday(now)), updated_at: now })) });
};

export function addNote(folderId: string, title = "Untitled") {
  const now = Date.now();
  const n: Note = { id: crypto.randomUUID(), folder_id: folderId, title, body: "", created_at: now, updated_at: now, deleted: 0 };
  write({ notes: [n] });
  return n.id;
}
export const updateNote = (id: string, patch: Partial<Pick<Note, "title" | "body" | "folder_id">>) =>
  write({ notes: [{ ...data.notes[id], ...patch, updated_at: Date.now() }] });
export const deleteNote = (id: string) => write({ notes: [{ ...data.notes[id], body: "", deleted: 1, updated_at: Date.now() }] });

export function loadSample() {
  const now = Date.now();
  const folders: Folder[] = sample.map((s, i) => ({ id: crypto.randomUUID(), name: s.name, dot: DOTS[i % DOTS.length], parent_id: null, kind: "cards", updated_at: now, deleted: 0 }));
  write({ folders, cards: sample.flatMap((s, i) => s.cards.map(([f, b], j) => newCard(folders[i].id, f, b, [], now + i * 100 + j))) });
}

// ---------- sync ----------
// One POST /api/sync carries every local change since the last sync and brings back every remote change
// since our cursor. Edits are coalesced: a sync runs at most once per SYNC_DELAY after the first unsynced
// change, plus on reconnect, when the tab is hidden, and a pull every PULL_EVERY while the tab is visible.
// Conflicts: last write wins by updated_at.

const API = process.env.NEXT_PUBLIC_API_URL || "https://mindkeep-api.vamsubala1.workers.dev"; // .env.local points dev at localhost
const SYNC_DELAY = 30_000;
const PULL_EVERY = 10 * 60_000;
const CHUNK = 500; // the server's per-request row limit
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;

export function scheduleSync(delay = SYNC_DELAY) {
  if (!API || timer) return;
  timer = setTimeout(() => { timer = undefined; syncNow(); }, delay);
}

const strip = <T extends Dirty>({ _dirty, ...r }: T) => r;
const toWire = (c: Card) => ({ ...strip(c as Card & Dirty), tags: JSON.stringify(c.tags) });
const dirtyRows = () => ({
  folders: Object.values(data.folders).filter((r) => r._dirty),
  cards: Object.values(data.cards).filter((r) => r._dirty),
  notes: Object.values(data.notes).filter((r) => r._dirty),
  activity: Object.values(data.activity).filter((r) => r._dirty),
});
export const hasUnsynced = () => Object.values(dirtyRows()).some((l) => l.length > 0);

export function syncNow(leaving = false): Promise<void> {
  if (!API || !navigator.onLine || !auth().currentUser) return Promise.resolve();
  return (running ??= (async () => {
    try {
      // Loop until everything dirty is pushed; each round is one request, at most CHUNK rows.
      for (;;) {
        let budget = CHUNK;
        const take = <T,>(l: T[]) => { const s = l.slice(0, budget); budget -= s.length; return s; };
        const all = dirtyRows();
        const push = { folders: take(all.folders), cards: take(all.cards), notes: take(all.notes), activity: take(all.activity) };
        const res = await fetch(`${API}/api/sync`, {
          method: "POST", keepalive: leaving,
          headers: { Authorization: `Bearer ${await auth().currentUser!.getIdToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ since: meta.cursor, folders: push.folders.map((f) => ({ ...strip(f), parent_id: f.parent_id ?? null, kind: kindOf(f) })), cards: push.cards.map(toWire), notes: push.notes.map(strip), activity: push.activity.map(strip) }),
        });
        if (!res.ok) throw new Error(`Sync failed: ${res.status} ${await res.text()}`);
        const r: { cursor: number; folders: Folder[]; cards: (Omit<Card, "tags"> & { tags: string })[]; notes: Note[]; activity: Activity[] } = await res.json();
        await merge(push, { ...r, cards: r.cards.map((c) => ({ ...c, tags: JSON.parse(c.tags) })) });
        meta = { ...meta, cursor: r.cursor };
        await persist([["meta", "meta", meta]]);
        if (budget > 0) break; // nothing left over
      }
    } catch (e) {
      console.warn(e);
      scheduleSync(60_000); // offline or server trouble: try again later
    } finally {
      running = undefined;
    }
  })());
}

type Rows = { folders: Folder[]; cards: Card[]; notes: Note[]; activity: Activity[] };
function merge(pushed: Rows, pulled: Rows) {
  const d = { ...data, folders: { ...data.folders }, cards: { ...data.cards }, notes: { ...data.notes }, activity: { ...data.activity } };
  const rows: [Table, string, unknown][] = [];
  const put = (t: Table, k: string, v: unknown) => { (d[t] as Record<string, unknown>)[k] = v; rows.push([t, k, v]); };

  // What we pushed is on the server now, unless it was edited again while the request was in flight.
  for (const t of ["folders", "cards", "notes"] as const)
    for (const p of pushed[t]) { const cur = d[t][p.id]; if (cur?._dirty && cur.updated_at === p.updated_at) put(t, p.id, strip(cur)); }
  for (const p of pushed.activity) { const k = actKey(p); const cur = d.activity[k]; if (cur?._dirty && cur.count === p.count) put("activity", k, strip(cur)); }

  // Remote changes win unless our local copy is newer (it stays dirty and goes up next time).
  for (const t of ["folders", "cards", "notes"] as const)
    for (const r of pulled[t]) { const cur = d[t][r.id]; if (!cur || r.updated_at >= cur.updated_at) put(t, r.id, r); }
  for (const r of pulled.activity) { const k = actKey(r); const cur = d.activity[k]; if (!cur || r.count >= cur.count) put("activity", k, r); }

  emit(d);
  return persist(rows);
}

// Sign out: flush pending changes first, then clear this device so the next account starts clean.
export async function signOut() {
  await syncNow();
  if (hasUnsynced() && !confirm("Some changes haven't synced yet and will be lost if you log out now. Log out anyway?")) return;
  await fbSignOut(auth());
  await wipe();
}
