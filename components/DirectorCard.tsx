import Link from "next/link";
import { countryName, initials } from "@/lib/format";
import type { DirectorSummary } from "@/lib/types";
import Poster from "./Poster";

type PortraitPerson = { name: string; photo_url: string | null };

/** A director's portrait, or their initials on a gray tile until a portrait is added. */
export function Portrait({ director, className = "" }: { director: PortraitPerson; className?: string }) {
  if (director.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`portrait ${className}`} src={director.photo_url} alt="" loading="lazy" />;
  }
  return (
    <span className={`portrait portrait-initials ${className}`} aria-hidden="true">
      {initials(director.name)}
    </span>
  );
}

/**
 * A director's card, built like a collection card: three of their films fanned out (with empty
 * slots when they have fewer), then a small square portrait, their name, country and film count.
 */
export default function DirectorCard({ director }: { director: DirectorSummary }) {
  const n = director.films;
  const meta = [director.country ? countryName(director.country) : null, `${n} ${n === 1 ? "film" : "films"}`].filter(Boolean).join(", ");
  // The fan's middle poster sits in front, so the best-known film goes there, then left, then right.
  const [a, b, c] = director.previews;
  const slots = [b, a, c];
  return (
    <li className="director-card">
      <Link href={`/directors/${director.slug}`} className="collection-tile">
        <span className="collection-fan" aria-hidden="true">
          {slots.map((f, i) =>
            f ? (
              <Poster key={f.slug} title={f.title} year={f.year} directors={f.directors} src={f.poster_url} sizes="140px" />
            ) : (
              <span key={`empty-${i}`} className="poster poster-empty" />
            ),
          )}
        </span>
        <span className="director-card-head">
          <Portrait director={director} />
          <span className="director-card-body">
            <span className="director-card-name">{director.name}</span>
            <span className="director-card-meta">{meta}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
