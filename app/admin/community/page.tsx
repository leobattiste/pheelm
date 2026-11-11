import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import CommunityTile from "@/components/CommunityTile";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { getCommunityCollections, MIN_FILMS } from "@/lib/community";
import { removeReportedComment, resolveCommentReport, resolveReport, setListFlag } from "../actions";

/** Public member collections: staff picks, hiding, and reports from visitors. */
export default async function AdminCommunity({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Math.min(5000, Number.parseInt(sp.page ?? "1", 10) || 1));
  const q = (sp.q ?? "").trim().slice(0, 100);
  const filter = ["hidden", "featured", "staff_pick"].includes(sp.filter ?? "") ? sp.filter! : "all";
  let listQuery = db.from("lists").select("id, title, user_id, hidden, staff_pick, featured, created_at, list_films(count)", { count: "exact" })
    .eq("is_public", true).order("created_at", { ascending: false }).range((page - 1) * 40, page * 40 - 1);
  if (q) listQuery = listQuery.ilike("title", `%${q}%`);
  if (filter !== "all") listQuery = listQuery.eq(filter, true);
  const [lists, reports, publicCollections] = await Promise.all([
    listQuery,
    db.from("list_reports").select("id, list_id, reason, created_at, lists(title)").eq("resolved", false).order("created_at", { ascending: false }),
    getCommunityCollections(),
  ]);
  if (lists.error || reports.error) {
    return (
      <>
        <div className="admin-head"><h2 className="admin-section-heading">Community</h2></div>
        <p className="notice">To manage community watchlists, run <code>supabase/community.sql</code> in Supabase.</p>
      </>
    );
  }
  const rows = lists.data ?? [];
  const tiles = new Map(publicCollections.map(c => [c.id, c]));
  const owners = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: people }, { data: counts }] = await Promise.all([
    db.from("member_profiles").select("id, handle").in("id", owners.length ? owners : ["00000000-0000-0000-0000-000000000000"]),
    db.from("list_save_counts").select("list_id, saves").in("list_id", rows.length ? rows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));
  // Reported comments (none until collaboration.sql has run).
  const commentReports = await db
    .from("comment_reports")
    .select("id, created_at, comment_id, list_comments(id, body, list_id, removed_at, lists(title))")
    .eq("resolved", false)
    .order("created_at", { ascending: false });
  type CR = { id: string; created_at: string; comment_id: string; list_comments: { id: string; body: string; list_id: string; removed_at: string | null; lists: { title: string } | null } | null };
  const reportedComments = ((commentReports.data ?? []) as unknown as CR[]).filter((r) => r.list_comments && !r.list_comments.removed_at);
  const saves = new Map((counts ?? []).map((c) => [c.list_id, c.saves]));
  const flag = (id: string, field: "hidden" | "staff_pick" | "featured", on: boolean, label: string) => (
    <form action={setListFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? "true" : "false"} />
      <button className="button ghost small" type="submit">{label}</button>
    </form>
  );

  return (
    <>
      <div className="admin-head"><h2 className="admin-section-heading">Community</h2></div>

      <section className="account-section">
        <h2>Reports to review</h2>
        {reports.data?.length ? (
          <ul className="inbox">
            {reports.data.map((r) => (
              <li key={r.id}>
                <div className="inbox-head">
                  <Link href={`/c/${r.list_id}`}><strong>{(r.lists as unknown as { title: string } | null)?.title ?? "A watchlist"}</strong></Link>
                  <span className="muted">{new Date(r.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="inbox-body">{r.reason}</p>
                <div className="actions">
                  {flag(r.list_id, "hidden", true, "Hide the watchlist")}
                  <form action={resolveReport}><input type="hidden" name="id" value={r.id} /><button className="button ghost small" type="submit">Dismiss</button></form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No reports.</p>
        )}
      </section>

      {!commentReports.error && (
        <section className="account-section">
          <h2>Reported comments</h2>
          {reportedComments.length ? (
            <ul className="inbox">
              {reportedComments.map((r) => (
                <li key={r.id}>
                  <div className="inbox-head">
                    <Link href={`/c/${r.list_comments!.list_id}#comment-${r.comment_id}`}><strong>On {r.list_comments!.lists?.title ?? "a watchlist"}</strong></Link>
                    <span className="muted">{new Date(r.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <p className="inbox-body">&ldquo;{r.list_comments!.body}&rdquo;</p>
                  <div className="actions">
                    <form action={removeReportedComment}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="comment_id" value={r.comment_id} /><button className="button ghost small danger-text" type="submit">Remove comment</button></form>
                    <form action={resolveCommentReport}><input type="hidden" name="id" value={r.id} /><button className="button ghost small" type="submit">Dismiss</button></form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No reported comments.</p>
          )}
        </section>
      )}

      <p className="muted">
        Public collections appear in the community once they have a title, at least {MIN_FILMS} films and their maker has a public name.
        Staff picks and featured collections show under Featured. Hidden collections disappear for everyone but their maker.
      </p>
      <AdminBrowserToolbar action="/admin/community" query={q} placeholder="Search watchlists" filters={[
        { name: "filter", label: "Watchlists", value: filter, options: [{ value: "all", label: "All watchlists" }, { value: "hidden", label: "Hidden" }, { value: "featured", label: "Featured" }, { value: "staff_pick", label: "Staff picks" }] },
      ]} />
      <p className="muted">{lists.count ?? 0} matching public collections.</p>
      <ul className="collection-list">
        {rows.map(r => <CommunityTile key={r.id} c={tiles.get(r.id) ?? {
          id: r.id, title: r.title, description: null, films: [], staff_pick: r.staff_pick, featured: r.featured,
          created_at: r.created_at, updated_at: r.created_at, saves: saves.get(r.id) ?? 0, curators: 0,
          owner: handle.get(r.user_id) ? { id: r.user_id, handle: handle.get(r.user_id)!, display_name: null } : null,
        }} filmCount={(r.list_films as unknown as { count: number }[])[0]?.count ?? 0}
          badge={r.hidden ? "Hidden" : r.staff_pick ? "Staff pick" : r.featured ? "Featured" : undefined}
          footer={<div className="admin-card-controls"><span className="muted">{saves.get(r.id) ?? 0} saves</span><div className="actions">
            {flag(r.id, "staff_pick", !r.staff_pick, r.staff_pick ? "Remove staff pick" : "Staff pick")}
            {!r.staff_pick && flag(r.id, "featured", !r.featured, r.featured ? "Unfeature" : "Feature")}
            {flag(r.id, "hidden", !r.hidden, r.hidden ? "Show" : "Hide")}
          </div></div>} />)}
      </ul>
      <div className="actions admin-pagination">
        {page > 1 && <Link className="button ghost small" href={`/admin/community?${new URLSearchParams({ q, filter, page: String(page - 1) })}`}>Previous</Link>}
        <span className="muted">Page {page} of {Math.max(1, Math.ceil((lists.count ?? 0) / 40))}</span>
        {page * 40 < (lists.count ?? 0) && <Link className="button ghost small" href={`/admin/community?${new URLSearchParams({ q, filter, page: String(page + 1) })}`}>Next</Link>}
      </div>
    </>
  );
}
