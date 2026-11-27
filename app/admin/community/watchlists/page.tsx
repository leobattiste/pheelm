import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { watchlistPath } from "@/lib/watchlist-links";
import { DataTable, MainCell, Num, Thumb } from "../../DataTable";
import AdminBrowserToolbar from "../../AdminBrowserToolbar";
import ConfirmButton from "../../ConfirmButton";
import SubmitButton from "../../SubmitButton";
import { setListFlag } from "../../actions";
import AdminMenu from "../../AdminMenu";
import { Empty, PageHeader, Pager, Pill, day, pageNumber, plural } from "../../ui";
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
  let listQuery = db.from("lists").select("id, slug, title, user_id, hidden, staff_pick, featured, created_at, list_films(count)", { count: "exact" })
    .eq("is_public", true).order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  if (q) listQuery = listQuery.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  if (filter !== "all") listQuery = listQuery.eq(filter, true);
  const [lists, listReports, commentReports] = await Promise.all([listQuery,
    db.from("list_reports").select("id", { count: "exact", head: true }).eq("resolved", false),
    db.from("comment_reports").select("id", { count: "exact", head: true }).eq("resolved", false)]);
  const reports = { count: (listReports.count ?? 0) + (commentReports.count ?? 0) };
  if (lists.error) return <><PageHeader title="Watchlists" /><p className="notice error">Watchlists couldn&apos;t load. Try again in a moment.</p></>;
  const rows = lists.data ?? [];
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
      <SubmitButton className="admin-menu-action" pendingLabel="Saving…">{label}</SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader title="Watchlists" description="Members’ public watchlists. Staff picks and featured ones show first."
        actions={<>
          <AdminMenu><Link href="/admin/community/comments">All comments</Link></AdminMenu>
          <Link className={reports.count ? "button" : "button ghost"} href="/admin/community">{reports.count ? `Review ${reports.count} ${reports.count === 1 ? "report" : "reports"}` : "Reports"}</Link>
        </>} />
      <AdminBrowserToolbar action="/admin/community/watchlists" query={q} placeholder="Search watchlists" filters={[{ name: "filter", label: "Watchlists", value: filter, options: FILTERS }]} />
      <p className="muted">{plural(lists.count ?? 0, "matching watchlist")}.</p>
      <DataTable label="Watchlists" empty={<Empty title="No matching watchlists">Try another search or filter.</Empty>}
        columns={[
          { key: "list", label: "Watchlist" },
          { key: "films", label: "Films", align: "end", width: "72px" },
          { key: "saves", label: "Saves", align: "end", width: "72px" },
          { key: "status", label: "Status", phone: true, width: "130px" },
          { key: "created", label: "Created", width: "120px", wide: true },
        ]}
        rows={rows.map((r) => {
          const films = (r.list_films as unknown as { count: number }[])[0]?.count ?? 0;
          const by = handle.get(r.user_id);
          return {
            id: r.id,
            dim: r.hidden,
            cells: {
              list: <MainCell href={watchlistPath(r)} media={<Thumb name={r.title} />} title={r.title}
                detail={by ? `by @${by}` : "by a member"} phoneDetail={[by ? `@${by}` : null, plural(films, "film"), plural(saves.get(r.id) ?? 0, "save")].filter(Boolean).join(" · ")} />,
              films: <Num value={films} />,
              saves: <Num value={saves.get(r.id) ?? 0} />,
              status: r.hidden ? <Pill tone="danger">Hidden</Pill> : r.staff_pick ? <Pill tone="info">Staff pick</Pill> : r.featured ? <Pill tone="info">Featured</Pill> : <Pill>Public</Pill>,
              created: <span className="muted">{day(r.created_at)}</span>,
            },
            menu: (
              <AdminMenu label={`Actions for ${r.title}`}>
                <Link href={watchlistPath(r)}>Open on the site</Link>
                {flag(r.id, "staff_pick", !r.staff_pick, r.staff_pick ? "Remove staff pick" : "Make a staff pick")}
                {!r.staff_pick && flag(r.id, "featured", !r.featured, r.featured ? "Stop featuring" : "Feature")}
                {flag(r.id, "hidden", !r.hidden, r.hidden ? "Show again" : "Hide from everyone")}
                {owner && <form action={deleteWatchlist} className="admin-menu-danger"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><ConfirmButton className="admin-menu-action danger-text" confirm="Press again to delete for good">Delete…</ConfirmButton></form>}
              </AdminMenu>
            ),
          };
        })} />
      <Pager page={page} total={lists.count ?? 0} size={SIZE} href={(p) => `/admin/community/watchlists?${new URLSearchParams({ q, filter, page: String(p) })}`} />
    </>
  );
}
