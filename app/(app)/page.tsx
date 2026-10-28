"use client";
import Link from "next/link";
import SpaceShortcut from "@/components/SpaceShortcut";
import { displayName, useUser } from "@/lib/firebase";
import { cardList, inQueue, loadSample, stats, subFolders, topFolders, useData } from "@/lib/store";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export default function Dashboard() {
  const data = useData();
  const name = displayName(useUser()).split(" ")[0];
  const folders = topFolders(data).map((f) => {
    const cards = cardList(data, f.id);
    return { ...f, total: cards.length, due: cards.filter((c) => inQueue(c)).length, subs: subFolders(data, f.id).length };
  });
  const s = stats(data);
  const withDue = folders.filter((f) => f.due > 0).length;
  const tiles = [[String(s.dueToday), "due today"], [String(s.reviewedToday), "reviewed today"], [String(s.streak), "day streak"]];

  if (!data.ready) return null;

  return (
    <div className="flex flex-col gap-space-xl">
      <SpaceShortcut to="/review-queue" />

      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md sm:gap-space-lg">
        <div>
          <h1 className="font-headline-xl text-[30px] leading-tight font-semibold sm:text-headline-xl tracking-tight">{greeting()}{name && <>, <span className="capitalize">{name}</span></>}</h1>
          <p className="text-on-surface-variant">
            {s.dueToday > 0 ? `${s.dueToday} card${s.dueToday === 1 ? " is" : "s are"} due across ${withDue} folder${withDue === 1 ? "" : "s"}.` : folders.length ? "You're all caught up." : "Create a folder to start adding cards."}
          </p>
        </div>
        {s.dueToday > 0 && (
          <Link href="/review-queue" className="px-space-lg py-2.5 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-body-sm text-body-sm font-medium transition-colors">
            Start review
          </Link>
        )}
      </section>

      <section className="grid grid-cols-3 gap-space-sm sm:gap-space-md">
        {tiles.map(([n, l]) => (
          <div key={l} className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-space-md sm:p-space-lg">
            <div className="font-headline-lg text-[24px] font-semibold sm:text-headline-lg tracking-tight">{n}</div>
            <div className="font-label-sm text-label-sm text-on-surface-variant">{l}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm">Folders</h2>
        {folders.length === 0 ? (
          <div className="bg-surface-container-lowest border border-dashed border-outline-variant/60 rounded-xl p-space-lg sm:p-space-xl flex flex-col items-start gap-space-sm">
            <p className="text-on-surface-variant">No folders yet. Use the + next to Library in the sidebar, or start with a sample deck.</p>
            <button type="button" onClick={loadSample} className="px-space-md py-1.5 bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary rounded-xl font-body-sm text-body-sm font-medium transition-colors">
              Add sample cards
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            {folders.map((f) => (
              <Link key={f.id} href={`/folder?id=${f.id}`} className="bg-surface-container-lowest border border-outline-variant/40 hover:border-primary-container/60 rounded-xl p-space-lg flex items-center justify-between transition-colors">
                <span className="flex items-center gap-space-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${f.dot}`} />
                  <span className="font-medium">{f.name}</span>
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{f.subs > 0 && `${f.subs} sub-folder${f.subs === 1 ? "" : "s"} · `}{f.total} cards{f.due > 0 && <span className="text-primary"> · {f.due} due</span>}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
