import Link from "next/link";
import type { WatchOption } from "@/lib/types";
import { serviceName, watchLink } from "@/lib/watch";
import { feedbackHref } from "@/lib/feedback";

// Where a film is shown, whether to stream, watch free, rent or buy: it's all watching. When a service offers
// it more than one way, it's listed once, in this order.
const ORDER: WatchOption["kind"][] = ["stream", "free", "rent", "buy"];

/**
 * Where to watch a film: the services TMDB lists for it, one entry per platform (Netflix, YouTube,
 * Apple TV…), with no split into stream, rent and buy. One country only (the US, or the first one
 * imported). Each button opens a search for the film on that service. Services show their logo (from TMDB), or their first letter until the
 * admin has refreshed where to watch.
 */
export default function WatchSection({ watch, title, slug }: { watch: WatchOption[]; title: string; slug: string }) {
  const regions = [...new Set(watch.map((w) => w.region ?? "US"))];
  const region = regions.includes("US") ? "US" : regions[0];

  const seen = new Set<string>();
  const platforms = ORDER.flatMap((kind) => watch.filter((w) => (w.region ?? "US") === region && w.kind === kind))
    .map((w) => ({ provider: serviceName(w.provider), href: watchLink(serviceName(w.provider), title), logo: w.logo }))
    .filter((w): w is { provider: string; href: string; logo: string | undefined } => !!w.href && !seen.has(w.provider) && !!seen.add(w.provider));

  if (!platforms.length) {
    return (
      <p className="watch-empty">
        Not streaming yet. <Link href={feedbackHref(`/films/${slug}#watch-h`, `Where to watch: ${title}`)}>Tell us where it&rsquo;s showing</Link>.
      </p>
    );
  }

  return (
    <div className="watch">
      <ul className="watch-platforms">
        {platforms.map((w) => (
          <li key={w.provider}>
            <a className="watch-platform" aria-label={`Watch ${title} on ${w.provider}`} href={w.href} target="_blank" rel="noopener noreferrer">
              {w.logo
                ? <img className="service-logo" src={w.logo} alt="" width={28} height={28} loading="lazy" />
                : <span className="service-logo is-letter" aria-hidden="true">{w.provider.replace(/[^A-Za-z0-9]/g, "").slice(0, 1)}</span>}
              {w.provider}
            </a>
          </li>
        ))}
      </ul>
      <p className="watch-credit">
        Streaming information from JustWatch. <Link href={feedbackHref(`/films/${slug}#watch-h`, `Where to watch: ${title}`)}>Something wrong?</Link>
      </p>
    </div>
  );
}
