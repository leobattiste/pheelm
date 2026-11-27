import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
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
    </>
  );
}
