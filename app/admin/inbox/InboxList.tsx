import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { BOXES, STAGES, TOPIC_LABEL, type InboxBox } from "@/lib/inbox";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import AdminMenu from "../AdminMenu";
import { Empty, Flash, PageHeader, Pager, Panel, Pill, Row, ViewTabs, ago, pageNumber, plural } from "../ui";

const PAGE_SIZE = 30;
type Params = { view?: string; q?: string; page?: string; deleted?: string };
type Message = {
  id: string; name: string | null; email: string; organization: string | null; topic: string; status: string;
  stage: string | null; body: string; created_at: string; replied_at: string | null; due_at: string | null; page_title: string | null;
};

/** Days until a privacy request's deadline, as a label. */
function deadline(due: string) {
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return <Pill tone="danger">{plural(-days, "day")} overdue</Pill>;
  if (days === 0) return <Pill tone="danger">Due today</Pill>;
  return <Pill tone={days <= 7 ? "warn" : "neutral"}>Due in {plural(days, "day")}</Pill>;
}

/** Keeps a search to characters that are safe inside a filter. */
const searchable = (q: string) => q.replace(/[^\p{L}\p{N}@.\-_' ]/gu, " ").trim().slice(0, 80);

/** One box of the inbox (or all of them): its messages, split by where they stand, with search and paging. */
export default async function InboxList({ box, searchParams }: { box?: InboxBox; searchParams: Promise<Params> }) {
  const { db } = await requireAdmin(box ? `/admin/inbox/${box}` : "/admin/inbox");
  const sp = await searchParams;
  const info = BOXES.find((b) => b.id === box);
  const partnerships = box === "partnerships";
  const base = box ? `/admin/inbox/${box}` : "/admin/inbox";

  // Views: where messages stand. Partnerships follow their stage instead.
  const views: { id: string; label: string; apply: (q: any) => any }[] = partnerships // eslint-disable-line @typescript-eslint/no-explicit-any
    ? [...STAGES.map((s) => ({ id: s.id, label: s.label, apply: (q: any) => q.eq("stage", s.id).neq("status", "spam") })), // eslint-disable-line @typescript-eslint/no-explicit-any
      { id: "spam", label: "Spam", apply: (q: any) => q.eq("status", "spam") }] // eslint-disable-line @typescript-eslint/no-explicit-any
    : [
      { id: "open", label: "To answer", apply: (q: any) => q.in("status", ["new", "open"]) }, // eslint-disable-line @typescript-eslint/no-explicit-any
      { id: "done", label: "Done", apply: (q: any) => q.eq("status", "done") }, // eslint-disable-line @typescript-eslint/no-explicit-any
      { id: "spam", label: "Spam", apply: (q: any) => q.eq("status", "spam") }, // eslint-disable-line @typescript-eslint/no-explicit-any
    ];
  const view = views.find((v) => v.id === sp.view) ?? views[0];
  const q = searchable(sp.q ?? "");
  const page = pageNumber(sp.page, 2000);
  const scoped = (columns: string, opts?: { count: "exact"; head?: boolean }) => {
    let query = db.from("messages").select(columns, opts);
    if (info) query = query.in("topic", info.topics);
    return query;
  };

  let list = view.apply(scoped("id,name,email,organization,topic,status,stage,body,created_at,replied_at,due_at,page_title", { count: "exact" }));
  if (q) list = list.or(["name", "email", "organization", "body"].map((c) => `${c}.ilike.%${q}%`).join(","));
  list = info?.id === "press" && view.id === "open"
    ? list.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    : list.order("created_at", { ascending: false });
  const [{ data, count, error }, ...viewCounts] = await Promise.all([
    list.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...views.map((v) => v.apply(scoped("id", { count: "exact", head: true }))),
  ]);
  const messages = (data ?? []) as Message[];
  const href = (p: number) => `${base}?${new URLSearchParams({ view: view.id, ...(q ? { q } : {}), page: String(p) })}`;

  if (error) {
    return <>
      <PageHeader title={info?.label ?? "Inbox"} />
      <p className="notice error">The inbox couldn&apos;t load. If this keeps happening, run <code>supabase/admin-inbox.sql</code> in Supabase.</p>
    </>;
  }

  return (
    <>
      <PageHeader title="Inbox" description={info?.about ?? "Everything people send through the contact, feedback and partnership forms."} />
      <div className="admin-filter-row">
        <AdminMenu label="Which messages" align="left" text={info?.label ?? "All messages"}>
          <Link href="/admin/inbox" aria-current={!box ? "page" : undefined}>All messages</Link>
          {BOXES.map((b) => <Link key={b.id} href={`/admin/inbox/${b.id}`} aria-current={b.id === box ? "page" : undefined}>{b.label}</Link>)}
          <Link href="/admin/inbox/newsletter">Newsletter sign-ups</Link>
        </AdminMenu>
        <ViewTabs label="Messages by status" items={views.map((v, i) => ({
          label: v.label, href: `${base}?view=${v.id}`, active: v === view, count: viewCounts[i].count ?? 0,
        }))} />
      <Flash ok={sp.deleted ? "Message deleted." : null} />
        <AdminBrowserToolbar action={base} query={q} placeholder="Search messages" />
      </div>
      {messages.length ? (
        <Panel>
          {messages.map((m) => (
            <Row key={m.id} href={`/admin/inbox/message/${m.id}`}
              detail={[box && info && info.topics.length === 1 ? null : TOPIC_LABEL[m.topic] ?? m.topic, m.organization, m.body.replace(/\s+/g, " ").slice(0, 140)].filter(Boolean).join(" · ")}
              aside={<>
                {m.status === "new" && <Pill tone="info">New</Pill>}
                {m.replied_at && <Pill tone="ok">Replied</Pill>}
                {m.topic === "privacy" && m.due_at && m.status !== "done" && deadline(m.due_at)}
                {!partnerships && m.stage && m.stage !== "new" && <Pill>{STAGES.find((s) => s.id === m.stage)?.label}</Pill>}
                <span className="muted">{ago(m.created_at)}</span>
              </>}>
              {m.status === "new" ? <strong>{m.name || m.email}</strong> : m.name || m.email}
            </Row>
          ))}
        </Panel>
      ) : (
        <Empty title={q ? "No messages match your search" : view.id === "open" ? "You're all caught up" : `Nothing in ${view.label.toLowerCase()}`}>
          {q ? "Try a name, an email address or a word from the message." : view.id === "open" ? "New messages appear here as soon as they're sent." : null}
        </Empty>
      )}
      <Pager page={page} total={count ?? 0} size={PAGE_SIZE} href={href} />
    </>
  );
}
