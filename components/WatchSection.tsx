"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { countryName } from "@/lib/format";
import type { WatchOption } from "@/lib/types";
import { watchLink } from "@/lib/watch";

const KINDS: [WatchOption["kind"], string][] = [["stream", "Stream"], ["free", "Watch free"], ["rent", "Rent"], ["buy", "Buy"]];

/**
 * Where to watch a film, grouped by Stream, Watch free, Rent and Buy, for one country at a time.
 * It opens on the visitor's own country when the film has options there.
 */
export default function WatchSection({ watch, title }: { watch: WatchOption[]; title: string }) {
  const regions = useMemo(() => [...new Set(watch.map((w) => w.region ?? "US"))].sort((a, b) => countryName(a).localeCompare(countryName(b))), [watch]);
  const [region, setRegion] = useState(regions.includes("US") ? "US" : regions[0]);

  useEffect(() => {
    const own = navigator.language.split("-")[1]?.toUpperCase();
    if (own && regions.includes(own)) setRegion(own);
  }, [regions]);

  const groups = KINDS.map(([kind, label]) => {
    const seen = new Set<string>();
    const list = watch.filter((w) => (w.region ?? "US") === region && w.kind === kind && !seen.has(w.provider) && seen.add(w.provider));
    return { label, list };
  }).filter((g) => g.list.length);

  if (!watch.length) {
    return (
      <p className="watch-empty">
        Not streaming yet. <Link href="/submit">Tell us where it&rsquo;s showing</Link>.
      </p>
    );
  }

  return (
    <div className="watch">
      {regions.length > 1 && (
        <div className="watch-regions" role="radiogroup" aria-label="Country">
          {regions.map((r) => (
            <button key={r} type="button" className="chip" role="radio" aria-checked={r === region} aria-pressed={r === region} onClick={() => setRegion(r)}>
              {countryName(r)}
            </button>
          ))}
        </div>
      )}
      {regions.length === 1 && <p className="watch-where">In {countryName(region)}</p>}
      <dl className="watch-groups">
        {groups.map((g) => (
          <div key={g.label}>
            <dt>{g.label}</dt>
            <dd>
              <ul className="chip-list">
                {g.list.map((w) => (
                  <li key={w.provider}>
                    <a className="chip" href={watchLink(w.provider, title, region)} target="_blank" rel="noopener noreferrer">{w.provider}</a>
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
