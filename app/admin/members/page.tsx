import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Pager, Pill, ago, day, pageNumber, plural } from "../ui";
import { DataTable, MainCell, Num, Thumb } from "../DataTable";

export type MemberRow = {
  id: string; handle: string | null; display_name: string | null; email: string | null; created_at: string; last_seen: string | null;
  is_admin: boolean; is_owner: boolean; is_private: boolean; lists: number; saved: number; comments: number;
  suspended_at?: string | null; suspended_reason?: string | null;
};
const SIZE = 40;
const SEGMENTS = [
  { value: "all", label: "Everyone" }, { value: "admins", label: "Admins" }, { value: "new", label: "Joined this week" },
  { value: "active", label: "Signed in this month" }, { value: "inactive", label: "Not signed in this month" }, { value: "suspended", label: "Suspended" },
];

const SORTS: { value: string; label: string; by: (a: MemberRow, b: MemberRow) => number }[] = [
  { value: "newest", label: "Newest members", by: (a, b) => time(b.created_at) - time(a.created_at) },
  { value: "oldest", label: "Oldest members", by: (a, b) => time(a.created_at) - time(b.created_at) },
  { value: "lists-most", label: "Most watchlists", by: (a, b) => b.lists - a.lists },
  { value: "lists-least", label: "Fewest watchlists", by: (a, b) => a.lists - b.lists },
  { value: "saved-most", label: "Most films saved", by: (a, b) => b.saved - a.saved },
  { value: "saved-least", label: "Fewest films saved", by: (a, b) => a.saved - b.saved },
  { value: "comments-most", label: "Most comments", by: (a, b) => b.comments - a.comments },
  { value: "comments-least", label: "Fewest comments", by: (a, b) => a.comments - b.comments },
  { value: "seen-recent", label: "Signed in most recently", by: (a, b) => time(b.last_seen) - time(a.last_seen) },
  { value: "seen-oldest", label: "Signed in longest ago", by: (a, b) => time(a.last_seen) - time(b.last_seen) },
  { value: "name", label: "Name A to Z", by: (a, b) => label(a).localeCompare(label(b)) },
];
const time = (d: string | null) => (d ? new Date(d).getTime() : 0);
const label = (r: MemberRow) => (r.display_name || r.handle || "").toLowerCase();

export default async function AdminMembers({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string; sort?: string; page?: string }> }) {
  const { db, owner } = await requireAdmin("/admin/members");
  const { data, error } = await db.rpc("admin_members");
  if (error) return <><PageHeader title="Members" /><p className="notice error">Members couldn&apos;t load. Try again in a moment.</p></>;
  const rows = (data ?? []) as MemberRow[];
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);
  const segment = SEGMENTS.some((s) => s.value === sp.segment) ? sp.segment! : "all";
  const week = Date.now() - 7 * 86400000;
  const month = Date.now() - 30 * 86400000;
  const seen = (r: MemberRow) => (r.last_seen ? new Date(r.last_seen).getTime() : 0);
  const filtered = rows.filter((r) => {
    const matches = !q || [r.handle, r.display_name, ...(owner ? [r.email] : [])].some((x) => x?.toLowerCase().includes(q));
    const inSegment = segment === "all" || (segment === "admins" && r.is_admin) || (segment === "new" && new Date(r.created_at).getTime() >= week)
      || (segment === "active" && seen(r) >= month) || (segment === "inactive" && seen(r) < month) || (segment === "suspended" && !!r.suspended_at);
    return matches && inSegment;
  });
  const sort = SORTS.find((o) => o.value === sp.sort) ?? SORTS[0];
  filtered.sort(sort.by);
  const page = pageNumber(sp.page);
  const pageRows = filtered.slice((page - 1) * SIZE, page * SIZE);
  const { data: photos } = pageRows.length ? await db.from("profiles").select("id, avatar_url").in("id", pageRows.map((r) => r.id)) : { data: [] };
  const photoById = new Map((photos ?? []).map((p) => [p.id, p.avatar_url as string | null]));
  const href = (p: number) => `/admin/members?${new URLSearchParams({ q, segment, sort: sort.value, page: String(p) })}`;
  const joined = rows.filter((r) => new Date(r.created_at).getTime() >= week).length;
  const suspended = rows.filter((r) => r.suspended_at).length;

  return (
    <>
      <PageHeader title="Members"
        description={`${plural(rows.length, "member")}, ${plural(rows.filter((r) => r.is_admin).length, "admin")}, ${joined} joined this week${suspended ? `, ${suspended} suspended` : ""}.`} />
      <AdminBrowserToolbar action="/admin/members" query={sp.q ?? ""} placeholder={owner ? "Search handle, name or email" : "Search handle or name"} filters={[
        { name: "segment", label: "Members", value: segment, options: SEGMENTS },
        { name: "sort", label: "Sort by", value: sort.value, options: SORTS.map(({ value, label }) => ({ value, label })) },
      ]} />
      <p className="muted">{plural(filtered.length, "matching member")}.{owner ? "" : " Only the owner can see email addresses."}</p>
      <DataTable label="Members" empty={<Empty title="No matching members">Try another search or filter.</Empty>}
        columns={[
          { key: "member", label: "Member" },
          ...(owner ? [{ key: "email", label: "Email", width: "220px" }] : []),
          { key: "role", label: "Role", phone: true, width: "130px" },
          { key: "lists", label: "Watchlists", align: "end" as const, width: "96px" },
          { key: "saved", label: "Saved", align: "end" as const, width: "72px", wide: true },
          { key: "comments", label: "Comments", align: "end" as const, width: "96px", wide: true },
          { key: "joined", label: "Joined", width: "120px", wide: true },
          { key: "seen", label: "Last seen", width: "120px" },
        ]}
        rows={pageRows.map((r) => {
          const name = r.display_name || (r.handle ? `@${r.handle}` : "No profile yet");
          return {
            id: r.id,
            dim: !!r.suspended_at,
            cells: {
              member: <MainCell href={`/admin/members/${r.id}`} media={<Thumb src={photoById.get(r.id) ?? null} name={name} shape="round" />} title={name}
                detail={r.handle && r.display_name ? `@${r.handle}` : r.handle ? "No display name" : "Hasn't set up a profile"}
                phoneDetail={[r.handle && r.display_name ? `@${r.handle}` : null, `joined ${day(r.created_at)}`].filter(Boolean).join(" · ")} />,
              email: owner && r.email ? <span className="admin-cell-email">{r.email}</span> : null,
              role: <span className="admin-tags">
                {r.suspended_at ? <Pill tone="danger">Suspended</Pill> : r.is_owner ? <Pill tone="info">Owner</Pill> : r.is_admin ? <Pill tone="info">Admin</Pill> : <Pill>Member</Pill>}
                {r.is_private && <Pill>Private</Pill>}
              </span>,
              lists: <Num value={r.lists} />,
              saved: <Num value={r.saved} />,
              comments: <Num value={r.comments} />,
              joined: <span className="muted">{day(r.created_at)}</span>,
              seen: <span className="muted">{r.last_seen ? ago(r.last_seen) : "Never"}</span>,
            },
          };
        })} />
      <Pager page={page} total={filtered.length} size={SIZE} href={href} />
    </>
  );
}
