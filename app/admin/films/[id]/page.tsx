import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { tmdbEnabled } from "@/lib/tmdb";
import FilmEditor from "./FilmEditor";
import { PageHeader, Pill, ago } from "../../ui";

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
      <PageHeader back={{ href: "/admin/films", label: "Films" }} title={film.title}
        description={<span className="admin-head-meta">
          {film.status === "published" ? <Pill tone="ok">Published</Pill> : <Pill tone="warn">Draft</Pill>}
          <span>{film.year}</span>
          {film.updated_at && <span>Updated {ago(film.updated_at, false)}</span>}
        </span>}
        actions={film.status === "published" ? <Link className="button ghost small" href={`/films/${film.slug}`}>View on site</Link> : undefined} />
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
