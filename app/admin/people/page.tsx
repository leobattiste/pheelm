import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { countryName } from "@/lib/format";

export default async function AdminPeople({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  let query = db.from("people").select("id, slug, name, country, bio, photo_url, credits(role)").order("name").limit(3000);
  if (sp.q) query = query.ilike("name", `%${sp.q}%`);
  const { data } = await query;
  const people = (data ?? [])
    .map((p: any) => ({ ...p, directed: (p.credits ?? []).filter((c: any) => c.role === "director").length, total: (p.credits ?? []).length }))
    .filter((p) => sp.all || sp.q || p.directed > 0);

  return (
    <>
      <div className="admin-head">
        <h1>{sp.all ? "Everyone" : "Directors"}</h1>
      </div>
      <p className="muted">People are added from each film&rsquo;s cast &amp; crew box. Edit bios, countries and portraits here.</p>
      <form className="actions" role="search">
        <input className="search-input" name="q" defaultValue={sp.q} placeholder="Search names" aria-label="Search names" />
        <button className="button ghost small" type="submit">Search</button>
        <Link className="button ghost small" href="/admin/people">Directors</Link>
        <Link className="button ghost small" href="/admin/people?all=1">Everyone</Link>
      </form>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Country</th><th>Films directed</th><th>Credits</th><th>Bio</th><th>Portrait</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/people/${p.id}`}>{p.name}</Link></td>
                <td>{p.country ? countryName(p.country) : ""}</td>
                <td>{p.directed || ""}</td>
                <td>{p.total}</td>
                <td>{p.bio ? "✓" : ""}</td>
                <td>{p.photo_url ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
