import Link from "next/link";
import { countryName, filmColour, initials } from "@/lib/format";
import type { Director } from "@/lib/types";

/** A director's portrait, or their initials on the colour of their best-known film here. */
export function Portrait({ director, className = "" }: { director: Director; className?: string }) {
  if (director.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`portrait ${className}`} src={director.photo_url} alt="" loading="lazy" />;
  }
  const lead = director.films.find((f) => f.featured) ?? director.films[0];
  return (
    <span className={`portrait portrait-initials ${className}`} aria-hidden="true"
      style={lead ? { background: `color-mix(in oklab, ${filmColour(lead)} 70%, #0d0907)`, color: "#f6efe5" } : undefined}>
      {initials(director.name)}
    </span>
  );
}

export default function DirectorCard({ director }: { director: Director }) {
  const n = director.films.length;
  return (
    <li className="director-card">
      <Link href={`/directors/${director.slug}`}>
        <Portrait director={director} />
        <span className="director-card-name">{director.name}</span>
        <span className="director-card-meta">
          {director.country ? `${countryName(director.country)}, ` : ""}
          {n} {n === 1 ? "film" : "films"}
        </span>
      </Link>
    </li>
  );
}
