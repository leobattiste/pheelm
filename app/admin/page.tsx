import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { adminCounts } from "@/lib/admin-counts";
import { tmdbEnabled } from "@/lib/tmdb";
import Icon, { type IconName } from "@/components/Icon";
import { PageHeader, Panel, Row, ago, plural } from "./ui";

const TOPIC: Record<string, string> = { partnership: "Partnership", feedback: "Feedback", press: "Press", privacy: "Privacy request", contact: "Message" };
// What makes a film "complete": the details its public page leans on.
const BLANK = (column: string) => `${column}.is.null,${column}.eq.`;
const KEY_GAPS = [BLANK("poster_url"), BLANK("synopsis"), "runtime.is.null", "genres.cd.{}", "countries.cd.{}"].join(",");
// Each gap links to the Films list filtered by it (the `missing` filter there).
const GAPS = [
  { label: "Poster", key: "poster", or: BLANK("poster_url") },
  { label: "Synopsis", key: "synopsis", or: BLANK("synopsis") },
  { label: "Country", key: "countries", or: "countries.cd.{}" },
  { label: "Genre", key: "genres", or: "genres.cd.{}" },
  { label: "Runtime", key: "runtime", or: "runtime.is.null" },
  { label: "Trailer", key: "trailer", or: BLANK("trailer_url") },
  { label: "Where to watch", key: "watch", or: "watch.eq.[]" },
];

/**
 * Home: what needs you first (messages, suggestions, reports), each with its next step; then how
 * complete the catalog is, with every gap a link to the films that have it; then shortcuts.
 */
export default async function AdminHome() {
  const { db } = await requireAdmin("/admin");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = db.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const result = await q;
    return result.count ?? 0;
  };
  const published = (q: any) => q.eq("status", "published"); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [waiting, films, people, members, drafts, incomplete, gaps, messages, submissions, activity] = await Promise.all([
    adminCounts(db),
    count("films", published),
    count("people"),
    count("profiles"),
    count("films", (q) => q.eq("status", "draft")),
    count("films", (q) => published(q).or(KEY_GAPS)),
    Promise.all(GAPS.map(async (g) => ({ ...g, count: await count("films", (q) => published(q).or(g.or)) }))),
    db.from("messages").select("id,name,email,topic,body,created_at").eq("handled", false).order("created_at", { ascending: true }).limit(5),
    db.from("submissions").select("id,title,year,created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(3),
    db.from("admin_activity").select("id,action,target_type,details,created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  // The queue: oldest first, so nothing waits forever.
  type Item = { key: string; icon: IconName; title: string; detail: string; when: string; href: string; action: string };
  const queue: Item[] = [
    ...(messages.data ?? []).map((m) => ({
      key: `m-${m.id}`, icon: "mail" as IconName, href: `/admin/inbox/message/${m.id}`, action: "Reply",
      title: `${m.name || m.email || "Someone"} · ${TOPIC[m.topic] ?? "Message"}`,
      detail: String(m.body ?? "").replace(/\s+/g, " ").slice(0, 140), when: m.created_at,
    })),
    ...(submissions.data ?? []).map((s) => ({
      key: `s-${s.id}`, icon: "send" as IconName, href: "/admin/submissions", action: "Review",
      title: `Suggested film: ${s.title}${s.year ? ` (${s.year})` : ""}`, detail: "A member suggested this film for the catalog.", when: s.created_at,
    })),
    ...(waiting.reports ? [{
      key: "reports", icon: "flag" as IconName, href: "/admin/community", action: "Review",
      title: plural(waiting.reports, "report") + " to review", detail: "Watchlists or comments members flagged.", when: "",
    }] : []),
  ];
  const more = Math.max(0, waiting.inbox - (messages.data?.length ?? 0)) + Math.max(0, waiting.submissions - (submissions.data?.length ?? 0));
  const total = waiting.inbox + waiting.submissions + waiting.reports;
  const complete = Math.max(0, films - incomplete);
  const pct = films ? Math.round((complete / films) * 100) : 0;
  const open = gaps.filter((g) => g.count > 0).sort((a, b) => b.count - a.count);

  const shortcuts: { label: string; href: string; icon: IconName; tmdb?: boolean }[] = [
    { label: "Add a list of films", href: "/admin/films/add?method=list", icon: "stack", tmdb: true },
    { label: "Write a perspective", href: "/admin/editorial", icon: "pencil" },
    { label: "Update awards", href: "/admin/automation#awards", icon: "laurel" },
    { label: "Add full cast and crew", href: "/admin/automation#cast-and-crew", icon: "users2", tmdb: true },
    { label: "Refresh where to watch", href: "/admin/automation#where-to-watch", icon: "play", tmdb: true },
    { label: "Send an announcement", href: "/admin/inbox", icon: "megaphone" },
  ];

  return (
    <>
      <PageHeader title="Home"
        description={total ? `${plural(total, "thing")} need${total === 1 ? "s" : ""} you.` : "You're all caught up."}
        actions={tmdbEnabled ? <Link className="button" href="/admin/films/add?method=one"><Icon name="plus" />Add a film</Link> : undefined} />

      <div className="admin-home">
        <div className="admin-home-main">
          <Panel className="is-queue" title="Needs you" icon="bell" actions={total ? <span className="admin-count">{total}</span> : undefined}>
            {queue.length ? (
              <ul className="admin-queue">
                {queue.map((item) => (
                  <li key={item.key}>
                    <span className="admin-queue-icon"><Icon name={item.icon} /></span>
                    <div className="admin-queue-text">
                      <Link className="admin-row-link" href={item.href}>{item.title}</Link>
                      <span className="admin-cell-detail">{item.detail}</span>
                      {item.when && <span className="admin-cell-detail is-phone-only">{ago(item.when)}</span>}
                    </div>
                    {item.when && <span className="admin-queue-when">{ago(item.when)}</span>}
                    <Link className="button ghost small admin-queue-action" href={item.href}>{item.action}</Link>
                  </li>
                ))}
                {more > 0 && <li className="admin-queue-more"><Link href="/admin/inbox">{plural(more, "more thing")} waiting</Link></li>}
              </ul>
            ) : (
              <div className="admin-caught-up"><Icon name="check" /><div><strong>All caught up</strong><span>New messages, suggestions and reports show up here.</span></div></div>
            )}
          </Panel>

          <Panel className="is-activity" title="Recent activity" icon="clock" actions={<Link className="link-button" href="/admin/activity">See all</Link>}>
            {activity.data?.length ? activity.data.map((a) => (
              <Row key={a.id} detail={a.details || undefined} aside={<span className="muted">{ago(a.created_at)}</span>}>{a.action}</Row>
            )) : <p className="muted">Changes made in admin show up here.</p>}
          </Panel>
        </div>

        <div className="admin-home-side">
          <Panel className="is-catalog" title="Catalog" icon="film" actions={<Link className="link-button" href="/admin/films?missing=any">Fix gaps</Link>}>
            <div className="admin-health">
              <div className="admin-health-top">
                <strong>{pct}%</strong>
                <span>{complete.toLocaleString("en-US")} of {plural(films, "published film")} have every key detail</span>
              </div>
              <div className="admin-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Films with every key detail"><span style={{ width: `${pct}%` }} /></div>
            </div>
            {open.map((g) => (
              <Row key={g.key} href={`/admin/films?status=published&missing=${g.key}`} aside={<span className="admin-num">{g.count.toLocaleString("en-US")}</span>}>
                No {g.label.toLowerCase()}
              </Row>
            ))}
            {drafts > 0 && <Row href="/admin/films?status=draft" aside={<span className="admin-num">{drafts.toLocaleString("en-US")}</span>}>Drafts</Row>}
            <p className="admin-home-totals">{plural(films, "film")} · {plural(people, "person", "people")} · {plural(members, "member")}</p>
          </Panel>

          <Panel className="is-shortcuts" title="Shortcuts" icon="sparkle">
            <div className="admin-shortcuts">
              {shortcuts.filter((s) => !s.tmdb || tmdbEnabled).map((s) => (
                <Link key={s.label} href={s.href}><Icon name={s.icon} /><span>{s.label}</span></Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      {!tmdbEnabled && <p className="notice">TMDB isn&apos;t connected, so imports and automation are off. Add TMDB_API_KEY in Vercel to turn them on.</p>}
    </>
  );
}
