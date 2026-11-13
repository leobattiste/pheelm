import { requireAdmin } from "@/lib/admin";
import AdminBrowserToolbar from "../../AdminBrowserToolbar";
import ConfirmButton from "../../ConfirmButton";
import { Empty, PageHeader, Pager, Panel, Pill, Row, Stat, Stats, ViewTabs, day, pageNumber } from "../../ui";
import { removeSubscriber } from "../actions";

const PAGE_SIZE = 50;
const STATES = [
  { id: "confirmed", label: "Subscribed", tone: "ok", about: "Confirmed their email. These are the people the newsletter goes to." },
  { id: "pending", label: "Not confirmed", tone: "warn", about: "Signed up but haven't clicked the confirmation link yet." },
  { id: "unsubscribed", label: "Unsubscribed", tone: "neutral", about: "Left the list." },
  { id: "suppressed", label: "Bounced or blocked", tone: "danger", about: "Emails to them bounced or were marked as spam, so nothing is sent." },
] as const;
type Counts = Record<"total" | (typeof STATES)[number]["id"], number>;
type Subscriber = { email: string; source: string | null; created_at: string; state: string; confirmed_at: string | null; unsubscribed_at: string | null; total: number };

/** The newsletter list: numbers for every admin, and the addresses themselves for the owner. */
export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string; page?: string }> }) {
  const { db, owner } = await requireAdmin("/admin/inbox/newsletter");
  const sp = await searchParams;
  const state = STATES.find((s) => s.id === sp.state) ?? STATES[0];
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageNumber(sp.page, 2000);
  const { data: rawCounts, error: countError } = await db.rpc("admin_newsletter_counts");
  const counts = (rawCounts ?? {}) as Partial<Counts>;
  const list = owner && !countError
    ? await db.rpc("admin_newsletter", { search: q || null, only_state: state.id, page_size: PAGE_SIZE, page_offset: (page - 1) * PAGE_SIZE })
    : { data: [] as Subscriber[], error: null };
  const people = (list.data ?? []) as Subscriber[];
  const total = people[0]?.total ?? 0;
  const href = (p: number) => `/admin/inbox/newsletter?${new URLSearchParams({ state: state.id, ...(q ? { q } : {}), page: String(p) })}`;

  if (countError) {
    return <>
      <PageHeader back={{ href: "/admin/inbox", label: "Inbox" }} title="Newsletter" />
      <p className="notice error">The newsletter list couldn&apos;t load. If this keeps happening, run <code>supabase/admin-inbox.sql</code> in Supabase.</p>
    </>;
  }

  return (
    <>
      <PageHeader back={{ href: "/admin/inbox", label: "Inbox" }} title="Newsletter" description="Who signed up, and where they are. Only people who confirmed their email receive the newsletter."
        actions={owner && (counts.confirmed ?? 0) > 0 ? <a className="button ghost small" href="/admin/subscribers.csv" download>Download subscribers (CSV)</a> : null} />
      {owner ? (
        <>
          <ViewTabs label="Subscribers by status" items={STATES.map((s) => ({ label: s.label, href: `/admin/inbox/newsletter?state=${s.id}`, active: s === state, count: counts[s.id] ?? 0 }))} />
          <AdminBrowserToolbar action="/admin/inbox/newsletter" query={q} placeholder="Search email addresses" />
          <p className="muted">{state.about}</p>
          {list.error ? <p className="notice error">The list couldn&apos;t load. Try again in a moment.</p> : people.length ? (
            <Panel>
              {people.map((p) => (
                <Row key={p.email} detail={`Signed up ${day(p.created_at)}${p.source ? ` from ${p.source}` : ""}${p.confirmed_at ? ` · confirmed ${day(p.confirmed_at)}` : ""}${p.unsubscribed_at ? ` · left ${day(p.unsubscribed_at)}` : ""}`}
                  aside={<>
                    <Pill tone={STATES.find((s) => s.id === p.state)?.tone ?? "neutral"}>{STATES.find((s) => s.id === p.state)?.label ?? p.state}</Pill>
                    <form action={removeSubscriber}><input type="hidden" name="email" value={p.email} /><ConfirmButton confirm="Remove?">Remove</ConfirmButton></form>
                  </>}>{p.email}</Row>
              ))}
            </Panel>
          ) : <Empty title={q ? "No addresses match" : `No one is ${state.label.toLowerCase()}`} />}
          <Pager page={page} total={total} size={PAGE_SIZE} href={href} />
        </>
      ) : <>
        <Stats>{STATES.map((s) => <Stat key={s.id} value={counts[s.id] ?? 0} label={s.label} />)}</Stats>
        <p className="muted">Only the owner can see the email addresses on the list.</p>
      </>}
    </>
  );
}
