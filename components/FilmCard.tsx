import { countryName, runtimeLabel, tintStyle } from "@/lib/format";
import type { FilmCard as Card } from "@/lib/types";
import Poster from "./Poster";
import FilmLink from "./Transitions";

/**
 * A film in a grid. The same markup serves all three views: large and small posters, and the
 * list view, where the extra columns (country, running time) show as a row for scanning.
 */
export default function FilmCard({ film, priority, sizes, note }: { film: Card; priority?: boolean; sizes?: string; note?: string }) {
  return (
    <li className="film-card" style={tintStyle(film.color)}>
      <FilmLink href={`/films/${film.slug}`}>
        <Poster title={film.title} year={film.year} directors={film.directors} src={film.poster_url} priority={priority} sizes={sizes} />
        <span className="film-card-title">{film.title}</span>
        <span className="film-card-meta">
          {/* On a person's page the line says what they did; elsewhere, who directed it. */}
          {note ?? film.directors.join(" and ")}<span className="film-card-year"> • {film.year}</span>
        </span>
        <span className="film-card-col film-card-year-col">{film.year}</span>
        <span className="film-card-col film-card-country">{film.countries.map(countryName).join(", ")}</span>
        <span className="film-card-col film-card-runtime">{runtimeLabel(film.runtime) ?? "–"}</span>
      </FilmLink>
    </li>
  );
}

export function FilmGrid({ films, priority = 0, notes }: { films: Card[]; priority?: number; notes?: Record<string, string> }) {
  return (
    <ul className="film-grid">
      {films.map((f, i) => (
        <FilmCard key={f.id} film={f} priority={i < priority} note={notes?.[f.id]} />
      ))}
    </ul>
  );
}
