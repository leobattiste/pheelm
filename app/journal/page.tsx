import type { Metadata } from "next";
import Link from "next/link";
import { getArticles } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Journal",
  description: "Interviews, essays and the stories behind films by Black directors.",
};

const KIND_LABELS: Record<string, string> = { essay: "Essay", interview: "Interview", history: "History", story: "Behind the film", news: "News" };

export default async function JournalPage() {
  const articles = await getArticles();
  return (
    <section className="page narrow">
      <header className="page-head">
        <h1>Journal</h1>
        <p className="lead">Interviews, essays and the stories behind the films.</p>
      </header>
      {articles.length ? (
        <ul className="article-list">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/journal/${a.slug}`}>
                {a.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover_url} alt="" loading="lazy" />
                )}
                <span className="label">
                  {KIND_LABELS[a.kind]}
                  {a.published_at && `, ${new Date(a.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
                </span>
                <span className="article-title">{a.title}</span>
                {a.dek && <span className="article-dek">{a.dek}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">The first stories are on their way. Until then, <a href="/collections">browse the collections</a>.</p>
      )}
    </section>
  );
}
