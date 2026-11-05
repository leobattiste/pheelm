import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import ArticleEditor from "./ArticleEditor";

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin(`/admin/journal/${id}`);
  const [{ data: article }, { data: films }] = await Promise.all([
    db.from("articles").select("*").eq("id", id).maybeSingle(),
    db.from("films").select("id, title, year").order("title").limit(5000),
  ]);
  if (!article) notFound();
  return (
    <>
      <div className="admin-head">
        <h1>{article.title}</h1>
        {article.status === "published" && <Link className="button ghost small" href={`/journal/${article.slug}`}>View on site</Link>}
      </div>
      <ArticleEditor article={article} films={films ?? []} />
    </>
  );
}
