import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createArticle } from "../actions";

export default async function AdminJournal() {
  const { db } = await requireAdmin();
  const { data } = await db.from("articles").select("id, slug, title, kind, status, published_at, updated_at").order("updated_at", { ascending: false });

  return (
    <>
      <div className="admin-head"><h1>Journal</h1></div>
      <form action={createArticle} className="fieldset form">
        <h2>New story</h2>
        <div className="actions">
          <input className="search-input" name="title" placeholder="Headline" required aria-label="Headline" />
          <button className="button" type="submit">Start writing</button>
        </div>
      </form>
      {data?.length ? (
        <table className="admin-table">
          <thead><tr><th>Title</th><th>Kind</th><th>Status</th><th>Published</th></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/admin/journal/${a.id}`}>{a.title}</Link></td>
                <td>{a.kind}</td>
                <td><span className={`status-pill ${a.status}`}>{a.status}</span></td>
                <td>{a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">No stories yet. The Journal page shows a &ldquo;coming soon&rdquo; note until the first one is published.</p>
      )}
    </>
  );
}
