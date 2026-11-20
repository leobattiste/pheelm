import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import { requireAdmin } from "@/lib/admin";
import { getFilm } from "@/lib/data";
import { countryName, runtimeLabel } from "@/lib/format";
import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import styles from "./mockups.module.css";

export const metadata: Metadata = privateMetadata("Film page mockups");
export const dynamic = "force-dynamic";

const CHOICES = ["atlantics", "timbuktu", "moonlight", "touki-bouki", "black-girl"];

/**
 * Three directions for the film page, side by side on one real film, so they can be judged
 * against each other rather than described. Admin only, and meant to be deleted once a direction
 * is chosen: nothing else imports from here.
 */
export default async function MockupsPage({ searchParams }: { searchParams: Promise<{ film?: string }> }) {
  await requireAdmin("/admin/mockups");
  const slug = (await searchParams).film ?? CHOICES[0];
  const film = await getFilm(slug);
  if (!film) notFound();

  const directors = film.directors.map((d) => d.name).join(", ");
  const runtime = runtimeLabel(film.runtime);
  const win = film.awards.find((a) => a.result === "won");
  const facts = [directors, String(film.year), runtime, film.countries.map(countryName).join(", ")].filter(Boolean);
  const blurb = (film.synopsis ?? "").split(/\n{2,}/)[0];
  const tint = film.color ?? "#2a2a2a";

  return (
    <section className="page">
      <header className="page-head">
        <h1>Film page mockups</h1>
        <p className="lead">Three directions on the same film. Scroll each one, then tell me which to build.</p>
        <ul className="chip-list">
          {CHOICES.map((c) => (
            <li key={c}><Link className="chip" href={`/admin/mockups?film=${c}`} aria-current={c === slug ? "true" : undefined}>{c.replace(/-/g, " ")}</Link></li>
          ))}
        </ul>
      </header>

      <div className={styles.mocks} style={{ ["--tint" as string]: tint }}>
        {/* A — the still opens the page, the poster overlapping it. */}
        <figure className={styles.mock}>
          <figcaption className={styles.label}><strong>A · Still first</strong> The film&rsquo;s own frame opens the page. 76% of films have one.</figcaption>
          <div className={styles.frame}>
            {film.backdrop_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.still} src={film.backdrop_url} alt="" />
            ) : <div className={`${styles.still} ${styles.stillEmpty}`} />}
            <div className={styles.stillBody}>
              <div className={styles.stillPoster}><Poster title={film.title} year={film.year} directors={[directors]} src={film.poster_url} sizes="180px" priority /></div>
              <div>
                <h2 className={styles.titleMid}>{film.title}</h2>
                <p className={styles.facts}>{facts.join(" · ")}</p>
                {win && <p className={styles.honour}><Icon name="laurel" /> {win.category || win.award}, {win.year}</p>}
                <div className={styles.actions}><span className={styles.cta}>Trailer</span><span className={styles.ghost}>Watchlist</span></div>
              </div>
            </div>
            <p className={styles.blurb}>{blurb}</p>
          </div>
        </figure>

        {/* B — the colour taken from the poster becomes the page's own light. */}
        <figure className={styles.mock}>
          <figcaption className={styles.label}><strong>B · Colour wash</strong> The colour already stored for every film, used as the page&rsquo;s light.</figcaption>
          <div className={`${styles.frame} ${styles.wash}`}>
            <div className={styles.washTop}>
              <div className={styles.washPoster}><Poster title={film.title} year={film.year} directors={[directors]} src={film.poster_url} sizes="200px" priority /></div>
              <div>
                <h2 className={styles.titleMid}>{film.title}</h2>
                <p className={styles.facts}>{facts.join(" · ")}</p>
                {win && <p className={styles.honour}><Icon name="laurel" /> {win.category || win.award}, {win.year}</p>}
                <div className={styles.actions}><span className={styles.cta}>Trailer</span><span className={styles.ghost}>Watchlist</span></div>
              </div>
            </div>
            <p className={styles.blurb}>{blurb}</p>
          </div>
        </figure>

        {/* C — the title carries the page; everything else gets quieter. */}
        <figure className={styles.mock}>
          <figcaption className={styles.label}><strong>C · Big type</strong> The title at full scale, the year as a quiet number. No new data needed.</figcaption>
          <div className={styles.frame}>
            <div className={styles.typeTop}>
              <p className={styles.year}>{film.year}</p>
              <h2 className={styles.titleBig}>{film.title}</h2>
              <p className={styles.directedBy}>Directed by <span>{directors}</span></p>
              {win && <p className={styles.honour}><Icon name="laurel" /> {win.category || win.award}, {win.year}</p>}
            </div>
            <div className={styles.typeBody}>
              <div className={styles.typePoster}><Poster title={film.title} year={film.year} directors={[directors]} src={film.poster_url} sizes="220px" priority /></div>
              <div>
                <div className={styles.actions}><span className={styles.cta}>Trailer</span><span className={styles.ghost}>Watchlist</span></div>
                <p className={styles.blurb}>{blurb}</p>
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
