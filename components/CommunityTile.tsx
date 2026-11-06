import Link from "next/link";
import type { CommunityCollection } from "@/lib/community";
import { tintStyle } from "@/lib/format";
import Poster from "./Poster";

/** A member's collection: three posters, title, who made it, how many films and saves. */
export default function CommunityTile({ c, showOwner = true, badge }: { c: CommunityCollection; showOwner?: boolean; badge?: string }) {
  const meta = [
    showOwner && c.owner ? `by @${c.owner.handle}` : null,
    `${c.films.length} ${c.films.length === 1 ? "film" : "films"}`,
    c.saves ? `Saved by ${c.saves}` : null,
  ].filter(Boolean).join(" • ");
  return (
    <li>
      <Link href={`/c/${c.id}`} className="collection-tile" style={tintStyle(c.films.slice(0, 3).find((f) => f.color)?.color)}>
        <span className="collection-fan" aria-hidden="true">
          {[0, 1, 2].map((i) => {
            const f = c.films[i];
            return f ? (
              <Poster key={f.id} title={f.title} year={f.year} directors={f.directors.map((d) => d.name)} src={f.poster_url} sizes="140px" />
            ) : (
              <span key={`empty-${i}`} className="poster poster-empty" />
            );
          })}
        </span>
        <span className="collection-title">
          {c.title}
          {c.staff_pick && <span className="staff-pick">Staff pick</span>}
          {badge && <span className="tile-badge">{badge}</span>}
        </span>
        <span className="collection-desc">{meta}</span>
      </Link>
    </li>
  );
}
