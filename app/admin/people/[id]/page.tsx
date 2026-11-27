import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { History } from "../../History";
import type { Change } from "@/lib/changes";
import PersonEditor from "./PersonEditor";
import { DataTable, MainCell } from "../../DataTable";
import { PageHeader, Panel } from "../../ui";

export default async function EditPerson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin(`/admin/people/${id}`);
  const [{ data: person }, { data: credits }] = await Promise.all([
    db.from("people").select("*").eq("id", id).maybeSingle(),
    db.from("credits").select("role, films(id, title, year)").eq("person_id", id),
  ]);
  const history = await recentHistory(db, "person", id);
  if (!person) notFound();
  const directs = (credits ?? []).some((c) => c.role === "director");

  return (
    <>
      <PageHeader back={{ href: "/admin/people", label: "Directors" }} title={person.name}
        description={`${(credits ?? []).length} ${(credits ?? []).length === 1 ? "credit" : "credits"}${directs ? ", directs" : ""}`}
        actions={<Link className="button ghost small" href={`/${directs ? "directors" : "people"}/${person.slug}`}>View on site</Link>} />
      <PersonEditor person={person} />
      <Panel title="Credits" icon="film">
        <DataTable label="Credits" empty={<p className="muted">No film credits.</p>}
          columns={[{ key: "film", label: "Film" }, { key: "role", label: "Role", phone: true, width: "160px" }]}
          rows={(credits ?? []).map((c: any, i: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: `${c.films?.id}-${c.role}-${i}`,
            cells: {
              film: <MainCell href={`/admin/films/${c.films?.id}`} title={c.films?.title ?? "Untitled"} detail={c.films?.year ? String(c.films.year) : undefined} />,
              role: <span className="muted">{c.role === "cast" ? "Actor" : c.role[0].toUpperCase() + c.role.slice(1)}</span>,
            },
          }))} />
      </Panel>
      <Panel title="History" icon="clock" actions={<Link className="link-button" href="/admin/activity?type=person">All activity</Link>}>
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
