import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import { getArticle, getArticles, toCard } from "@/lib/data";
import { readingTime, renderMarkdown } from "@/lib/markdown";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await getArticle((await params).slug);
  if (!found) return {};
  const { article } = found;
  return {
    title: article.title,
    description: article.dek ?? undefined,
    openGraph: article.cover_url ? { images: [article.cover_url], type: "article" } : { type: "article" },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await getArticle((await params).slug);
  if (!found) notFound();
  const { article, films } = found;

  return (
    <article className="page narrow article">
      <header className="page-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/journal">Journal</Link>
        </nav>
        <h1>{article.title}</h1>
        {article.dek && <p className="lead">{article.dek}</p>}
        <p className="muted">
          {article.author && <>By {article.author} · </>}
          {article.published_at && new Date(article.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}
          {readingTime(article.body)} min read
        </p>
      </header>
      {article.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="article-cover" src={article.cover_url} alt="" />
      )}
      <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }} />
      {films.length > 0 && (
        <section className="film-section">
          <h2>Films in this story</h2>
          <FilmGrid films={films.map(toCard)} />
        </section>
      )}
    </article>
  );
}
