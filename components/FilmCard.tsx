import type { FilmCard as Card } from "@/lib/types";
import Poster from "./Poster";
import FilmLink from "./Transitions";

export default function FilmCard({ film, priority, sizes }: { film: Card; priority?: boolean; sizes?: string }) {
  return (
    <li className="film-card">
      <FilmLink href={`/films/${film.slug}`}>
        <Poster title={film.title} year={film.year} directors={film.directors} src={film.poster_url} priority={priority} sizes={sizes} />
        <span className="film-card-title">{film.title}</span>
        <span className="film-card-meta">
          {film.directors.join(" and ")}, {film.year}
        </span>
      </FilmLink>
    </li>
  );
}

export function FilmGrid({ films, priority = 0 }: { films: Card[]; priority?: number }) {
  return (
    <ul className="film-grid">
      {films.map((f, i) => (
        <FilmCard key={f.id} film={f} priority={i < priority} />
      ))}
    </ul>
  );
}
