import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import PersonEditor from "./PersonEditor";

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
      <div className="admin-head">
        <h1>{person.name}</h1>
        <div className="actions">
          <Link className="button ghost small" href={`/${directs ? "directors" : "people"}/${person.slug}`}>View on site</Link>
        </div>
      </div>
      <PersonEditor person={person} />
      <section className="fieldset">
        <h2>Credits</h2>
        <ul>
          {(credits ?? []).map((c: any, i) => (
            <li key={i}>
              <Link href={`/admin/films/${c.films?.id}`}>{c.films?.title}</Link> ({c.films?.year}) · {c.role}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
