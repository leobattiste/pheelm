import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { adminCounts } from "@/lib/admin-counts";
import { tmdbEnabled } from "@/lib/tmdb";
import { Empty, PageHeader, Panel, Pill, Row, Stat, Stats, ago, plural } from "./ui";

export default async function AdminHome() {
  const { db } = await requireAdmin("/admin");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = db.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    const result = await q;
    return result.count ?? 0;
  };
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [waiting, films, drafts, people, members, newMembers, missingPosters, missingDirectors, queued, recent, activity] = await Promise.all([
    adminCounts(db),
    count("films", (q) => q.eq("status", "published")),
    count("films", (q) => q.eq("status", "draft")),
    count("people"),
    count("profiles"),
    count("profiles", (q) => q.gte("created_at", weekAgo)),
    count("admin_film_quality", (q) => q.contains("issues", ["poster"])),
    count("admin_film_quality", (q) => q.contains("issues", ["director"])),
    count("film_queue"),
    db.from("films").select("id,title,year,status,updated_at").order("updated_at", { ascending: false }).limit(6),
    db.from("admin_activity").select("id,action,target_type,details,created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  const fromPeople = [
    { name: "Messages to answer", count: waiting.inbox, href: "/admin/inbox" },
    { name: "Reports to review", count: waiting.reports, href: "/admin/community" },
    { name: "Film submissions", count: waiting.submissions, href: "/admin/submissions" },
  ];
  const catalog = [
    { name: "Film drafts", count: drafts, href: "/admin/films?status=draft" },
    { name: "Films without posters", count: missingPosters, href: "/admin/quality?issue=poster" },
    { name: "Films without directors", count: missingDirectors, href: "/admin/quality?issue=director" },
    { name: "Films in the queue", count: queued, href: "/admin/films/add?method=queue" },
  ];
  const waitingTotal = fromPeople.reduce((sum, t) => sum + t.count, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={waitingTotal ? `${plural(waitingTotal, "thing")} waiting for you.` : "Nothing is waiting for you. Here's how the catalog stands."}
        actions={<Link className="button ghost" href="/admin/analytics">Analytics</Link>}
      />
      <Stats>
        <Stat value={films} label="Published films" href="/admin/films?status=published" />
        <Stat value={people} label="People" href="/admin/people" />
        <Stat value={members} label={`Members, ${newMembers} new this week`} href="/admin/members" />
        <Stat value={waitingTotal} label="Waiting for a reply or review" href={waiting.inbox ? "/admin/inbox" : "/admin/community"} tone="attention" />
      </Stats>
      <div className="admin-grid">
        <Panel title="From people" icon="mail">
          {fromPeople.map((t) => <Row key={t.name} href={t.href} aside={<strong className="admin-number">{t.count}</strong>}>{t.name}</Row>)}
        </Panel>
        <Panel title="Catalog to finish" icon="clapper">
          {catalog.map((t) => <Row key={t.name} href={t.href} aside={<strong className="admin-number">{t.count}</strong>}>{t.name}</Row>)}
        </Panel>
        <Panel title="Recently updated films" icon="clock" actions={<Link className="link-button" href="/admin/films?sort=recent">See all</Link>}>
          {recent.data?.length ? recent.data.map((f) => (
            <Row key={f.id} href={`/admin/films/${f.id}`} detail={f.updated_at ? `${f.year} · updated ${ago(f.updated_at, false)}` : String(f.year)}
              aside={<Pill tone={f.status === "published" ? "ok" : "warn"}>{f.status === "published" ? "Published" : "Draft"}</Pill>}>{f.title}</Row>
          )) : <Empty title="No films yet" action={<Link className="button small" href="/admin/films">Add a film</Link>} />}
        </Panel>
        <Panel title="Recent admin activity" icon="pencil" actions={<Link className="link-button" href="/admin/activity">See all</Link>}>
          {activity.data?.length ? activity.data.map((a) => (
            <Row key={a.id} detail={a.details || undefined} aside={<span className="muted">{ago(a.created_at)}</span>}>{a.action}</Row>
          )) : <Empty title="No changes yet">Changes made in admin appear here.</Empty>}
        </Panel>
      </div>
      {!tmdbEnabled && <p className="notice">TMDB isn&apos;t connected, so imports and automation are off. Add TMDB_API_KEY in Vercel to turn them on.</p>}
    </>
  );
}
