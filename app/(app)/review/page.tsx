"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CardForm from "@/components/CardForm";
import Icon from "@/components/Icon";
import Md from "@/components/Md";
import { preview, State, type Rating } from "@/lib/fsrs";
import { buildQueue, deleteCard, folderPath, reviewCard, updateCard, useData, type Card } from "@/lib/store";

const ratings = [
  { n: 1, label: "Again", cls: "bg-surface-container-lowest hover:bg-error-container/40", text: "text-error" },
  { n: 2, label: "Hard", cls: "bg-surface-container-lowest hover:bg-surface-container-high", text: "text-on-secondary-container" },
  { n: 3, label: "Good", primary: true },
  { n: 4, label: "Easy", cls: "bg-surface-container-lowest hover:bg-tertiary-fixed/30", text: "text-tertiary" },
] as const;
const stateLabel = ["New card", "Learning", "Review", "Relearning"];

const kbd = "px-1.5 py-0.5 bg-surface-container rounded font-medium text-on-surface-variant text-[10px]";
const menuItem = "w-full flex items-center gap-space-sm px-space-md py-1.5 rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-left";

const interval = (ms: number) => {
  const m = ms / 60_000;
  return m < 60 ? `< ${Math.ceil(m / 5) * 5} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${(m / 1440).toFixed(m < 14_400 ? 1 : 0)} days`;
};
const ago = (t: number) => { const d = Math.floor((Date.now() - t) / 86_400_000); return d < 1 ? "today" : `${d}d ago`; };

function chime(pitch: number) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = pitch;
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
    o.onended = () => ctx.close();
  } catch {}
}

export default function Review() {
  const router = useRouter();
  const data = useData();
  const [ids, setIds] = useState<string[] | null>(null);
  const [opts, setOpts] = useState({ sound: true });
  const [i, setI] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [rated, setRated] = useState<{ n: number; before: Card } | null>(null);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fix the session's cards once local data is loaded; later edits to those cards still show live.
  useEffect(() => {
    if (!data.ready || ids) return;
    const p = new URLSearchParams(location.search);
    setOpts({ sound: p.get("sound") !== "0" });
    setIds(buildQueue(data, {
      folder: p.get("folder") ?? undefined, limit: Number(p.get("limit")) || Infinity,
      includeNew: p.get("new") !== "0", dueOnly: p.get("ahead") !== "1", shuffle: p.get("shuffle") === "1",
    }).map((c) => c.id));
  }, [data, ids]);

  const queue = (ids ?? []).filter((id) => data.cards[id] && !data.cards[id].deleted);
  const total = queue.length;
  const card = data.cards[queue[i]] as Card | undefined;
  const finished = ids !== null && i >= total;
  const revealed = rated !== null;
  const folder = card && data.folders[card.folder_id];

  const rate = (n: number) => {
    if (!card || revealed) return;
    setRated({ n, before: card });
    reviewCard(card.id, n as Rating);
    if (opts.sound) chime(n === 1 ? 330 : 520 + n * 60);
  };
  const next = () => { setRated(null); setI((x) => x + 1); };
  const star = () => card && updateCard(card.id, { starred: card.starred ? 0 : 1 });
  const speak = () => {
    if (!card) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance((revealed ? card.back : card.front).replace(/[*`]/g, "")));
  };
  const skip = () => { setMenu(false); setRated(null); setIds((l) => l && [...l.filter((id) => id !== card?.id), card!.id]); };
  const remove = () => { setMenu(false); if (card && confirm("Delete this card?")) { setRated(null); deleteCard(card.id); } };

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (editing) return;
    const away = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === "Escape") router.push("/review-queue");
      else if (e.key === "s" || e.key === "S") star();
      else if (e.key === "e" || e.key === "E") { e.preventDefault(); if (card) setEditing(true); }
      else if (!(e.target as HTMLElement).closest("button,a")) {
        const pick = ["1", "2", "3", "4"].includes(e.key) ? Number(e.key) : e.code === "Space" ? 3 : 0;
        if (e.code === "Space") e.preventDefault();
        if (!revealed && pick) rate(pick);
        else if (revealed && (e.code === "Space" || e.key === "Enter")) next();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", away);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", away); };
  });

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (ids === null) return null;
  if (finished || !card) {
    return (
      <div className="max-w-xl mx-auto w-full flex flex-col items-center gap-space-md text-center pt-space-xl">
        <Icon n="task_alt" className="text-[48px] text-tertiary" />
        <h1 className="font-headline-lg text-[24px] leading-tight font-semibold sm:text-headline-lg tracking-tight">{total ? "Session complete" : "Nothing to review"}</h1>
        <p className="text-on-surface-variant">{total ? `You reviewed ${total} card${total === 1 ? "" : "s"} in ${mm}:${ss}.` : "No cards match this session."} Your progress is saved on this device and syncs when you’re online.</p>
        <div className="flex gap-space-sm">
          <Link href="/" className="px-space-lg py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors">Home</Link>
          <Link href="/review-queue" className="px-space-lg py-2.5 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-medium transition-colors">Review queue</Link>
        </div>
      </div>
    );
  }

  const shown = rated?.before ?? card;
  const nextIn = preview(shown, Date.now());
  const pos = Math.min(i + 1, total);

  return (
    <div className="flex flex-col gap-space-lg w-full max-w-4xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-y-space-sm gap-x-space-md px-space-md py-space-sm bg-surface-container-lowest rounded-xl shadow-sm">
        <div className="flex items-center gap-space-md min-w-0">
          <Link href="/review-queue" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors font-body-sm text-body-sm group">
            <Icon n="arrow_back" className="text-[18px] group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-medium">Exit</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-label-sm rounded">Esc</kbd>
          </Link>
          <div className="h-4 w-px bg-outline-variant/60" />
          <span className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${folder?.dot ?? "bg-outline"}`} />
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate max-w-[9rem] sm:max-w-xs">{card && folderPath(data, card.folder_id)}</span>
          </span>
        </div>
        <div className="order-last basis-full sm:order-none sm:basis-auto flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 font-label-sm text-label-sm">
            <span className="font-semibold">Card {pos} of {total}</span>
            <span className="hidden sm:inline text-on-surface-variant">({Math.round(((pos - (revealed ? 0 : 1)) / total) * 100)}% completed)</span>
          </div>
          <div className="w-full sm:w-36 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary-container rounded-full transition-all duration-300" style={{ width: `${((pos - (revealed ? 0 : 1)) / total) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low rounded-lg font-label-sm text-label-sm text-on-surface-variant">
            <Icon n="timer" className="text-[15px] text-outline" />
            <span className="font-semibold text-on-surface">{mm}:{ss}</span>
          </span>
          <button type="button" onClick={speak} aria-label="Read card aloud" className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"><Icon n="volume_up" className="text-[18px]" /></button>
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit card" className="flex items-center gap-1 px-2 py-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
            <Icon n="edit" className="text-[16px]" /><kbd className="hidden sm:inline px-1 bg-surface-container text-[10px] font-label-sm rounded">E</kbd>
          </button>
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="More options" aria-expanded={menu} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"><Icon n="more_vert" className="text-[18px]" /></button>
            {menu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-lg p-space-xs z-10">
                {!revealed && <button type="button" onClick={skip} className={menuItem}><Icon n="skip_next" className="text-[18px]" />Skip for now</button>}
                <button type="button" onClick={remove} className={`${menuItem} hover:text-error`}><Icon n="delete" className="text-[18px]" />Delete card</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center">
        <article className="w-full bg-surface-container-lowest rounded-full p-space-lg sm:p-space-xl shadow-md flex flex-col gap-space-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              {card.tags[0] && <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold px-2 py-0.5 bg-secondary-container rounded">{card.tags[0]}</span>}
              <span className="font-label-sm text-label-sm text-outline">{stateLabel[shown.state]}</span>
            </div>
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
              {shown.state !== State.New && <span className="px-2 py-0.5 rounded bg-surface-container">Stability: {shown.stability.toFixed(1)}d</span>}
              <span className="px-2 py-0.5 rounded bg-surface-container">Reps: {shown.reps}</span>
              <button type="button" onClick={star} aria-pressed={!!card.starred} title="Star card [S]" className={`p-1 ml-1 transition-colors ${card.starred ? "text-amber-500" : "text-outline hover:text-amber-500"}`}>
                <Icon n="star" fill={!!card.starred} className="text-[18px]" />
              </button>
            </div>
          </div>

          <section className="flex flex-col gap-space-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">Prompt</span>
            <h2 className="font-card text-[26px] leading-snug font-semibold tracking-tight"><Md text={card.front} /></h2>
          </section>

          {revealed && (
          <>
          <div className="relative flex items-center justify-center my-space-xs">
            <div className="w-full h-px bg-surface-container-highest" />
            <div className="absolute px-3 py-1 bg-surface-container-low text-primary-container font-label-sm text-label-sm rounded-full flex items-center gap-1.5 shadow-sm">
              <Icon n="visibility" className="text-[14px]" />
              <span className="uppercase tracking-wider font-semibold">Answer Revealed</span>
            </div>
          </div>

          <section className="flex flex-col gap-space-md font-card">
            <div className="bg-surface-container-low rounded-xl p-space-md text-[18px] leading-relaxed"><Md text={card.back} /></div>
            <footer className="flex items-center justify-between pt-space-xs mt-space-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {card.tags.map((t) => (
                  <span key={t} className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded text-outline font-medium">#{t}</span>
                ))}
              </div>
              <span className="flex items-center gap-1 font-label-sm text-label-sm text-outline"><Icon n="history" className="text-[14px]" />Next review in {interval(nextIn[rated.n as Rating])}</span>
            </footer>
          </section>
          </>
          )}
          {!revealed && <span className="font-label-sm text-label-sm text-outline flex items-center gap-1"><Icon n="history" className="text-[14px]" />Updated {ago(card.updated_at)}</span>}
        </article>

        <section className="w-full mt-space-lg flex flex-col items-center gap-space-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm w-full max-w-2xl">
            {ratings.map((r) => (
              <button
                key={r.n}
                type="button"
                disabled={revealed}
                onClick={() => rate(r.n)}
                className={`group flex flex-col items-center justify-center p-space-md rounded-xl transition-all duration-150 active:scale-95 disabled:active:scale-100 disabled:cursor-default text-center ${
                  "primary" in r ? "bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container shadow-md ring-2 ring-primary/20" : `${r.cls} shadow-sm`
                } ${rated && rated.n !== r.n ? "opacity-40" : ""} ${rated?.n === r.n ? "ring-2 ring-primary" : ""}`}
              >
                <span className="flex items-center gap-1">
                  <span className={`font-headline-sm text-headline-sm font-semibold ${"text" in r ? r.text : ""}`}>{r.label}</span>
                  <kbd className={`hidden sm:inline px-1 text-[10px] font-label-sm rounded ${"primary" in r ? "bg-primary-container/80 text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>{"primary" in r ? "3 / Space" : r.n}</kbd>
                </span>
                <span className={`font-label-sm text-label-sm mt-0.5 ${"primary" in r ? "opacity-80" : "text-outline"}`}>{interval(nextIn[r.n])}</span>
              </button>
            ))}
          </div>
          {revealed && (
            <button type="button" onClick={next} className="w-full max-w-2xl py-3 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99]">
              {i + 1 >= total ? "Finish session" : "Next card"}<Icon n="arrow_forward" className="text-[18px]" /><kbd className="hidden sm:inline px-1.5 py-0.5 bg-on-primary-container/20 rounded text-label-sm font-normal">Space</kbd>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-space-md font-label-sm text-label-sm text-outline mt-1">
            <span className="flex items-center gap-1">{[1, 2, 3, 4].map((k) => <kbd key={k} className={kbd}>{k}</kbd>)}<span className="ml-1">rate memory</span></span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1"><kbd className={kbd}>S</kbd>star</span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1"><kbd className={kbd}>E</kbd>edit</span>
          </div>
        </section>
      </div>

      {editing && <CardForm card={card} onClose={() => setEditing(false)} />}
    </div>
  );
}
