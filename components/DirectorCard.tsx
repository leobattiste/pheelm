import Link from "next/link";
import { countryName, initials } from "@/lib/format";
import type { DirectorSummary } from "@/lib/types";

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

export default function DirectorCard({ director }: { director: DirectorSummary }) {
  const n = director.films;
  return (
    <li className="director-card">
      <Link href={`/directors/${director.slug}`}>
        <Portrait director={director} />
        <span className="director-card-body">
          <span className="director-card-name">{director.name}</span>
          <span className="director-card-meta">{director.country ? countryName(director.country) : " "}</span>
          <span className="director-card-stats">
            <span>{n} {n === 1 ? "film" : "films"}</span>
            <span>{director.first === director.last ? director.first : `${director.first}–${director.last}`}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
