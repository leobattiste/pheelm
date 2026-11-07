import type { ReactNode } from "react";
import Link from "next/link";
import { countryName, runtimeLabel, tintStyle } from "@/lib/format";
import type { FilmCard as Card } from "@/lib/types";
import Poster from "./Poster";
import FilmLink from "./Transitions";
import QuickSave from "./QuickSave";

/**
 * A film in a grid. The same markup serves all three views: large and small posters, and the
 * list view, where the extra columns (country, running time) show as a row for scanning.
 */
/** posterOnly: just the poster, with the title and director as the link's label. */
export default function FilmCard({ film, priority, sizes, note, extra, posterOnly, href, controls }: { film: Card; priority?: boolean; sizes?: string; note?: string; extra?: string; posterOnly?: boolean; href?: string; controls?: ReactNode }) {
  const CardLink = href ? Link : FilmLink;
  return (
    <li className={`film-card${posterOnly ? " is-poster-only" : ""}`} style={tintStyle(film.color)}>
      <CardLink href={href ?? `/films/${film.slug}`} aria-label={posterOnly ? `${film.title}, ${film.directors.join(" and ")}, ${film.year}` : undefined}>
        <Poster title={film.title} year={film.year} directors={film.directors} src={film.poster_url} priority={priority} sizes={sizes} />
        <span className="film-card-title">{film.title}</span>
        <span className="film-card-meta">
          {/* On a person's page the line says what they did; elsewhere, who directed it. */}
          {note ?? film.directors.join(" and ")}<span className="film-card-year"> • {film.year}</span>
        </span>
        {extra && <span className="film-card-extra">{extra}</span>}
        <span className="film-card-col film-card-year-col">{film.year}</span>
        <span className="film-card-col film-card-country">{film.countries.map(countryName).join(", ")}</span>
        <span className="film-card-col film-card-runtime">{runtimeLabel(film.runtime) ?? "–"}</span>
      </CardLink>
      {!posterOnly && !href && <QuickSave filmId={film.id} title={film.title} />}
      {controls}
    </li>
  );
}

export function FilmGrid({ films, priority = 0, notes, extras }: { films: Card[]; priority?: number; notes?: Record<string, string>; extras?: Record<string, string> }) {
  return (
    <ul className="film-grid">
      {films.map((f, i) => (
        <FilmCard key={f.id} film={f} priority={i < priority} note={notes?.[f.id]} extra={extras?.[f.id]} />
      ))}
    </ul>
  );
}
