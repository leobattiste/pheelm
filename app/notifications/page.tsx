import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import { Avatar } from "@/components/PeopleSheet";
import { initials } from "@/lib/format";
import { getNotifications, type Notification } from "@/lib/notifications";
import { getServerClient } from "@/lib/supabase/server";
import { respondToInvite, respondToRequest } from "../c/actions";
import { clearRead, markAllRead } from "./actions";
import Seen from "./Seen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

function when(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** One notification as a sentence: who, what, which collection. */
function Line({ n }: { n: Notification }) {
  const who = n.actor ? <strong>{n.actor.display_name || `@${n.actor.handle}`}</strong> : <strong>Someone</strong>;
  const list = n.list ? <strong>{n.list.title}</strong> : "a collection";
  const quote = n.comment ? <span className="notif-quote">&ldquo;{n.comment.body.length > 140 ? `${n.comment.body.slice(0, 140)}…` : n.comment.body}&rdquo;</span> : null;
  switch (n.type) {
    case "invite": return <>{who} invited you to co-curate {list}</>;
    case "request": return <>{who} asked to co-curate {list}</>;
    case "invite_accepted": return <>{who} accepted your invite to {list}</>;
    case "invite_declined": return <>{who} declined your invite to {list}</>;
    case "request_accepted": return <>{who} added you as a co-curator on {list}</>;
    case "request_declined": return <>{who} declined your request to co-curate {list}</>;
    case "removed": return <>{who} removed you from {list}</>;
    case "comment": return <>{who} commented on {list} {quote}</>;
    case "reply": return <>{who} replied to your comment on {list} {quote}</>;
    case "mention": return <>{who} mentioned you on {list} {quote}</>;
    case "collection_film": return <><strong>{n.film?.title ?? "A film"}</strong>{n.film?.year ? ` (${n.film.year})` : ""} was added to {list}</>;
    case "report": return <>{n.actor ? who : <strong>A visitor</strong>} reported {list}</>;
    case "comment_report": return <>{who} reported a comment on {list} {quote}</>;
    case "submission": return <>{who} suggested <strong>{n.detail ?? "a film"}</strong></>;
    case "message": return <>New message: {n.detail}</>;
    case "new_member": return <>{n.actor ? who : <strong>{n.detail || "Someone"}</strong>} joined Pheelm</>;
    case "featured": return <>{list} is now featured on Collections</>;
    case "new_film": return <>New from <strong>{n.person?.name ?? "a director you follow"}</strong>: <strong>{n.film?.title ?? "a film"}</strong>{n.film?.year ? ` (${n.film.year})` : ""}</>;
  }
}

function href(n: Notification) {
  if (n.type === "report" || n.type === "comment_report") return "/admin/community";
  if (n.type === "submission") return "/admin/submissions";
  if (n.type === "message") return "/admin/inbox";
  if (n.type === "new_member") return n.actor ? `/@${n.actor.handle}` : "/admin/members";
  if (n.type === "new_film" || n.type === "collection_film") return n.film ? `/films/${n.film.slug}` : null;
  if (!n.list || n.type === "removed") return null;
  if (n.comment) return `/c/${n.list.id}#comment-${n.comment.id}`;
  if (n.type === "request") return `/c/${n.list.id}?people`;
  return `/c/${n.list.id}`;
}

const KIND_ICONS: Record<Notification["type"], IconName> = {
  invite: "userPlus", request: "door", invite_accepted: "check", invite_declined: "x",
  request_accepted: "check", request_declined: "x", removed: "x", comment: "comment", reply: "reply", mention: "at", new_film: "film", collection_film: "stack",
  report: "flag", comment_report: "flag", submission: "film", message: "mail", new_member: "userPlus", featured: "sparkle",
};

function Item({ n }: { n: Notification }) {
  const link = href(n);
  return (
    <li className={`notif collection-tile${n.read_at ? "" : " is-unread"}`}>
      <span className="notif-avatar">
        {n.type === "new_film" || n.type === "collection_film" ? (
          n.film?.poster_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="avatar notif-poster" src={n.film.poster_url} alt="" width={36} height={36} loading="lazy" />
            : <span className="avatar notif-poster" aria-hidden="true">{initials(n.person?.name ?? n.film?.title ?? "")}</span>
        ) : n.actor ? <Avatar m={n.actor} /> : <span className="avatar" aria-hidden="true" />}
        <span className={`notif-kind is-${n.type}`}><Icon name={KIND_ICONS[n.type]} /></span>
      </span>
      <div className="notif-main">
        <p className="notif-text">
          {link ? <Link href={link} className="notif-link"><Line n={n} /></Link> : <Line n={n} />}
        </p>
        {n.note && <p className="notif-note">&ldquo;{n.note}&rdquo;</p>}
        {(n.type === "report" || n.type === "comment_report") && n.detail && <p className="notif-note">&ldquo;{n.detail}&rdquo;</p>}
        <p className="notif-time"><time dateTime={n.created_at}>{when(n.created_at)}</time></p>
        {n.open && n.list && (
          <div className="notif-actions">
            {n.type === "invite" ? (
              <>
                <form action={respondToInvite}>
                  <input type="hidden" name="list_id" value={n.list.id} /><input type="hidden" name="accept" value="1" />
                  <input type="hidden" name="back" value={`/c/${n.list.id}`} />
                  <button type="submit" className="button small">Accept</button>
                </form>
                <form action={respondToInvite}>
                  <input type="hidden" name="list_id" value={n.list.id} /><input type="hidden" name="accept" value="0" />
                  <input type="hidden" name="back" value="/notifications" />
                  <button type="submit" className="button ghost small">Decline</button>
                </form>
              </>
            ) : n.actor ? (
              <>
                <form action={respondToRequest}>
                  <input type="hidden" name="list_id" value={n.list.id} /><input type="hidden" name="user_id" value={n.actor.id} />
                  <input type="hidden" name="accept" value="1" /><input type="hidden" name="back" value="/notifications" />
                  <button type="submit" className="button small">Approve</button>
                </form>
                <form action={respondToRequest}>
                  <input type="hidden" name="list_id" value={n.list.id} /><input type="hidden" name="user_id" value={n.actor.id} />
                  <input type="hidden" name="accept" value="0" /><input type="hidden" name="back" value="/notifications" />
                  <button type="submit" className="button ghost small">Decline</button>
                </form>
              </>
            ) : null}
          </div>
        )}
        {!n.open && (n.type === "invite" || n.type === "request") && <p className="notif-time">Answered</p>}
      </div>
      {!n.read_at && <span className="notif-dot" aria-label="New" />}
    </li>
  );
}

/**
 * Notifications: invites and requests to answer right here, answers to yours, and comments,
 * replies and mentions on your collections. New ones are highlighted, then marked read.
 */
export default async function NotificationsPage() {
  const db = await getServerClient();
  if (!db) redirect("/");
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/notifications");
  const { available, items } = await getNotifications(db, user.id);
  const fresh = items.filter((n) => !n.read_at);
  const earlier = items.filter((n) => n.read_at);
  const waiting = items.filter((n) => n.open).length;

  return (
    <section className="page notifications-page">
      <header className="page-head">
        <h1>Notifications</h1>
        <p className="lead">
          {waiting ? `${waiting} waiting for your answer.` : "New films from directors you follow, and invites, requests and comments on your collections."}
        </p>
        {items.length > 0 && (
          <div className="collection-actions">
            {fresh.length > 0 && <form action={markAllRead}><button type="submit" className="button ghost small">Mark all as read</button></form>}
            {earlier.length > 0 && <form action={clearRead}><button type="submit" className="button ghost small">Clear read</button></form>}
          </div>
        )}
      </header>

      {!available ? (
        <div className="empty-state"><p>Notifications aren&rsquo;t switched on yet.</p></div>
      ) : !items.length ? (
        <div className="empty-state">
          <Icon name="bell" className="empty-icon" />
          <p>You&rsquo;re all caught up.</p>
          <p className="muted">Follow a director to hear when their new films are added. Invites, requests and comments on your collections show up here too.</p>
          <Link className="button ghost small" href="/watchlists">Browse collections</Link>
        </div>
      ) : (
        <>
          {fresh.length > 0 && (
            <section className="notif-group" aria-labelledby="n-new">
              <h2 id="n-new">New</h2>
              <ul className="notif-list">{fresh.map((n) => <Item key={n.id} n={n} />)}</ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section className="notif-group" aria-labelledby="n-earlier">
              <h2 id="n-earlier">Earlier</h2>
              <ul className="notif-list">{earlier.map((n) => <Item key={n.id} n={n} />)}</ul>
            </section>
          )}
          {/* Seen once they've been on screen a moment, so the dot in the menu clears. */}
          {fresh.some((n) => !n.open) && <Seen ids={fresh.filter((n) => !n.open).map((n) => n.id)} />}
        </>
      )}
    </section>
  );
}
