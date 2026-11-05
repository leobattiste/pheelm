import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FilmCard from "@/components/FilmCard";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import ShareButton from "@/components/ShareButton";
import Tabs from "@/components/Tabs";
import TrailerButton from "@/components/TrailerButton";
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
  const by = listJoin(film.directors.map((d) => d.name));
  return {
    title: `${film.title} (${film.year})`,
    description: film.synopsis ?? `${film.title}, directed by ${by}.`,
  };
}

const KIND_LABELS: Record<WatchOption["kind"], string> = { stream: "Stream", free: "Watch free", rent: "Rent", buy: "Buy" };

export default async function FilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const film = await getFilm((await params).slug);
  if (!film) notFound();

  const all = await getFilms();
  const directorIds = new Set(film.directors.map((d) => d.id));
  const moreByDirector = all.filter((f) => f.id !== film.id && f.directors.some((d) => directorIds.has(d.id)));
  const related = all
    .filter((f) => f.id !== film.id && !moreByDirector.includes(f) && f.collections.some((c) => film.collections.some((fc) => fc.slug === c.slug)))
    .slice(0, 12);

  const cast = film.credits.filter((c) => c.role === "cast");
  const crew = ROLES.filter((r) => r !== "cast")
    .map((role) => ({ role, people: film.credits.filter((c) => c.role === role) }))
    .filter((g) => g.people.length);
  const wins = film.awards.filter((a) => a.result === "won").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const noms = film.awards.filter((a) => a.result === "nominated").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const embed = trailerEmbed(film.trailer_url);
  const watchKinds = (["stream", "free", "rent", "buy"] as const)
    .map((k) => ({ kind: k, options: film.watch.filter((w) => w.kind === k) }))
    .filter((g) => g.options.length);
  const directorNames = film.directors.map((d) => d.name);

  const tags = [String(film.year), TYPE_LABELS[film.type], runtimeLabel(film.runtime), film.genres[0]].filter(Boolean) as string[];

  const facts: [string, React.ReactNode][] = [
    ["Directed by", film.directors.map((d, i) => (
      <span key={d.id}>{i > 0 && ", "}<Link href={`/directors/${d.slug}`}>{d.name}</Link></span>
    ))],
    ["Year", <Link key="y" href={`/films?decade=${Math.floor(film.year / 10) * 10}s`}>{film.year}</Link>],
    [film.countries.length > 1 ? "Countries" : "Country", film.countries.map((c, i) => (
      <span key={c}>{i > 0 && ", "}<Link href={`/films?country=${c}`}>{countryName(c)}</Link></span>
    ))],
  ];
  if (film.languages.length) facts.push([film.languages.length > 1 ? "Languages" : "Language", film.languages.join(", ")]);
  if (film.runtime) facts.push(["Running time", runtimeLabel(film.runtime)]);
  if (film.genres.length) facts.push(["Genre", film.genres.map((g, i) => (
    <span key={g}>{i > 0 && ", "}<Link href={`/films?genre=${encodeURIComponent(g)}`}>{g}</Link></span>
  ))]);

  const overview = (
    <div className="overview">
      {film.synopsis && <p className="synopsis">{film.synopsis}</p>}
      {wins.length > 0 && (
        <p className="award-line">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z" /></svg>
          {awardLine(wins)}
        </p>
      )}
      <dl className="facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {film.collections.length > 0 && (
        <div className="overview-collections">
          <h3>In collections</h3>
          <ul className="chip-list">
            {film.collections.map((c) => (
              <li key={c.slug}><Link className="chip" href={`/collections/${c.slug}`}>{c.title}</Link></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const credits = (
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
        <ul className="cast" aria-label="Cast">
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
      )}
    </div>
  );

  const awards = (
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
  );

  const watch = watchKinds.length ? (
    <div className="watch-groups">
      {watchKinds.map((g) => (
        <div key={g.kind} className="watch-group">
          <h3>{KIND_LABELS[g.kind]}</h3>
          <ul className="watch-list">
            {g.options.map((w) => (
              <li key={w.provider + w.region + w.kind}>
                <a href={w.url} target="_blank" rel="noopener noreferrer">
                  <span>{w.provider}</span>
                  {w.region && <span className="region">{w.region}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {film.watch.some((w) => w.url.includes("themoviedb.org")) && <p className="watch-note">Availability by country, from JustWatch.</p>}
    </div>
  ) : (
    <div className="empty-state compact">
      <p>No viewing options listed yet.</p>
      <p className="muted"><Link href="/submit">Tell us where it&rsquo;s showing</Link>.</p>
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", content: overview },
    ...(cast.length || crew.length ? [{ id: "cast", label: "Cast & crew", count: film.credits.length, content: credits }] : []),
    ...(wins.length || noms.length ? [{ id: "awards", label: "Awards", count: wins.length + noms.length, content: awards }] : []),
    { id: "watch", label: "Where to watch", ...(watchKinds.length ? { count: film.watch.length } : {}), content: watch },
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
    <article className="film">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className={`film-hero${film.backdrop_url ? " has-still" : ""}`}>
        {film.backdrop_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="film-hero-still" src={film.backdrop_url} alt="" fetchPriority="high" />
        )}
        <div className="film-hero-body">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/films">Films</Link>
            <span aria-hidden="true">/</span>
            <span>{TYPE_LABELS[film.type]}</span>
          </nav>
          <h1>{film.title}</h1>
          {film.original_title && <p className="original">{film.original_title}</p>}
          <p className="by">
            {film.directors.map((d, i) => (
              <span key={d.id}>
                {i > 0 && (i === film.directors.length - 1 ? " and " : ", ")}
                <Link href={`/directors/${d.slug}`}>{d.name}</Link>
              </span>
            ))}
          </p>
          <ul className="tags" aria-label="About this film">
            {tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div className="actions">
            {embed && <TrailerButton embed={embed} title={film.title} />}
            <WatchlistButton filmId={film.id} />
            <ShareButton title={film.title} />
          </div>
        </div>
      </header>

      <div className="film-main">
        <Poster title={film.title} year={film.year} directors={directorNames} src={film.poster_url} sizes="(min-width: 900px) 280px, 100vw" priority hero />
        <Tabs tabs={tabs} label={`About ${film.title}`} />
      </div>

      {moreByDirector.length > 0 && (
        <Row title={`More from ${listJoin(directorNames)}`}>
          {moreByDirector.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      )}
      {related.length > 0 && (
        <Row title="You might also like">
          {related.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      )}
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

function awardLine(wins: Award[]) {
  const top = wins[0];
  if (isRegistry(top)) return "Preserved in the U.S. National Film Registry";
  const name = top.award === "Academy Awards" ? `Academy Award for ${top.category}` : `${top.award} ${top.category}`;
  const prizes = wins.filter((w) => !isRegistry(w)).length;
  return prizes === 1 ? `Winner of the ${name}` : `Winner of ${prizes} major prizes, including the ${name}`;
}

function peopleLinks(list: Credit[]) {
  return list.map((c, i) => (
    <span key={c.person.id}>
      {i > 0 && ", "}
      <Link href={`/people/${c.person.slug}`}>{c.person.name}</Link>
    </span>
  ));
}
