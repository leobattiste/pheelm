import Link from "next/link";
import DirectorCard from "@/components/DirectorCard";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";
import { setAdmin } from "../actions";
import { Empty, PageHeader, Pager, Pill, day, pageNumber, plural } from "../ui";

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

export default async function AdminMembers({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string; page?: string }> }) {
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
  const page = pageNumber(sp.page);
  const pageRows = filtered.slice((page - 1) * SIZE, page * SIZE);
  const { data: photos } = pageRows.length ? await db.from("profiles").select("id, avatar_url").in("id", pageRows.map((r) => r.id)) : { data: [] };
  const photoById = new Map((photos ?? []).map((p) => [p.id, p.avatar_url as string | null]));
  const href = (p: number) => `/admin/members?${new URLSearchParams({ q, segment, page: String(p) })}`;
  const joined = rows.filter((r) => new Date(r.created_at).getTime() >= week).length;
  const suspended = rows.filter((r) => r.suspended_at).length;

  return (
    <>
      <PageHeader title="Members"
        description={`${plural(rows.length, "member")}, ${plural(rows.filter((r) => r.is_admin).length, "admin")}, ${joined} joined this week${suspended ? `, ${suspended} suspended` : ""}.`} />
      <AdminBrowserToolbar action="/admin/members" query={sp.q ?? ""} placeholder={owner ? "Search handle, name or email" : "Search handle or name"} filters={[
        { name: "segment", label: "Members", value: segment, options: SEGMENTS },
      ]} />
      <p className="muted">{plural(filtered.length, "matching member")}.{owner ? "" : " Only the owner can change admin roles or see email addresses."}</p>
      {pageRows.length ? (
        <ul className="director-grid admin-member-grid">
          {pageRows.map((r) => (
            <DirectorCard key={r.id} href={`/admin/members/${r.id}`} showPreviews={false} director={{
              id: r.id, slug: r.id, name: r.display_name || (r.handle ? `@${r.handle}` : "No profile yet"),
              country: null, photo_url: photoById.get(r.id) ?? null, films: 0, first: 0, last: 0, previews: [],
            }} meta={r.handle ? `@${r.handle}` : "Member"} footer={
              <div className="admin-card-controls">
                <div className="admin-tags">
                  {r.is_owner ? <Pill tone="info">Owner</Pill> : r.is_admin ? <Pill tone="info">Admin</Pill> : <Pill>Member</Pill>}
                  {r.suspended_at && <Pill tone="danger">Suspended</Pill>}
                  {r.is_private && <Pill>Private</Pill>}
                </div>
                {owner && r.email && <p className="muted">{r.email}</p>}
                <dl className="admin-member-stats"><div><dt>Watchlists</dt><dd>{r.lists}</dd></div><div><dt>Saved</dt><dd>{r.saved}</dd></div><div><dt>Comments</dt><dd>{r.comments}</dd></div></dl>
                <p className="muted">Joined {day(r.created_at)}<br />Last signed in {day(r.last_seen)}</p>
                <div className="actions">
                  <Link className="link-button" href={`/admin/members/${r.id}`}>View member</Link>
                  {owner && !r.is_owner && <form action={setAdmin}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="make" value={r.is_admin ? "false" : "true"} /><button className="button ghost small" type="submit">{r.is_admin ? "Remove admin" : "Make admin"}</button></form>}
                </div>
              </div>
            } />
          ))}
        </ul>
      ) : <Empty title="No matching members">Try another search or filter.</Empty>}
      <Pager page={page} total={filtered.length} size={SIZE} href={href} />
    </>
  );
}
