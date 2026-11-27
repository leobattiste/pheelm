import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { History } from "../../History";
import type { Change } from "@/lib/changes";
import { tmdbEnabled } from "@/lib/tmdb";
import FilmEditor from "./FilmEditor";
import { PageHeader, Panel, Pill, ago } from "../../ui";

export default async function EditFilm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, owner } = await requireAdmin(`/admin/films/${id}`);
  const [{ data: film }, { data: credits }, { data: collections }, { data: chosen }] = await Promise.all([
    db.from("films").select("*").eq("id", id).maybeSingle(),
    db.from("credits").select("role, character, sort, people(name)").eq("film_id", id).order("sort"),
    db.from("collections").select("id, title").order("sort_order"),
    db.from("collection_films").select("collection_id").eq("film_id", id),
  ]);
  const history = await recentHistory(db, "film", id);
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
      <Panel title="History" icon="clock" actions={<Link className="link-button" href="/admin/activity?type=film">All activity</Link>}>
        {history.length ? <History entries={history} compact /> : <p className="muted">No changes recorded yet.</p>}
      </Panel>
    </>
  );
}

/** The last changes made to this record in admin, with who made them. */
async function recentHistory(db: Awaited<ReturnType<typeof requireAdmin>>["db"], type: string, id: string) {
  const { data } = await db.from("admin_activity").select("*").eq("target_type", type).eq("target_id", id).order("created_at", { ascending: false }).limit(8);
  const rows = (data ?? []) as { id: number; actor_id: string | null; action: string; details: string | null; created_at: string; changes?: Change[] | null }[];
  const actors = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
  const { data: people } = actors.length ? await db.from("member_profiles").select("id, handle").in("id", actors) : { data: [] as { id: string; handle: string | null }[] };
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));
  return rows.map((r) => ({
    id: r.id, action: r.action, details: r.details, created_at: r.created_at, changes: r.changes ?? null,
    who: !r.actor_id ? "Automation" : handle.get(r.actor_id) ? `@${handle.get(r.actor_id)}` : "An admin",
  }));
}
