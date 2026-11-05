import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import Poster from "@/components/Poster";
import WatchlistButton from "@/components/WatchlistButton";
import { getFilm, getFilms, toCard } from "@/lib/data";
import { countryName, listJoin, ROLE_LABELS, ROLES, runtimeLabel, trailerEmbed, TYPE_LABELS } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase/config";
import type { Award, Credit, WatchOption } from "@/lib/types";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getFilms()).map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const film = await getFilm((await params).slug);
  if (!film) return {};
  const by = film.directors.map((d) => d.name).join(", ");
  return {
    title: `${film.title} (${film.year})`,
    description: film.synopsis ?? `${film.title}, directed by ${by}.`,
    openGraph: film.poster_url ? { images: [film.poster_url] } : undefined,
  };
}

const KIND_LABELS: Record<WatchOption["kind"], string> = { stream: "Stream", free: "Free", rent: "Rent", buy: "Buy" };

export default async function FilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const film = await getFilm((await params).slug);
  if (!film) notFound();

  const all = await getFilms();
  const directorIds = new Set(film.directors.map((d) => d.id));
  const moreByDirector = all.filter((f) => f.id !== film.id && f.directors.some((d) => directorIds.has(d.id)));
  const related = moreByDirector.length
    ? []
    : all.filter((f) => f.id !== film.id && f.collections.some((c) => film.collections.some((fc) => fc.slug === c.slug))).slice(0, 6);

  const cast = film.credits.filter((c) => c.role === "cast");
  const crew = ROLES.filter((r) => r !== "cast")
    .map((role) => ({ role, people: film.credits.filter((c) => c.role === role) }))
    .filter((g) => g.people.length);
  const wins = film.awards.filter((a) => a.result === "won").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const noms = film.awards.filter((a) => a.result === "nominated").sort((a, b) => a.year - b.year);
  const embed = trailerEmbed(film.trailer_url);
  const watchKinds = (["stream", "free", "rent", "buy"] as const)
    .map((k) => ({ kind: k, options: film.watch.filter((w) => w.kind === k) }))
    .filter((g) => g.options.length);

  const facts = [
    film.year,
    TYPE_LABELS[film.type],
    film.countries.map(countryName).join(", "),
    film.languages.join(", "),
    runtimeLabel(film.runtime),
  ].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    url: `${SITE_URL}/films/${film.slug}`,
    datePublished: String(film.year),
    director: film.directors.map((d) => ({ "@type": "Person", name: d.name })),
    actor: cast.slice(0, 10).map((c) => ({ "@type": "Person", name: c.person.name })),
    image: film.poster_url ?? undefined,
    description: film.synopsis ?? undefined,
    countryOfOrigin: film.countries.map((c) => ({ "@type": "Country", name: countryName(c) })),
    inLanguage: film.languages,
  };

  return (
    <article className="film">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="film-hero">
        <Poster title={film.title} year={film.year} directors={film.directors.map((d) => d.name)} src={film.poster_url} size="large" priority />
        <div className="film-intro">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/films">Films</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/films?type=${film.type}`}>{TYPE_LABELS[film.type]}</Link>
          </nav>
          <h1>{film.title}</h1>
          {film.original_title && <p className="original-title">{film.original_title}</p>}
          <p className="film-by">
            Directed by{" "}
            {film.directors.map((d, i) => (
              <span key={d.id}>
                {i > 0 && (i === film.directors.length - 1 ? " and " : ", ")}
                <Link href={`/directors/${d.slug}`}>{d.name}</Link>
              </span>
            ))}
          </p>
          <p className="film-facts">
            {facts.map((f, i) => (
              <span key={i}>{f}</span>
            ))}
          </p>
          {film.genres.length > 0 && (
            <ul className="chip-list small">
              {film.genres.map((g) => (
                <li key={g}><Link className="chip" href={`/films?genre=${encodeURIComponent(g)}`}>{g}</Link></li>
              ))}
            </ul>
          )}
          {film.synopsis && <p className="synopsis">{film.synopsis}</p>}
          <WatchlistButton filmId={film.id} />
          {wins.length > 0 && <p className="award-flag">{awardFlag(wins)}</p>}
        </div>
      </header>

      <div className="film-body">
        {embed && (
          <section className="film-section">
            <h2>Trailer</h2>
            <div className="trailer">
              <iframe src={embed} title={`${film.title} trailer`} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
          </section>
        )}

        <section className="film-section">
          <h2>Where to watch</h2>
          {watchKinds.length ? (
            <div className="watch-groups">
              {watchKinds.map((g) => (
                <div key={g.kind}>
                  <h3 className="eyebrow">{KIND_LABELS[g.kind]}</h3>
                  <ul className="watch-list">
                    {g.options.map((w) => (
                      <li key={w.provider + w.region}>
                        <a href={w.url} target="_blank" rel="noopener noreferrer">
                          {w.provider}
                          {w.region && <span className="region">{w.region}</span>}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              We don&rsquo;t have viewing options for this film yet. <Link href="/submit">Know where it&rsquo;s showing?</Link>
            </p>
          )}
        </section>

        {(wins.length > 0 || noms.length > 0) && (
          <section className="film-section">
            <h2>Awards</h2>
            <ul className="award-list">
              {[...wins, ...noms].map((a, i) => (
                <li key={i} className={a.result}>
                  <span className="award-result">{isRegistry(a) ? "Selected" : a.result === "won" ? "Won" : "Nominated"}</span>
                  <span>
                    <strong>{a.award}</strong>
                    {!isRegistry(a) && <> · {a.category}</>}
                  </span>
                  <span className="award-year">{a.year}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(crew.length > 0 || cast.length > 0) && (
          <section className="film-section">
            <h2>Cast &amp; crew</h2>
            <div className="credits">
              {crew.length > 0 && (
                <dl className="crew">
                  {crew.map((g) => (
                    <div key={g.role}>
                      <dt>{ROLE_LABELS[g.role]}</dt>
                      <dd>{peopleLinks(g.people)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {cast.length > 0 && (
                <ul className="cast">
                  {cast.map((c) => (
                    <li key={c.person.id}>
                      <Link href={`/people/${c.person.slug}`}>{c.person.name}</Link>
                      {c.character && <span className="character">{c.character}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {film.collections.length > 0 && (
          <section className="film-section">
            <h2>In collections</h2>
            <ul className="chip-list">
              {film.collections.map((c) => (
                <li key={c.slug}><Link className="chip" href={`/collections/${c.slug}`}>{c.title}</Link></li>
              ))}
            </ul>
          </section>
        )}

        {moreByDirector.length > 0 && (
          <section className="film-section wide">
            <h2>More from {listJoin(film.directors.map((d) => d.name))}</h2>
            <FilmGrid films={moreByDirector.map(toCard)} />
          </section>
        )}
        {related.length > 0 && (
          <section className="film-section wide">
            <h2>You might also like</h2>
            <FilmGrid films={related.map(toCard)} />
          </section>
        )}
      </div>
    </article>
  );
}

// The festivals and awards people recognise first lead the summary line.
const ORDER = ["Academy Awards", "Cannes Film Festival", "Berlin International Film Festival", "Venice Film Festival", "BAFTA Awards", "César Awards", "Golden Globe Awards", "FESPACO", "Sundance Film Festival"];
function prestige(award: string) {
  const i = ORDER.indexOf(award);
  return i === -1 ? (award === "National Film Registry" ? 99 : 50) : i;
}
const isRegistry = (a: Award) => a.award === "National Film Registry";

function awardFlag(wins: Award[]) {
  const top = wins[0];
  if (isRegistry(top)) return "Selected for the U.S. National Film Registry";
  const name = top.award === "Academy Awards" ? `Academy Award for ${top.category}` : `${top.award} ${top.category}`;
  const prizes = wins.filter((w) => !isRegistry(w)).length;
  return prizes === 1 ? `Winner of the ${name}` : `${prizes} major prizes, including the ${name}`;
}

function peopleLinks(list: Credit[]) {
  return list.map((c, i) => (
    <span key={c.person.id}>
      {i > 0 && ", "}
      <Link href={`/people/${c.person.slug}`}>{c.person.name}</Link>
    </span>
  ));
}
