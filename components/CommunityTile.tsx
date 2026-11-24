import { watchlistPath } from "@/lib/watchlist-links";
import type { ReactNode } from "react";
import Link from "next/link";
import type { CommunityCollection } from "@/lib/community";
import type { CollectionTileData } from "@/lib/types";
import { tintStyle } from "@/lib/format";
import Icon, { type IconName } from "./Icon";
import Poster from "./Poster";

const BADGE_ICONS: Record<string, IconName> = { Private: "lock", Public: "globe", Shared: "users" };

/** A collection: three posters, its title, then how many films ("12 films"). No usernames. */
export default function CommunityTile({ c, badge, filmCount, footer, plain }: { c: CollectionTileData | CommunityCollection; badge?: string; filmCount?: number; footer?: ReactNode; plain?: boolean }) {
  const Wrap = (plain ? "span" : Link) as React.ElementType;
  const count = `${filmCount ?? c.films.length} ${(filmCount ?? c.films.length) === 1 ? "film" : "films"}`;
  const meta = count;
  return (
    <li className={footer ? "admin-managed-card" : undefined}>
      <Wrap {...(plain ? {} : { href: watchlistPath(c) })} className="collection-tile" style={tintStyle(c.films.slice(0, 3).find((f) => f.color)?.color)}>
        <span className="collection-fan" aria-hidden="true">
          {[0, 1, 2].map((i) => {
            const f = c.films[i];
            return f ? (
              <Poster key={f.id} title={f.title} year={f.year} directors={f.directors.map((d) => (typeof d === "string" ? d : d.name))} src={f.poster_url} sizes="140px" />
            ) : (
              <span key={`empty-${i}`} className="poster poster-empty" />
            );
          })}
        </span>
        <span className="collection-title">
          {c.title}
        </span>
        <span className="collection-desc">
          {meta}
          {badge && (
            <span className="tile-icon" title={badge}>
              <Icon name={BADGE_ICONS[badge] ?? "eye"} label={badge} />
            </span>
          )}
        </span>
      </Wrap>
      {footer}
    </li>
  );
}
