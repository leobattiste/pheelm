import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { MIN_FILMS } from "@/lib/community";
import { resolveReport, setListFlag } from "../actions";

/** Public member collections: staff picks, hiding, and reports from visitors. */
export default async function AdminCommunity() {
  const { db } = await requireAdmin();
  const [lists, reports] = await Promise.all([
    db.from("lists").select("id, title, user_id, hidden, staff_pick, created_at, list_films(count)").eq("is_public", true).order("created_at", { ascending: false }).limit(300),
    db.from("list_reports").select("id, list_id, reason, created_at, lists(title)").eq("resolved", false).order("created_at", { ascending: false }),
  ]);
  if (lists.error || reports.error) {
    return (
      <>
        <div className="admin-head"><h1>Community</h1></div>
        <p className="notice">To manage community collections, run <code>supabase/community.sql</code> in Supabase.</p>
      </>
    );
  }
  const rows = lists.data ?? [];
  const owners = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: people }, { data: counts }] = await Promise.all([
    db.from("member_profiles").select("id, handle").in("id", owners.length ? owners : ["00000000-0000-0000-0000-000000000000"]),
    db.from("list_save_counts").select("list_id, saves").in("list_id", rows.length ? rows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));
  const saves = new Map((counts ?? []).map((c) => [c.list_id, c.saves]));
  const flag = (id: string, field: "hidden" | "staff_pick", on: boolean, label: string) => (
    <form action={setListFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? "true" : "false"} />
      <button className="button ghost small" type="submit">{label}</button>
    </form>
  );

  return (
    <>
      <div className="admin-head"><h1>Community</h1></div>

      <section className="fieldset">
        <h2>Reports to review</h2>
        {reports.data?.length ? (
          <ul className="inbox">
            {reports.data.map((r) => (
              <li key={r.id}>
                <div className="inbox-head">
                  <Link href={`/c/${r.list_id}`}><strong>{(r.lists as unknown as { title: string } | null)?.title ?? "A collection"}</strong></Link>
                  <span className="muted">{new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="inbox-body">{r.reason}</p>
                <div className="actions">
                  {flag(r.list_id, "hidden", true, "Hide the collection")}
                  <form action={resolveReport}><input type="hidden" name="id" value={r.id} /><button className="button ghost small" type="submit">Dismiss</button></form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No reports.</p>
        )}
      </section>

      <p className="muted">
        Public collections appear in the community once they have a title, at least {MIN_FILMS} films and their maker has a public name.
        Staff picks lead the list and get a badge. Hidden collections disappear for everyone but their maker.
      </p>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Collection</th><th>By</th><th>Films</th><th>Saves</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const films = (r.list_films as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <tr key={r.id} className={r.hidden ? "is-hidden" : undefined}>
                  <td>
                    <Link href={`/c/${r.id}`}>{r.title}</Link>
                    {r.staff_pick && <span className="staff-pick">Staff pick</span>}
                    {r.hidden && <span className="status-pill">Hidden</span>}
                  </td>
                  <td>{handle.get(r.user_id) ? `@${handle.get(r.user_id)}` : <span className="muted">No public name</span>}</td>
                  <td>{films}</td>
                  <td>{saves.get(r.id) ?? 0}</td>
                  <td>
                    <div className="actions">
                      {flag(r.id, "staff_pick", !r.staff_pick, r.staff_pick ? "Remove staff pick" : "Staff pick")}
                      {flag(r.id, "hidden", !r.hidden, r.hidden ? "Show" : "Hide")}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
