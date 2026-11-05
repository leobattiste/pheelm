import Link from "next/link";
import { countryName, initials } from "@/lib/format";
import type { Director } from "@/lib/types";

/** A director's portrait, or their initials on a gray tile until a portrait is added. */
export function Portrait({ director, className = "" }: { director: Director; className?: string }) {
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

export default function DirectorCard({ director }: { director: Director }) {
  const n = director.films.length;
  const years = director.films.map((f) => f.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  return (
    <li className="director-card">
      <Link href={`/directors/${director.slug}`}>
        <Portrait director={director} />
        <span className="director-card-body">
          <span className="director-card-name">{director.name}</span>
          <span className="director-card-meta">{director.country ? countryName(director.country) : " "}</span>
          <span className="director-card-stats">
            <span>{n} {n === 1 ? "film" : "films"}</span>
            <span>{first === last ? first : `${first}–${last}`}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
