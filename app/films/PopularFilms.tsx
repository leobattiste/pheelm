import Row from "@/components/Row";
import Poster from "@/components/Poster";
import FilmLink from "@/components/Transitions";
import { getPopularMovieIds, rankPopularFilms } from "@/lib/film-popularity";
import type { Film } from "@/lib/types";
import styles from "./popular.module.css";

/** Worldwide TMDB popularity, independent of local saves or the visitor's search filters. */
export default async function PopularFilms({ films }: { films: Film[] }) {
  const popular = rankPopularFilms(films, await getPopularMovieIds());
  if (!popular.length) return <section className={styles.unavailable} aria-labelledby="popular-title">
    <h2 id="popular-title">Popular</h2>
    <p className="muted">Popular films are unavailable right now.</p>
  </section>;
  return <Row title="Popular" className={styles.carousel}>
    {popular.map(film => <li key={film.id} className={styles.posterItem}>
      <FilmLink className={styles.posterLink} href={`/films/${film.slug}`} aria-label={`${film.title}, ${film.directors.map(d => d.name).join(" and ")}, ${film.year}`}>
        <Poster title={film.title} year={film.year} directors={film.directors.map(d => d.name)} src={film.poster_url} />
      </FilmLink>
    </li>)}
  </Row>;
}
