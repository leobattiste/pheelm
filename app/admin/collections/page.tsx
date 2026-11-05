import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createCollection } from "../actions";

export default async function AdminCollections() {
  const { db } = await requireAdmin();
  const { data } = await db.from("collections").select("id, slug, title, kind, featured, sort_order, collection_films(film_id)").order("sort_order");

  return (
    <>
      <div className="admin-head"><h1>Collections</h1></div>
      <form action={createCollection} className="fieldset form">
        <h2>New collection</h2>
        <div className="actions">
          <input className="search-input" name="title" placeholder="Title, e.g. Nollywood Classics" required aria-label="Title" />
          <button className="button" type="submit">Create</button>
        </div>
      </form>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Kind</th><th>Films</th><th>Featured</th><th>Order</th></tr></thead>
        <tbody>
          {(data ?? []).map((c: any) => (
            <tr key={c.id}>
              <td><Link href={`/admin/collections/${c.id}`}>{c.title}</Link></td>
              <td>{c.kind}</td>
              <td>{c.collection_films?.length ?? 0}</td>
              <td>{c.featured ? "★" : ""}</td>
              <td>{c.sort_order}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
