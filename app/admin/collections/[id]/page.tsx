import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import CollectionEditor from "./CollectionEditor";

export default async function EditCollection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin(`/admin/collections/${id}`);
  const [{ data: collection }, { data: films }, { data: chosen }] = await Promise.all([
    db.from("collections").select("*").eq("id", id).maybeSingle(),
    db.from("films").select("id, title, year").order("title").limit(5000),
    db.from("collection_films").select("film_id").eq("collection_id", id),
  ]);
  if (!collection) notFound();
  return (
    <>
      <div className="admin-head">
        <h1>{collection.title}</h1>
        <Link className="button ghost small" href={`/collections/${collection.slug}`}>View on site</Link>
      </div>
      <CollectionEditor collection={collection} films={films ?? []} chosen={(chosen ?? []).map((c) => c.film_id)} />
    </>
  );
}
