import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import { requireAdmin } from "@/lib/admin";
import { getFilm } from "@/lib/data";
import { countryName, runtimeLabel } from "@/lib/format";
import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";

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

  const css = `/* Scoped to the mockup page: nothing here touches the real film page. */
.mockups .mocks { display: grid; gap: var(--space-48); margin-top: var(--space-32); }
.mockups .mock { display: grid; gap: var(--space-12); margin: 0; }
.mockups .label { color: var(--muted); font-size: var(--t-sm); }
.mockups .label strong { display: inline-block; margin-right: var(--space-8); color: var(--ink); }
.mockups .frame { overflow: hidden; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg); }

/* A — still first */
.mockups .still { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.mockups .stillEmpty { background: linear-gradient(160deg, var(--tint), var(--bg)); }
.mockups .stillBody { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-20);
  align-items: end; margin-top: -72px; padding: 0 var(--space-24); }
.mockups .stillPoster { width: 132px; filter: drop-shadow(0 18px 30px rgb(0 0 0 / 0.5)); }
.mockups .stillPoster .poster { width: 100%; }

/* B — colour wash */
.mockups .wash { background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 80%, var(--bg)) 0%, var(--bg) 70%); }
.mockups .washTop { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-24); align-items: center; padding: var(--space-32) var(--space-24) var(--space-8); }
.mockups .washPoster { width: 150px; filter: drop-shadow(0 20px 36px rgb(0 0 0 / 0.45)); }
.mockups .washPoster .poster { width: 100%; }

/* C — big type */
.mockups .typeTop { padding: var(--space-32) var(--space-24) var(--space-20); border-bottom: 1px solid var(--line); }
.mockups .year { color: var(--muted); font-size: var(--t-lg); font-variant-numeric: tabular-nums; }
.mockups .titleBig { margin: var(--space-4) 0 var(--space-12); font-size: clamp(2.6rem, 11vw, 5rem); line-height: 0.95; letter-spacing: -0.04em; overflow-wrap: anywhere; }
.mockups .directedBy { color: var(--muted); font-size: var(--t-md); }
.mockups .directedBy span { color: var(--ink); }
.mockups .typeBody { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-24); padding: var(--space-24); }
.mockups .typePoster { width: 150px; }
.mockups .typePoster .poster { width: 100%; }

/* shared bits */
.mockups .titleMid { font-size: clamp(1.6rem, 6vw, 2.4rem); line-height: var(--lh-tight); letter-spacing: -0.03em; overflow-wrap: anywhere; }
.mockups .facts { margin-top: var(--space-4); color: var(--muted); font-size: var(--t-sm); }
.mockups .honour { display: inline-flex; gap: var(--space-8); align-items: center; margin-top: var(--space-12);
  padding: var(--space-4) var(--space-12); border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: var(--pill); font-size: var(--t-sm); }
.mockups .honour svg { width: 16px; height: 16px; }
.mockups .actions { display: flex; gap: var(--space-8); margin-top: var(--space-16); }
.mockups .cta, .mockups .ghost { display: inline-grid; place-items: center; height: 40px; padding: 0 var(--space-20); border-radius: var(--pill); font-size: var(--t-sm); }
.mockups .cta { background: var(--ink); color: var(--bg); }
.mockups .ghost { border: 1px solid var(--line); }
.mockups .blurb { max-width: 62ch; padding: var(--space-20) var(--space-24) var(--space-28); color: var(--ink); line-height: var(--lh-body); }

@media (max-width: 639px) {
.mockups .stillBody, .mockups .washTop, .mockups .typeBody { grid-template-columns: 1fr; }
.mockups .stillBody { margin-top: -56px; align-items: start; }
.mockups .stillPoster, .mockups .washPoster, .mockups .typePoster { width: 108px; }
.mockups .blurb { padding-top: var(--space-12); }
}
`;

  return (
    <section className="page mockups">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <header className="page-head">
        <h1>Film page mockups</h1>
        <p className="lead">Three directions on the same film. Scroll each one, then tell me which to build.</p>
        <ul className="chip-list">
          {CHOICES.map((c) => (
            <li key={c}><Link className="chip" href={`/admin/mockups?film=${c}`} aria-current={c === slug ? "true" : undefined}>{c.replace(/-/g, " ")}</Link></li>
          ))}
        </ul>
      </header>

      <div className="mocks" style={{ ["--tint" as string]: tint }}>
        {/* A — the still opens the page, the poster overlapping it. */}
        <figure className="mock">
          <figcaption className="label"><strong>A · Still first</strong> The film&rsquo;s own frame opens the page. 76% of films have one.</figcaption>
          <div className="frame">
            {film.backdrop_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="still" src={film.backdrop_url} alt="" />
            ) : <div className="still stillEmpty" />}
            <div className="stillBody">
              <div className="stillPoster"><Poster title={film.title} year={film.year} directors={[directors]} src={film.poster_url} sizes="180px" priority /></div>
              <div>
                <h2 className="titleMid">{film.title}</h2>
                <p className="facts">{facts.join(" · ")}</p>
                {win && <p className="honour"><Icon name="laurel" /> {win.category || win.award}, {win.year}</p>}
                <div className="actions"><span className="cta">Trailer</span><span className="ghost">Watchlist</span></div>
              </div>
            </div>
            <p className="blurb">{blurb}</p>
          </div>
        </figure>

        {/* B — the colour taken from the poster becomes the page's own light. */}
        <figure className="mock">
          <figcaption className="label"><strong>B · Colour wash</strong> The colour already stored for every film, used as the page&rsquo;s light.</figcaption>
          <div className="frame wash">
            <div className="washTop">
              <div className="washPoster"><Poster title={film.title} year={film.year} directors={[directors]} src={film.poster_url} sizes="200px" priority /></div>
              <div>
                <h2 className="titleMid">{film.title}</h2>
                <p className="facts">{facts.join(" · ")}</p>
                {win && <p className="honour"><Icon name="laurel" /> {win.category || win.award}, {win.year}</p>}
                <div className="actions"><span className="cta">Trailer</span><span className="ghost">Watchlist</span></div>
              </div>
            </div>
            <p className="blurb">{blurb}</p>
          </div>
        </figure>

        {/* C — the title carries the page; everything else gets quieter. */}
        <figure className="mock">
          <figcaption className="label"><strong>C · Big type</strong> The title at full scale, the year as a quiet number. No new data needed.</figcaption>
          <div className="frame">
            <div className="typeTop">
              <p className="year">{film.year}</p>
              <h2 className="titleBig">{film.title}</h2>
              <p className="directedBy">Directed by <span>{directors}</span></p>
              {win && <p className="honour"><Icon name="laurel" /> {win.category || win.award}, {win.year}</p>}
            </div>
            <div className="typeBody">
              <div className="typePoster"><Poster title={film.title} year={film.year} directors={[directors]} src={film.poster_url} sizes="220px" priority /></div>
              <div>
                <div className="actions"><span className="cta">Trailer</span><span className="ghost">Watchlist</span></div>
                <p className="blurb">{blurb}</p>
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
