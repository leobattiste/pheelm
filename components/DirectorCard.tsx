import type { ReactNode } from "react";
import Link from "next/link";
import { countryName, initials, tintStyle } from "@/lib/format";
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
 * A director's card, built like a collection card: three of their films side by side (with empty
 * slots when they have fewer), then a small square portrait, their name, country and film count.
 */
export default function DirectorCard({ director, href, meta, footer, showPreviews = true, plain }: { director: DirectorSummary; href?: string; meta?: string; footer?: ReactNode; showPreviews?: boolean; plain?: boolean }) {
  // Best-known film first; empty slots fill the row when there are fewer than three.
  const Wrap = (plain ? "span" : Link) as React.ElementType;
  const slots = [0, 1, 2].map((i) => director.previews[i]);
  return (
    <li className={`director-card${footer ? " admin-managed-card" : ""}`}>
      <Wrap {...(plain ? {} : { href: href ?? `/directors/${director.slug}` })} className="collection-tile" style={tintStyle(director.previews.find((f) => f.color)?.color)}>
        {showPreviews && <span className="collection-fan" aria-hidden="true">
          {slots.map((f, i) =>
            f ? (
              <Poster key={f.slug} title={f.title} year={f.year} directors={f.directors} src={f.poster_url} sizes="140px" />
            ) : (
              <span key={`empty-${i}`} className="poster poster-empty" />
            ),
          )}
        </span>}
        <span className="director-card-head">
          <Portrait director={director} />
          <span className="director-card-body">
            <span className="director-card-name">{director.name}</span>
            <span className="director-card-meta">{meta ?? [director.country && countryName(director.country)].filter(Boolean).join(" • ")}</span>
          </span>
        </span>
      </Wrap>
      {footer}
    </li>
  );
}
