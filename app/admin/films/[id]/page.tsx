import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { tmdbEnabled } from "@/lib/tmdb";
import FilmEditor from "./FilmEditor";

export default async function EditFilm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, owner } = await requireAdmin(`/admin/films/${id}`);
  const [{ data: film }, { data: credits }, { data: collections }, { data: chosen }] = await Promise.all([
    db.from("films").select("*").eq("id", id).maybeSingle(),
    db.from("credits").select("role, character, sort, people(name)").eq("film_id", id).order("sort"),
    db.from("collections").select("id, title").order("sort_order"),
    db.from("collection_films").select("collection_id").eq("film_id", id),
  ]);
  if (!film) notFound();

  const creditText = (credits ?? [])
    .map((c: any) => `${c.role}: ${c.people?.name}${c.character ? ` as ${c.character}` : ""}`)
    .join("\n");

  return (
    <>
      <div className="admin-head">
        <h2 className="admin-section-heading">{film.title}</h2>
        <div className="actions">
          {film.status === "published" && <Link className="button ghost small" href={`/films/${film.slug}`}>View on site</Link>}
          <Link className="button ghost small" href="/admin/films">All films</Link>
        </div>
      </div>
      <FilmEditor
        canDelete={owner}
        key={`${film.tmdb_id ?? ""}|${(credits ?? []).length}`}
        film={film}
        creditText={creditText}
        collections={collections ?? []}
        chosen={(chosen ?? []).map((c) => c.collection_id)}
        tmdbEnabled={tmdbEnabled}
      />
    </>
  );
}
