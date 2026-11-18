import Row from "@/components/Row";
import FilmCard from "@/components/FilmCard";
import { toCard } from "@/lib/data";
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
    {popular.map(film => <FilmCard key={film.id} film={toCard(film)} />)}
  </Row>;
}
