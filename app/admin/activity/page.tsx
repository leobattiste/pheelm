import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Pager, Panel, ViewTabs, pageNumber, plural } from "../ui";
import { History } from "../History";
import type { Change } from "@/lib/changes";

const PAGE_SIZE = 50;
const TYPES: [string, string][] = [
  ["film", "Films"], ["person", "People"], ["member", "Members"], ["collection", "Watchlists"],
  ["comment", "Comments"], ["submission", "Submissions"], ["message", "Inbox"], ["subscriber", "Newsletter"], ["job", "Automation"],
];

/** Where a logged change can be looked at now. */
function targetHref(type: string, id: string | null) {
  if (!id) return undefined;
  switch (type) {
    case "film": return `/admin/films/${id}`;
    case "person": return `/admin/people/${id}`;
    case "member": return `/admin/members/${id}`;
    case "collection": return `/c/${id}`;
    case "message": return `/admin/inbox/message/${id}`;
    case "job": return "/admin/automation";
    default: return undefined;
  }
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const { db } = await requireAdmin("/admin/activity");
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const type = TYPES.some(([t]) => t === sp.type) ? sp.type! : "all";
  let query = db.from("admin_activity").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type !== "all") query = query.eq("target_type", type);
  const { data, count, error } = await query;
  const actors = [...new Set((data ?? []).map((a) => a.actor_id).filter((v): v is string => !!v))];
  const { data: profiles } = actors.length ? await db.from("member_profiles").select("id,handle").in("id", actors) : { data: [] as { id: string; handle: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.handle]));
  const who = (id: string | null) => !id ? "Deleted account" : names.get(id) ? `@${names.get(id)}` : "An admin";
  const href = (p: number) => `/admin/activity?type=${type}&page=${p}`;

  return (
    <>
      <PageHeader back={{ href: "/admin/settings", label: "Settings" }} title="Activity log" description={`Every change made in admin, newest first. ${plural(count ?? 0, "change")} recorded.`} />
      <ViewTabs label="Filter by kind" items={[
        { label: "Everything", href: "/admin/activity", active: type === "all" },
        ...TYPES.map(([t, label]) => ({ label, href: `/admin/activity?type=${t}`, active: type === t })),
      ]} />
      {error ? <p className="notice error">The activity log couldn&apos;t load. Try again in a moment.</p> : data?.length ? (
        <Panel>
          <History entries={data.map((a) => ({
            id: a.id, action: a.action, details: a.details, created_at: a.created_at, who: who(a.actor_id),
            href: targetHref(a.target_type, a.target_id), changes: (a.changes ?? null) as Change[] | null,
          }))} />
        </Panel>
      ) : <Empty title="No changes recorded">{type === "all" ? "Changes made in admin appear here." : "No changes of this kind yet."}</Empty>}
      <Pager page={page} total={count ?? 0} size={PAGE_SIZE} href={href} />
    </>
  );
}
