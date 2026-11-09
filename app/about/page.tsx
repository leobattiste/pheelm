import type { Metadata } from "next";
import Link from "next/link";
import { getDirectors, getFacets, getFilms } from "@/lib/data";
import { SITE_NAME, PAGE_COPY } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "About",
  description: PAGE_COPY.about,
};

export default async function AboutPage() {
  const [films, directors, facets] = await Promise.all([getFilms(), getDirectors(), getFacets()]);
  return (
    <article className="page full-width info-page">
      <header className="page-head">
        <h1>About {SITE_NAME}</h1>
        <p className="lead">{PAGE_COPY.about}</p>
      </header>

      <div className="prose">
        <p>
          {SITE_NAME} brings together films by Black directors from {facets.countries.length} countries in one place:
          features, documentaries, shorts and animation, each with its cast and crew, awards, trailer and where to watch it.
        </p>

        <h2>What&rsquo;s in it</h2>
        <p>
          Films directed or co-directed by Black filmmakers, from anywhere in the world and any era. We look for films that matter: landmarks,
          festival winners, the ones critics and audiences return to, and the ones that deserve to be better known.
        </p>
        <p>
          The directory is curated, not complete. If a film you love is missing, <Link href="/submit">suggest it</Link>. Every suggestion is reviewed
          before it&rsquo;s added.
        </p>

        <h2>How it&rsquo;s organised</h2>
        <p>
          <Link href="/films">Films</Link> can be searched and filtered by type, decade, country, language and genre.{" "}
          <Link href="/directors">Directors</Link> have their own profiles, with their biography and every film of theirs here.{" "}
          <Link href="/collections">Collections</Link> group films by movement, theme, country and form.
        </p>
        <p>With a free account you can keep a watchlist, make your own collections and follow directors to hear when their new films are added.</p>

        <h2>Where the information comes from</h2>
        <p>
          Film details, posters, cast and crew come from <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">TMDB</a>, and
          streaming information from JustWatch through TMDB. {SITE_NAME} uses the TMDB API but is not endorsed or certified by TMDB. Awards and
          collections are put together by us. Posters and stills belong to their filmmakers and distributors.
        </p>
        <p>
          Spotted a mistake? <Link href="/contact">Tell us</Link> and we&rsquo;ll fix it.
        </p>

        <h2>Work with us</h2>
        <p>
          Festivals, distributors, streaming services, schools and film societies can <Link href="/partnerships">partner with {SITE_NAME}</Link>.
          For anything else, <Link href="/contact">get in touch</Link>.
        </p>
      </div>
    </article>
  );
}
