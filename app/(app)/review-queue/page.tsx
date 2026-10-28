"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { buildQueue, folderPath, folderTree, inQueue, cardList, isDue, postpone, useData } from "@/lib/store";
import { State } from "@/lib/fsrs";

const limits = [{ label: "20 cards", v: 20 }, { label: "35 cards", v: 35 }, { label: "All", v: Infinity }];

const toggleCls = "w-11 h-6 bg-surface-container-highest rounded-full peer peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container peer-checked:bg-primary-container after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full";

function Toggle({ title, sub, checked, onChange }: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div className="flex flex-col pr-2">
        <span className="font-medium group-hover:text-primary-container transition-colors">{title}</span>
        <span className="font-body-sm text-body-sm text-outline">{sub}</span>
      </div>
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className={toggleCls} />
      </div>
    </label>
  );
}

export default function ReviewQueue() {
  const router = useRouter();
  const data = useData();
  const [folder, setFolder] = useState<string | undefined>();
  const [limit, setLimit] = useState(Infinity);
  const [includeNew, setIncludeNew] = useState(true);
  const [dueOnly, setDueOnly] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [sound, setSound] = useState(true);

  useEffect(() => { setFolder(new URLSearchParams(location.search).get("folder") ?? undefined); }, []);

  const scopes = [
    { id: undefined as string | undefined, label: "All Due Collections", n: cardList(data).filter((c) => inQueue(c)).length },
    ...folderTree(data).map((f) => ({ id: f.id as string | undefined, label: folderPath(data, f.id), n: cardList(data, f.id).filter((c) => inQueue(c)).length })).filter((s) => s.n > 0 || s.id === folder),
  ];
  const queue = buildQueue(data, { folder, limit, includeNew, dueOnly });
  const count = queue.length;
  const total = buildQueue(data, { folder, includeNew, dueOnly }).length;
  const nNew = queue.filter((c) => c.state === State.New).length;
  const nRev = queue.filter((c) => c.state === State.Review).length;
  const nLearn = count - nNew - nRev;
  const unseen = cardList(data, folder).filter((c) => c.state === State.New).length;

  const params = new URLSearchParams({ ...(folder && { folder }), ...(limit !== Infinity && { limit: String(limit) }), new: includeNew ? "1" : "0", ahead: dueOnly ? "0" : "1", shuffle: shuffle ? "1" : "0", sound: sound ? "1" : "0" });
  const start = `/review?${params}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && count > 0 && !(e.target as HTMLElement).closest("input,textarea,button,a")) {
        e.preventDefault();
        router.push(start);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, start, count]);

  const later = () => {
    postpone(queue.filter((c) => isDue(c)).map((c) => c.id));
    router.push("/");
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-outline">
            <Link href="/" className="hover:text-on-surface transition-colors">Home</Link>
            <Icon n="chevron_right" className="text-[14px]" />
            <span className="text-primary-container font-semibold">Review Queue</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl tracking-tight">Your next review</h1>
          <p className="text-on-surface-variant max-w-xl">Configure your session parameters or jump straight in with optimal algorithmic intervals.</p>
        </div>
        <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-sm rounded-full self-start md:self-auto shadow-sm">
          <div className="w-7 h-7 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container">
            <Icon n="schedule" className="text-[18px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Estimated Session</span>
            <span className="font-label-md text-label-md font-semibold">~{Math.max(1, Math.round((count * 18) / 60))} minutes <span className="text-outline font-normal">(18s / card)</span></span>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-full p-space-xl shadow-sm flex flex-col gap-space-xl">

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg">
          <div className="flex items-baseline gap-space-md">
            <span className="font-headline-xl text-[48px] leading-none font-semibold tracking-tight">{count}</span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm leading-tight">Cards Due Today</span>
              <span className="font-label-sm text-label-sm text-outline">Calculated via FSRS-4.5 Retention Model</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-space-sm">
          <div className="w-full h-3 rounded-full bg-surface-container flex overflow-hidden p-0.5">
            <div className="h-full bg-primary-container rounded-l-full transition-all duration-300" style={{ width: `${count && (nNew / count) * 100}%` }} />
            <div className="h-full bg-[#D99A32] transition-all duration-300" style={{ width: `${count && (nLearn / count) * 100}%` }} />
            <div className="h-full bg-tertiary-container rounded-r-full transition-all duration-300" style={{ width: `${count && (nRev / count) * 100}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-space-xs">
            {[
              ["bg-primary-container", nNew, "New", "First presentation; baseline encoding"],
              ["bg-[#D99A32]", nLearn, "Learning", "Short intervals; stabilizing"],
              ["bg-tertiary-container", nRev, "Review", "Graduated cards; retrieval consolidation"],
            ].map(([c, n, l, d]) => (
              <div key={l as string} className="flex items-start gap-space-sm">
                <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${c}`} />
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-headline-sm text-headline-sm font-semibold">{n}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">{l}</span>
                  </div>
                  <p className="font-body-sm text-body-sm text-outline leading-tight">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-space-sm">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-medium">Collection Scope</span>
          <div className="flex flex-wrap gap-2">
            {scopes.map((s) => (
              <button
                key={s.id ?? "all"}
                type="button"
                onClick={() => setFolder(s.id)}
                className={`px-space-md py-1.5 rounded-full font-label-md text-label-md transition-all ${
                  s.id === folder
                    ? "bg-secondary-container text-on-secondary-fixed-variant font-semibold shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                {s.label} ({s.n})
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-space-md bg-surface-container-low p-space-lg rounded-xl">
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm font-semibold">Session Parameters</span>
            <span className="font-label-sm text-label-sm text-outline">Adjust for current focus depth</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
            <div className="flex flex-col gap-space-md">
              <Toggle title="Include new cards" sub={`${unseen} unseen card${unseen === 1 ? "" : "s"} ready to introduce`} checked={includeNew} onChange={setIncludeNew} />
              <Toggle title="Review due cards only" sub="Off: also study cards scheduled for later" checked={dueOnly} onChange={setDueOnly} />
            </div>
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Batch Size Limit</span>
                  <span className="font-label-sm text-label-sm text-primary-container">{limit === Infinity ? "Full Queue" : `Capped at ${limit}`}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-surface-container p-1 rounded-xl">
                  {limits.map((l) => (
                    <button
                      key={l.label}
                      type="button"
                      onClick={() => setLimit(l.v)}
                      className={`py-1.5 rounded-lg font-label-md text-label-md text-center transition-all ${
                        l.v === limit ? "bg-surface-container-highest text-on-surface font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {l.v === Infinity ? `All (${total})` : l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-space-sm cursor-pointer font-body-sm text-body-sm">
                  <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="w-4 h-4 rounded accent-primary-container cursor-pointer" />Shuffle card order
                </label>
                <label className="flex items-center gap-space-sm cursor-pointer font-body-sm text-body-sm">
                  <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="w-4 h-4 rounded accent-primary-container cursor-pointer" />Gentle sound cues
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-space-md pt-space-xs">
          {count > 0 ? (
            <Link href={start} className="w-full sm:flex-1 py-3.5 px-space-lg bg-primary-container hover:bg-primary text-on-primary-container hover:text-on-primary rounded-xl font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-space-sm shadow-md transition-all active:scale-[0.99]">
              <Icon n="play_circle" className="text-[22px]" />
              <span>Start Session ({count} cards)</span>
              <kbd className="hidden md:inline-block ml-2 px-2 py-0.5 bg-on-primary-container/20 rounded text-label-sm font-normal">Return / Space</kbd>
            </Link>
          ) : (
            <span className="w-full sm:flex-1 py-3.5 px-space-lg bg-surface-container rounded-xl text-on-surface-variant text-center">Nothing to review here. Nice work.</span>
          )}
          <button type="button" onClick={later} disabled={!queue.some((c) => isDue(c))} className="w-full sm:w-auto px-space-lg py-3.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors text-center disabled:opacity-50 disabled:hover:bg-transparent">
            Study Later / Reschedule
          </button>
        </div>

      </div>
    </div>
  );
}
