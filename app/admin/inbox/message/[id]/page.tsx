import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { safeInternalPath } from "@/lib/safe-navigation";
import { BOXES, STAGES, STATUS_LABEL, TOPIC_LABEL, boxOf, type MessageStatus } from "@/lib/inbox";
import ConfirmButton from "../../../ConfirmButton";
import SubmitButton from "../../../SubmitButton";
import { Empty, Facts, PageHeader, Panel, Pill, dayTime, plural } from "../../../ui";
import { deleteMessage, setMessageStatus, setPartnershipStage } from "../../actions";
import { NotesForm, ReplyForm } from "../../MessageForms";

type Message = {
  id: string; name: string | null; email: string; organization: string | null; topic: string; body: string;
  status: MessageStatus; stage: string | null; partnership_type: string | null; website: string | null; notes: string | null;
  due_at: string | null; replied_at: string | null; closed_at: string | null; created_at: string; page: string | null; page_title: string | null;
};

const STATUS_TONE = { new: "info", open: "neutral", done: "ok", spam: "danger" } as const;

/** One message: who sent it and about what, the replies so far, a reply box, notes, and what to do with it. */
export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireAdmin(`/admin/inbox/message/${id}`);
  const { data, error } = await db.from("messages").select("*").eq("id", id).maybeSingle();
  if (error || !data) notFound();
  let m = data as Message;
  // Opening a new message marks it as read.
  if (m.status === "new") {
    const { data: read } = await db.from("messages").update({ status: "open" }).eq("id", id).eq("status", "new").select("*").maybeSingle();
    if (read) m = read as Message;
  }
  const [{ data: replies }, { data: earlier }] = await Promise.all([
    db.from("message_replies").select("id, body, via, created_at, author_id").eq("message_id", id).order("created_at"),
    db.from("messages").select("id, topic, created_at").ilike("email", m.email.replace(/[\\%_]/g, (c) => "\\" + c)).neq("id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  const box = BOXES.find((b) => b.id === boxOf(m.topic))!;
  const closed = m.status === "done" || m.status === "spam";
  const status = (value: MessageStatus, label: string, ghost = true) => (
    <form action={setMessageStatus}>
      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={value} />
      <SubmitButton className={ghost ? "button ghost small" : "button small"} pendingLabel="Saving…">{label}</SubmitButton>
    </form>
  );
  const page = m.page && safeInternalPath(m.page);
  const due = m.due_at ? Math.ceil((new Date(m.due_at).getTime() - Date.now()) / 86400000) : null;

  return (
    <>
      <PageHeader back={{ href: `/admin/inbox/${box.id}`, label: box.label }} title={m.name || m.email}
        description={<>{TOPIC_LABEL[m.topic] ?? m.topic} · {dayTime(m.created_at)}</>}
        actions={<>
          {!closed && status("done", "Mark as done", false)}
          {closed && status("open", "Move back to answer")}
          {m.status !== "spam" && status("spam", "Spam")}
          <form action={deleteMessage}><input type="hidden" name="id" value={m.id} /><ConfirmButton confirm="Delete for good?">Delete</ConfirmButton></form>
        </>} />
      <div className="admin-tags">
        <Pill tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Pill>
        {m.replied_at && <Pill tone="ok">Replied {dayTime(m.replied_at)}</Pill>}
        {m.topic === "privacy" && due !== null && !closed && <Pill tone={due < 0 ? "danger" : due <= 7 ? "warn" : "neutral"}>{due < 0 ? `${plural(-due, "day")} overdue` : `Due in ${plural(due, "day")}`}</Pill>}
      </div>
      <div className="admin-message-layout">
        <div className="admin-message-main">
          <Panel title="Message" icon="mail">
            <p className="admin-message-body">{m.body}</p>
          </Panel>
          <Panel title={replies?.length ? `Replies (${replies.length})` : "Reply"} icon="reply">
            {(replies ?? []).map((r) => (
              <article key={r.id} className="admin-reply-sent">
                <p className="muted">{r.via === "email" ? "Sent from email" : "Sent from Pheelm"} · {dayTime(r.created_at)}</p>
                <p className="admin-message-body">{r.body}</p>
              </article>
            ))}
            {m.status === "spam" ? <Empty title="Marked as spam">Move it back to answer before replying.</Empty>
              : <ReplyForm id={m.id} topic={m.topic} name={m.name ?? ""} email={m.email} closed={closed} />}
          </Panel>
        </div>
        <aside className="admin-message-side">
          {m.topic === "partnership" && (
            <Panel title="Stage" icon="flag">
              <div className="admin-stages">
                {STAGES.map((s) => (
                  <form key={s.id} action={setPartnershipStage}>
                    <input type="hidden" name="id" value={m.id} /><input type="hidden" name="stage" value={s.id} />
                    <button className="chip" aria-pressed={m.stage === s.id}>{s.label}</button>
                  </form>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="From" icon="user">
            <Facts items={[
              ["Name", m.name],
              ["Email", <a key="e" href={`mailto:${m.email}`}>{m.email}</a>],
              ["Organization", m.organization],
              ["Partnership", m.partnership_type],
              ["Website", m.website && /^https?:\/\//i.test(m.website) ? <a key="w" href={m.website} target="_blank" rel="noopener noreferrer">{m.website.replace(/^https?:\/\//, "")}</a> : null],
              ["About", page ? <Link key="p" href={page}>{m.page_title || page}</Link> : m.page_title],
              ["Deadline", m.topic === "privacy" && m.due_at ? dayTime(m.due_at) : null],
              ["Closed", m.closed_at ? dayTime(m.closed_at) : null],
            ]} />
          </Panel>
          <Panel title="Notes" icon="pencil">
            <NotesForm id={m.id} notes={m.notes} />
          </Panel>
          {!!earlier?.length && (
            <Panel title="Earlier from them" icon="clock">
              {earlier.map((e) => (
                <Link key={e.id} className="admin-row" href={`/admin/inbox/message/${e.id}`}>
                  <span className="admin-row-main"><span className="admin-row-title">{TOPIC_LABEL[e.topic] ?? e.topic}</span></span>
                  <span className="admin-row-aside muted">{dayTime(e.created_at)}</span>
                </Link>
              ))}
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
