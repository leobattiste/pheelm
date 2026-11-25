import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { filmPageCatalog, getFilms } from "@/lib/data";
import { filmPath } from "@/lib/film-links";
import { filmMetadata, type Params } from "./FilmPageView";

export const revalidate = 3600; // admin saves refresh it right away
export const dynamicParams = true;

/**
 * Every published film page is built at deploy time. The build reads the catalogue once and shares
 * it across all of them, so it costs CPU, not database reads; a visitor never waits for a page to be
 * built. A film added after the deploy is built the first time someone opens it, then kept.
 */
export async function generateStaticParams() {
  return (await getFilms()).map((f) => ({ slug: f.slug }));
}

export const generateMetadata = (props: Params): Promise<Metadata> => filmMetadata(props);

/** /films/<film> is the short form: it goes to /films/<film>/by/<director>. */
export default async function FilmRedirect({ params }: Params) {
  const { film } = await filmPageCatalog((await params).slug);
  if (!film) notFound();
  permanentRedirect(filmPath(film.slug, film.directors));
}
