import Link from "next/link";
import Icon from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { setMessageHandled } from "../actions";

const TOPICS: Record<string, string> = { feedback: "Feedback", general: "Question or idea", correction: "Correction", partnership: "Partnership", press: "Press", privacy: "Privacy" };

/** Messages from the contact and partnership forms, and the newsletter list. */
export default async function AdminInbox({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { db, owner } = await requireAdmin();
  const show = (await searchParams).show === "done" ? "done" : "open";
  const [{ data: messages, error }, { count: subscribers }] = await Promise.all([
    db.from("messages").select("*").eq("handled", show === "done").order("created_at", { ascending: false }).limit(200),
    db.from("subscribers").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="account-panel">
      <div className="admin-head"><h2 className="admin-section-heading">Inbox</h2></div>
      {error ? (
        <p className="notice">To receive messages and newsletter sign-ups, run <code>supabase/platform.sql</code> in Supabase.</p>
      ) : (
        <>
          <section className="account-section">
            <h2>Newsletter</h2>
            <p>{subscribers ?? 0} {subscribers === 1 ? "person has" : "people have"} signed up.</p>
            {!!subscribers && owner && <div className="actions"><a className="button ghost small" href="/admin/subscribers.csv" download>Download the list (CSV)</a></div>}
          </section>
          <div className="actions">
            <Link className="button ghost small" aria-pressed={show === "open"} href="/admin/inbox">To answer</Link>
            <Link className="button ghost small" aria-pressed={show === "done"} href="/admin/inbox?show=done">Done</Link>
          </div>
          {messages?.length ? (
            <ul className="notif-list admin-inbox">
              {messages.map((m) => (
                <li key={m.id} className="notif"><Icon name="mail" /><div className="notif-main">
                  <div className="inbox-head">
                    <strong>{m.name || m.email}</strong>
                    {m.organization && <span className="muted">{m.organization}</span>}
                    <span className="status-pill">{TOPICS[m.topic] ?? m.topic}</span>
                    <span className="muted">{new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  {m.page && <p className="inbox-about">About <Link href={m.page}>{m.page_title || m.page}</Link></p>}
                  <p className="inbox-body">{m.body}</p>
                  <div className="actions">
                    <a className="button small" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Pheelm")}`}>Reply to {m.email}</a>
                    <form action={setMessageHandled}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="handled" value={m.handled ? "false" : "true"} />
                      <button className="button ghost small" type="submit">{m.handled ? "Move back to answer" : "Mark as done"}</button>
                    </form>
                  </div>
                </div></li>
              ))}
            </ul>
          ) : (
            <p className="muted">{show === "done" ? "Nothing marked as done yet." : "No messages to answer."}</p>
          )}
        </>
      )}
    </div>
  );
}
