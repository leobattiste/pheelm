import Link from "next/link";
import Icon from "@/components/Icon";

export type StartCounts = { watched: number; saved: number; lists: number; follows: number; comments: number };

const STEPS: { key: keyof StartCounts; label: string; href: string; cta: string }[] = [
  { key: "watched", label: "Mark a film as watched", href: "/films", cta: "Browse films" },
  { key: "saved", label: "Add a film to your Watchlist", href: "/films", cta: "Browse films" },
  { key: "lists", label: "Make your own watchlist", href: "/watchlists", cta: "See watchlists" },
  { key: "follows", label: "Follow a director", href: "/directors", cta: "Find directors" },
  { key: "comments", label: "Leave a comment", href: "/films", cta: "Find a film" },
];

/** A short list of first things to do, ticked off by what the member has actually done. Gone once all are done. */
export default function GettingStarted({ counts }: { counts: StartCounts }) {
  const done = STEPS.filter((s) => counts[s.key] > 0).length;
  if (done === STEPS.length) return null;
  return (
    <section className="account-section getting-started" aria-labelledby="started-h">
      <h2 id="started-h">Getting started</h2>
      <p className="muted">{done} of {STEPS.length} done. It ticks itself off as you use Pheelm.</p>
      <ul className="started-list">
        {STEPS.map((s) => counts[s.key] > 0
          ? <li key={s.key} className="started-item is-done"><span className="started-check" aria-hidden="true"><Icon name="check" /></span><span>{s.label}<span className="visually-hidden"> (done)</span></span></li>
          : <li key={s.key} className="started-item"><span className="started-check" aria-hidden="true" /><span>{s.label}</span><Link className="started-go" href={s.href}>{s.cta}</Link></li>)}
      </ul>
    </section>
  );
}
