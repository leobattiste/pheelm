import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import Palette from "@/components/Palette";
import Poster from "@/components/Poster";
import ReadingProgress from "@/components/ReadingProgress";
import ShareButton from "@/components/ShareButton";
import TrailerButton from "@/components/TrailerButton";
import WatchlistButton from "@/components/WatchlistButton";
import { getFilm, getFilms, toCard } from "@/lib/data";
import { countryName, inkFor, listJoin, ROLE_LABELS, ROLES, runtimeLabel, trailerEmbed, TYPE_LABELS } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase/config";
import type { Award, Film, WatchOption } from "@/lib/types";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getFilms()).map((f) => ({ slug: f.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const validColour = (hex: string | null | undefined) => (hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null);

/** Tints the phone's browser bar with the film's colour, like Covvvvvers cover pages. */
export async function generateViewport({ params }: Params): Promise<Viewport> {
  const film = await getFilm((await params).slug);
  const bg = validColour(film?.color);
  return bg ? { themeColor: bg } : {};
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const film = await getFilm((await params).slug);
  if (!film) return {};
  const by = listJoin(film.directors.map((d) => d.name));
  return {
    title: `${film.title} (${film.year}), directed by ${by}`,
    description: film.synopsis ?? `${film.title}, directed by ${by}.`,
    alternates: { canonical: `/films/${film.slug}` },
  };
}

const KIND_LABELS: Record<WatchOption["kind"], string> = { stream: "Stream", free: "Watch free", rent: "Rent", buy: "Buy" };

/**
 * The whole page takes the film's colour (from its poster), with black or white text for
 * contrast. Films without a poster colour keep the site's own black, white and gray.
 */
function pageColours(bg: string) {
  const ink = inkFor(bg);
  const mix = (n: number) => `color-mix(in srgb, ${ink} ${n}%, ${bg})`;
  return `:root[data-theme]{--bg:${bg};--ink:${ink};--text:${ink};--on-ink:${bg};--muted:${mix(66)};--line:${mix(18)};--line-strong:${mix(32)};--surface:${mix(5)};--raised:${mix(9)};--hover:${mix(12)};--gold:${ink};color-scheme:${ink === "#ffffff" ? "dark" : "light"}}`;
}

export default async function FilmPage({ params }: Params) {
  const film = await getFilm((await params).slug);
  if (!film) notFound();

  const all = await getFilms();
  const directorIds = new Set(film.directors.map((d) => d.id));
  const moreByDirector = all.filter((f) => f.id !== film.id && f.directors.some((d) => directorIds.has(d.id)));
  const related = all
    .filter((f) => f.id !== film.id && !moreByDirector.includes(f) && f.collections.some((c) => film.collections.some((fc) => fc.slug === c.slug)))
    .slice(0, 12);

  const bg = validColour(film.color);
  const cast = film.credits.filter((c) => c.role === "cast");
  const crew = ROLES.filter((r) => r !== "cast")
    .map((role) => ({ role, people: film.credits.filter((c) => c.role === role) }))
    .filter((g) => g.people.length);
  const wins = film.awards.filter((a) => a.result === "won").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const noms = film.awards.filter((a) => a.result === "nominated").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const embed = trailerEmbed(film.trailer_url);
  const directorNames = film.directors.map((d) => d.name);

  // Like "Listen" on Covvvvvers: where to watch, by kind.
  const watchRows = (["stream", "free", "rent", "buy"] as const)
    .map((k) => [KIND_LABELS[k], uniqueByProvider(film.watch.filter((w) => w.kind === k))] as const)
    .filter(([, list]) => list.length);

  const facts: [string, React.ReactNode][] = [
    ["Film", film.original_title ? `${film.title} (${film.original_title})` : film.title],
    ["Released", <Link key="y" href={`/films?decade=${Math.floor(film.year / 10) * 10}s`}>{film.year}</Link>],
    [film.countries.length > 1 ? "Countries" : "Country", film.countries.map((c, i) => (
      <span key={c}>{i > 0 && ", "}<Link href={`/films?country=${c}`}>{countryName(c)}</Link></span>
    ))],
    [film.languages.length > 1 ? "Languages" : "Language", film.languages.length ? film.languages.join(", ") : null],
    ["Running time", runtimeLabel(film.runtime)],
    ["Type", <Link key="t" href={`/films?type=${film.type}`}>{TYPE_LABELS[film.type]}</Link>],
    ["Genre", film.genres.length ? film.genres.map((g, i) => (
      <span key={g}>{i > 0 && ", "}<Link href={`/films?genre=${encodeURIComponent(g)}`}>{g}</Link></span>
    )) : null],
  ];

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
    <>
      <article className="film-page">
        {/* Hands the film's colour to the whole page, header and footer included, while it's open. */}
        {bg && <style>{pageColours(bg)}</style>}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <ReadingProgress target=".film-body" />

        <div className="film-art">
          <Poster title={film.title} year={film.year} directors={directorNames} src={film.poster_url} sizes="(min-width: 800px) 46vw, 100vw" priority hero />
        </div>

        <div className="film-body">
          <header className="film-head">
            <h1 className="film-title">{film.title}</h1>
            <p className="film-byline">
              <span className="byline-item">
                {film.directors.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && (i === film.directors.length - 1 ? " and " : ", ")}
                    <Link href={`/directors/${d.slug}`}>{d.name}</Link>
                  </span>
                ))}
              </span>
              <Link className="byline-item" href={`/films?type=${film.type}`}>{TYPE_LABELS[film.type]}</Link>
              <Link className="byline-item" href={`/films?decade=${Math.floor(film.year / 10) * 10}s`}>{film.year}</Link>
            </p>
          </header>

          <div className="film-actions">
            {embed ? (
              <TrailerButton embed={embed} title={film.title} className="pill-button" label="Trailer" />
            ) : (
              // No trailer on file yet: search YouTube for it instead.
              <a
                className="pill-button"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} ${film.year} trailer`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg className="solid" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.5v11l9-5.5z" /></svg>
                Trailer
              </a>
            )}
            <WatchlistButton filmId={film.id} filmTitle={film.title} />
            <ShareButton title={film.title} />
          </div>

          {(film.synopsis || wins.length > 0) && (
            <div className="film-essay">
              {film.synopsis?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
              {wins.length > 0 && <p className="film-award">{awardLine(wins)}</p>}
            </div>
          )}

          <section className="sleeve" aria-label="Credits">
            {film.poster_url && (
              <div className="sleeve-palette">
                <Palette src={film.poster_url.replace(/\/t\/p\/[^/]+\//, "/t/p/w185/")} fallback={bg ? [bg] : []} />
              </div>
            )}
            {crew.length > 0 && (
              <dl className="sleeve-people">
                {crew.map((g) => (
                  <div key={g.role}>
                    <dt>{ROLE_LABELS[g.role]}</dt>
                    <dd>
                      {g.people.map((c, i) => (
                        <span key={c.person.id}>
                          {i > 0 && ", "}
                          <Link href={g.role === "director" ? `/directors/${c.person.slug}` : `/people/${c.person.slug}`}>{c.person.name}</Link>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <dl className="sleeve-facts">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {watchRows.length > 0 ? (
                watchRows.map(([label, list]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {list.map((w, i) => (
                        <span key={w.provider}>
                          {i > 0 && ", "}
                          <a href={w.url} target="_blank" rel="noopener noreferrer">{w.provider}</a>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))
              ) : (
                <div>
                  <dt>Watch</dt>
                  <dd><Link href="/submit">Tell us where it&rsquo;s showing</Link></dd>
                </div>
              )}
            </dl>
            {film.collections.length > 0 && (
              <div className="sleeve-collections">
                <p className="sleeve-label">In collections</p>
                <ul className="chip-list">
                  {film.collections.map((c) => (
                    <li key={c.slug}><Link className="chip" href={`/collections/${c.slug}`}>{c.title}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {(wins.length > 0 || noms.length > 0) && (
            <section className="film-section" aria-labelledby="awards-h">
              <h2 id="awards-h">Awards</h2>
              <ul className="award-list">
                {[...wins, ...noms].map((a, i) => (
                  <li key={i}>
                    <span className={`award-badge ${isRegistry(a) ? "kept" : a.result}`}>{isRegistry(a) ? "Preserved" : a.result === "won" ? "Won" : "Nominated"}</span>
                    <span className="award-text">
                      <span className="award-name">{a.award}</span>
                      <span className="award-what">{isRegistry(a) ? "Selected for the National Film Registry" : a.category}</span>
                    </span>
                    <span className="award-year">{a.year}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {cast.length > 0 && (
            <section className="film-section" aria-labelledby="cast-h">
              <h2 id="cast-h">Cast</h2>
              <ul className="cast">
                {cast.map((c) => (
                  <li key={c.person.id}>
                    {c.person.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="cast-photo" src={c.person.photo_url} alt="" loading="lazy" />
                    ) : (
                      <span className="cast-photo" aria-hidden="true" />
                    )}
                    <span className="cast-text">
                      <Link href={`/people/${c.person.slug}`}>{c.person.name}</Link>
                      {c.character && <span className="character">{c.character}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>

      {moreByDirector.length > 0 && (
        <section className="related" aria-labelledby="more-h">
          <div className="section-head">
            <h2 id="more-h">More from {listJoin(directorNames)}</h2>
          </div>
          <FilmGrid films={moreByDirector.map(toCard)} />
        </section>
      )}
      {related.length > 0 && (
        <section className="related" aria-labelledby="related-h">
          <div className="section-head">
            <h2 id="related-h">More like this</h2>
          </div>
          <FilmGrid films={related.map(toCard)} />
        </section>
      )}
    </>
  );
}

/** One link per service: TMDB lists each service once per country. */
function uniqueByProvider(list: Film["watch"]) {
  const seen = new Set<string>();
  return list.filter((w) => !seen.has(w.provider) && seen.add(w.provider));
}

// The festivals and awards people recognise first lead the summary line.
const ORDER = ["Academy Awards", "Cannes Film Festival", "Berlin International Film Festival", "Venice Film Festival", "BAFTA Awards", "César Awards", "Golden Globe Awards", "FESPACO", "Sundance Film Festival"];
function prestige(award: string) {
  const i = ORDER.indexOf(award);
  return i === -1 ? (award === "National Film Registry" ? 99 : 50) : i;
}
const isRegistry = (a: Award) => a.award === "National Film Registry";

function awardLine(wins: Award[]) {
  const top = wins[0];
  if (isRegistry(top)) return "Preserved in the U.S. National Film Registry.";
  const name = top.award === "Academy Awards" ? `Academy Award for ${top.category}` : `${top.award} ${top.category}`;
  const prizes = wins.filter((w) => !isRegistry(w)).length;
  return prizes === 1 ? `Winner of the ${name}.` : `Winner of ${prizes} major prizes, including the ${name}.`;
}
