import Link from "next/link";
import type { WatchOption } from "@/lib/types";
import { serviceName, watchLink } from "@/lib/watch";

const KINDS: [WatchOption["kind"], string][] = [["stream", "Stream"], ["free", "Watch free"], ["rent", "Rent"], ["buy", "Buy"]];

/**
 * Where to watch a film: the services TMDB lists for it, grouped by Stream, Watch free, Rent and
 * Buy. One country only (the US, or the first one imported). Each button opens a search for the
 * film on that service.
 */
export default function WatchSection({ watch, title }: { watch: WatchOption[]; title: string }) {
  const regions = [...new Set(watch.map((w) => w.region ?? "US"))];
  const region = regions.includes("US") ? "US" : regions[0];

  const groups = KINDS.map(([kind, label]) => {
    const seen = new Set<string>();
    const list = watch
      .filter((w) => (w.region ?? "US") === region && w.kind === kind)
      .map((w) => ({ provider: serviceName(w.provider), href: watchLink(serviceName(w.provider), title) }))
      .filter((w): w is { provider: string; href: string } => !!w.href && !seen.has(w.provider) && !!seen.add(w.provider));
    return { label, list };
  }).filter((g) => g.list.length);

  if (!groups.length) {
    return (
      <p className="watch-empty">
        Not streaming yet. <Link href="/submit">Tell us where it&rsquo;s showing</Link>.
      </p>
    );
  }

  return (
    <div className="watch">
      <dl className="watch-groups">
        {groups.map((g) => (
          <div key={g.label}>
            <dt>{g.label}</dt>
            <dd>
              <ul className="chip-list">
                {g.list.map((w) => (
                  <li key={w.provider}>
                    <a className="chip" href={w.href} target="_blank" rel="noopener noreferrer">{w.provider}</a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      <p className="watch-credit">Streaming information from JustWatch.</p>
    </div>
  );
}
