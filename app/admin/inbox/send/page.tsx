import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Panel, Pill, Row, dayTime } from "../../ui";
import SendForm from "./SendForm";
import { AUDIENCES, KINDS, type Campaign, type Targets } from "./shared";

export const dynamic = "force-dynamic";

const n = (value: number) => value.toLocaleString("en-US");

function audienceText(c: Campaign) {
  if (c.audience === "subscribers") return "Newsletter subscribers";
  const label = AUDIENCES.find((a) => a.id === c.audience)?.label ?? c.audience;
  if (c.audience === "members") return label;
  if (c.audience === "member") return c.audience_label ?? "One member";
  return `${label}: ${c.audience_label ?? "removed"}`;
}

/** What happened to a send: in-app read, and emails waiting, delivered, bounced or failed. */
function outcome(c: Campaign) {
  const parts: string[] = [];
  if (c.channels.includes("in_app")) parts.push(`${n(c.in_app)} in-app, ${n(c.in_app_read)} read`);
  if (c.channels.includes("email")) {
    const email = [`${n(c.emails)} ${c.emails === 1 ? "email" : "emails"}`];
    if (c.queued) email.push(`${n(c.queued)} waiting`);
    if (c.delivered) email.push(`${n(c.delivered)} delivered`);
    const unconfirmed = c.sent - c.delivered - c.bounced;
    if (unconfirmed > 0) email.push(`${n(unconfirmed)} sent`);
    if (c.bounced) email.push(`${n(c.bounced)} bounced`);
    if (c.failed) email.push(`${n(c.failed)} failed`);
    if (c.skipped) email.push(`${n(c.skipped)} skipped`);
    parts.push(email.join(", "));
  }
  return parts.join(" · ");
}

/** Admin → Send: announcements, service notices and newsletters, by in-app notification, email or both. */
export default async function SendPage() {
  const { db, owner } = await requireAdmin("/admin/inbox/send");
  const [targets, history] = await Promise.all([db.rpc("admin_campaign_targets"), db.rpc("admin_campaigns", { p_limit: 30 })]);
  if (targets.error) {
    return <>
      <PageHeader back={{ href: "/admin/inbox", label: "Inbox" }} title="Send" />
      <p className="notice error">Send couldn&apos;t load. Try again in a moment.</p>
    </>;
  }
  const sent = (history.data ?? []) as Campaign[];
  return (
    <>
      <PageHeader back={{ href: "/admin/inbox", label: "Inbox" }} title="Send"
        description="Write to members or newsletter subscribers by in-app notification, email or both. Send yourself a test first. Emails go out 20 every 5 minutes." />
      <Panel title="New message"><SendForm targets={targets.data as Targets} owner={owner} /></Panel>
      <Panel title="Sent">
        {history.error ? <p className="notice error">What was sent couldn&apos;t load.</p> : sent.length ? sent.map((c) => (
          <Row key={c.id} detail={<>{dayTime(c.created_at)}{c.sender ? ` by ${c.sender}` : ""} · {audienceText(c)}<br />{outcome(c)}</>}
            aside={<Pill tone={c.kind === "service" ? "warn" : c.kind === "newsletter" ? "info" : "neutral"}>{KINDS.find((k) => k.id === c.kind)?.label ?? c.kind}</Pill>}>
            {c.subject}
          </Row>
        )) : <Empty title="Nothing sent yet">Messages you send show up here, with how many were delivered and read.</Empty>}
      </Panel>
    </>
  );
}
