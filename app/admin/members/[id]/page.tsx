import Link from "next/link";
import { commentPlace } from "@/lib/comments";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { setAdmin } from "../../actions";
import { removeComment } from "../../community/actions";
import ConfirmButton from "../../ConfirmButton";
import { Empty, Facts, PageHeader, Panel, Pill, Row, Stat, Stats, day, dayTime } from "../../ui";
import type { MemberRow } from "../page";
import SuspendForm from "../SuspendForm";

/** One member: their account, what they've made and said, and what admins have done about them. */
export default async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, owner, user } = await requireAdmin(`/admin/members/${id}`);
  const { data: members, error } = await db.rpc("admin_members");
  if (error) throw new Error("This member couldn't load.");
  const person = ((members ?? []) as MemberRow[]).find((m) => m.id === id);
  if (!person) notFound();
  const [{ data: collections }, { data: comments }, { data: history }] = await Promise.all([
    db.from("lists").select("id,title,is_public,hidden,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("list_comments").select("id,body,list_id,film_id,created_at,removed_at,lists(title),films(title,slug)").eq("user_id", id).is("removed_at", null).order("created_at", { ascending: false }).limit(20)
      .returns<{ id: string; body: string; list_id: string | null; film_id: string | null; created_at: string; lists: { title: string } | null; films: { title: string; slug: string } | null }[]>(),
    db.from("admin_activity").select("id,action,created_at,details").eq("target_type", "member").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const name = person.display_name || (person.handle ? `@${person.handle}` : "This member");
  const canSuspend = person.id !== user.id && !person.is_owner && (owner || !person.is_admin);
  const role = person.is_owner ? "Owner" : person.is_admin ? "Admin" : "Member";

  return (
    <>
      <PageHeader back={{ href: "/admin/members", label: "Members" }} title={name}
        description={[person.handle && `@${person.handle}`, `joined ${day(person.created_at)}`].filter(Boolean).join(" · ")}
        actions={<>
          {person.handle && <Link className="button ghost small" href={`/@${person.handle}`}>View profile</Link>}
          {owner && !person.is_owner && <form action={setAdmin}><input type="hidden" name="id" value={id} /><input type="hidden" name="make" value={person.is_admin ? "false" : "true"} />
            <button className="button ghost small">{person.is_admin ? "Remove admin" : "Make admin"}</button></form>}
        </>} />
      <div className="admin-tags">
        <Pill tone={person.is_admin ? "info" : "neutral"}>{role}</Pill>
        {person.suspended_at && <Pill tone="danger">Suspended {day(person.suspended_at)}</Pill>}
        <Pill>{person.is_private ? "Private profile" : "Public profile"}</Pill>
      </div>
      <Stats>
        <Stat value={person.lists} label="Watchlists" />
        <Stat value={person.saved} label="Films saved" />
        <Stat value={person.comments} label="Comments" />
      </Stats>
      <div className="admin-message-layout">
        <div className="admin-message-main">
          <Panel title="Watchlists" icon="stack">
            {collections?.length ? collections.map((c) => (
              <Row key={c.id} href={`/c/${c.id}`} detail={`Made ${day(c.created_at)}`}
                aside={<Pill tone={c.hidden ? "danger" : c.is_public ? "ok" : "neutral"}>{c.hidden ? "Hidden" : c.is_public ? "Public" : "Private"}</Pill>}>{c.title || "Untitled"}</Row>
            )) : <Empty title="No watchlists" />}
          </Panel>
          <Panel title="Recent comments" icon="comment">
            {comments?.length ? comments.map((c) => (
              <Row key={c.id} href={undefined} detail={<>On <Link href={commentPlace(c).href}>{commentPlace(c).title}</Link> · {dayTime(c.created_at)}</>}
                aside={<form action={removeComment}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={`/admin/members/${id}`} /><ConfirmButton confirm="Remove?">Remove</ConfirmButton></form>}>
                {c.body}
              </Row>
            )) : <Empty title="No comments" />}
          </Panel>
        </div>
        <aside className="admin-message-side">
          <Panel title="Account" icon="user">
            <Facts items={[
              ["Email", owner ? person.email ?? "Not available" : null],
              ["Joined", day(person.created_at)],
              ["Last signed in", day(person.last_seen)],
              ["Suspended", person.suspended_at ? dayTime(person.suspended_at) : null],
              ["Reason", person.suspended_reason],
            ]} />
          </Panel>
          {canSuspend && (
            <Panel title={person.suspended_at ? "Suspended" : "Suspend"} icon="lock">
              <SuspendForm id={id} suspended={!!person.suspended_at} name={name} />
            </Panel>
          )}
          <Panel title="Admin history" icon="clock">
            {history?.length ? history.map((h) => <Row key={h.id} detail={h.details || undefined} aside={<span className="muted">{day(h.created_at)}</span>}>{h.action}</Row>)
              : <Empty title="Nothing yet">Role changes and suspensions appear here.</Empty>}
          </Panel>
        </aside>
      </div>
    </>
  );
}
