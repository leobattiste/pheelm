import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, MIN_FILMS } from "@/lib/community";
import AdminBrowserToolbar from "../../AdminBrowserToolbar";
import ConfirmButton from "../../ConfirmButton";
import SubmitButton from "../../SubmitButton";
import { setListFlag } from "../../actions";
import AdminMenu from "../../AdminMenu";
import { Empty, PageHeader, Pager, pageNumber, plural } from "../../ui";
import { deleteWatchlist } from "../actions";

const SIZE = 40;
const FILTERS = [
  { value: "all", label: "All public watchlists" }, { value: "featured", label: "Featured" },
  { value: "staff_pick", label: "Staff picks" }, { value: "hidden", label: "Hidden" },
];

/** Members' public watchlists: pick them for the community page, hide them, or (owner) delete them. */
export default async function AdminWatchlists({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const { db, owner } = await requireAdmin("/admin/community/watchlists");
  const sp = await searchParams;
  const page = pageNumber(sp.page, 5000);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const filter = FILTERS.some((f) => f.value === sp.filter) ? sp.filter! : "all";
  let listQuery = db.from("lists").select("id, title, user_id, hidden, staff_pick, featured, created_at, list_films(count)", { count: "exact" })
    .eq("is_public", true).order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  if (q) listQuery = listQuery.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  if (filter !== "all") listQuery = listQuery.eq(filter, true);
  const [lists, publicCollections, listReports, commentReports] = await Promise.all([listQuery, getCommunityCollections(),
    db.from("list_reports").select("id", { count: "exact", head: true }).eq("resolved", false),
    db.from("comment_reports").select("id", { count: "exact", head: true }).eq("resolved", false)]);
  const reports = { count: (listReports.count ?? 0) + (commentReports.count ?? 0) };
  if (lists.error) return <><PageHeader title="Watchlists" /><p className="notice error">Watchlists couldn&apos;t load. Try again in a moment.</p></>;
  const rows = lists.data ?? [];
  const tiles = new Map(publicCollections.map((c) => [c.id, c]));
  const owners = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: people }, { data: counts }] = await Promise.all([
    owners.length ? db.from("member_profiles").select("id, handle").in("id", owners) : Promise.resolve({ data: [] as { id: string; handle: string }[] }),
    rows.length ? db.from("list_save_counts").select("list_id, saves").in("list_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] as { list_id: string; saves: number }[] }),
  ]);
  const handle = new Map((people ?? []).map((p) => [p.id, p.handle]));
  const saves = new Map((counts ?? []).map((c) => [c.list_id, c.saves]));
  const here = `/admin/community/watchlists?${new URLSearchParams({ q, filter, page: String(page) })}`;
  const flag = (id: string, field: "hidden" | "staff_pick" | "featured", on: boolean, label: string) => (
    <form action={setListFlag}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? "true" : "false"} /><input type="hidden" name="back" value={here} />
      <SubmitButton className="button ghost small" pendingLabel="Saving…">{label}</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader title="Watchlists" description="Public watchlists from members. Staff picks and featured ones show first; hidden ones disappear for everyone but their maker."
        actions={<>
          <AdminMenu><Link href="/admin/community/comments">All comments</Link></AdminMenu>
          <Link className={reports.count ? "button" : "button ghost"} href="/admin/community">{reports.count ? `Review ${reports.count} ${reports.count === 1 ? "report" : "reports"}` : "Reports"}</Link>
        </>} />
      <AdminBrowserToolbar action="/admin/community/watchlists" query={q} placeholder="Search watchlists" filters={[{ name: "filter", label: "Watchlists", value: filter, options: FILTERS }]} />
      <p className="muted">{plural(lists.count ?? 0, "matching watchlist")}.</p>
      {rows.length ? (
        <ul className="collection-list">
          {rows.map((r) => <CommunityTile key={r.id} c={tiles.get(r.id) ?? {
            id: r.id, title: r.title, description: null, films: [], staff_pick: r.staff_pick, featured: r.featured,
            created_at: r.created_at, updated_at: r.created_at, saves: saves.get(r.id) ?? 0, curators: 0,
            owner: handle.get(r.user_id) ? { id: r.user_id, handle: handle.get(r.user_id)!, display_name: null } : null,
          }} filmCount={(r.list_films as unknown as { count: number }[])[0]?.count ?? 0}
            badge={r.hidden ? "Hidden" : r.staff_pick ? "Staff pick" : r.featured ? "Featured" : undefined}
            footer={<div className="admin-card-controls"><span className="muted">{plural(saves.get(r.id) ?? 0, "save")}</span><div className="actions">
              {flag(r.id, "staff_pick", !r.staff_pick, r.staff_pick ? "Remove staff pick" : "Staff pick")}
              {!r.staff_pick && flag(r.id, "featured", !r.featured, r.featured ? "Unfeature" : "Feature")}
              {flag(r.id, "hidden", !r.hidden, r.hidden ? "Show" : "Hide")}
              {owner && <form action={deleteWatchlist}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><ConfirmButton confirm="Delete for good?">Delete</ConfirmButton></form>}
            </div></div>} />)}
        </ul>
      ) : <Empty title="No matching watchlists">Try another search or filter.</Empty>}
      <Pager page={page} total={lists.count ?? 0} size={SIZE} href={(p) => `/admin/community/watchlists?${new URLSearchParams({ q, filter, page: String(p) })}`} />
    </>
  );
}
