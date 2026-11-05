import Link from "next/link";
import { countryName } from "@/lib/format";
import type { FilmCard as Card } from "@/lib/types";
import Poster from "./Poster";

export default function FilmCard({ film, priority }: { film: Card; priority?: boolean }) {
  return (
    <li className="film-card">
      <Link href={`/films/${film.slug}`}>
        <Poster title={film.title} year={film.year} directors={film.directors} src={film.poster_url} priority={priority} />
        <span className="film-card-title">{film.title}</span>
        <span className="film-card-meta">
          {film.directors.join(", ")} · {film.year}
        </span>
        <span className="film-card-meta subtle">{film.countries.map(countryName).join(", ")}</span>
      </Link>
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
