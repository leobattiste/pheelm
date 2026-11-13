import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Panel, Row, Stat, Stats, plural } from "../ui";

type Month = { month: string; films: number; members: number; watchlists: number; saves: number };
const SERIES = [["films", "Films"], ["members", "Members"], ["watchlists", "Watchlists"], ["saves", "Watchlist saves"]] as const;
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

/** How the catalog and community grow, counted in the database from Pheelm's own records. */
export default async function AnalyticsPage() {
  const { db } = await requireAdmin("/admin/analytics");
  const total = (table: string) => db.from(table).select("*", { count: "exact", head: true });
  const [monthly, topSaves, watched, members, watchlists, saves] = await Promise.all([
    db.rpc("admin_monthly_counts", { months: 6 }),
    db.from("list_save_counts").select("list_id,saves").order("saves", { ascending: false }).limit(6),
    total("watched"), total("profiles"), total("lists"), total("list_saves"),
  ]);
  const months = ((monthly.data ?? []) as Month[]).map((m) => ({ ...m, label: MONTH.format(new Date(m.month)) }));
  const max = Math.max(1, ...months.flatMap((m) => SERIES.map(([key]) => Number(m[key]))));
  const sums = Object.fromEntries(SERIES.map(([key]) => [key, months.reduce((sum, m) => sum + Number(m[key]), 0)])) as Record<(typeof SERIES)[number][0], number>;
  const ids = (topSaves.data ?? []).map((s) => s.list_id);
  const { data: topLists } = ids.length ? await db.from("lists").select("id,title").in("id", ids) : { data: [] as { id: string; title: string }[] };
  const titles = new Map((topLists ?? []).map((l) => [l.id, l.title]));

  return (
    <>
      <PageHeader back={{ href: "/admin", label: "Dashboard" }} title="Analytics" description="How the catalog and community grow, counted from Pheelm's own records. Visitors aren't tracked here." />
      <Stats>
        <Stat value={members.count ?? 0} label={`Members, ${sums.members} in six months`} />
        <Stat value={watchlists.count ?? 0} label={`Watchlists, ${sums.watchlists} in six months`} />
        <Stat value={saves.count ?? 0} label={`Watchlist saves, ${sums.saves} in six months`} />
        <Stat value={watched.count ?? 0} label="Films marked watched" />
      </Stats>
      <Panel title="The last six months" icon="calendar">
        {monthly.error ? <p className="notice error">Monthly numbers couldn&apos;t load. If this keeps happening, run <code>supabase/admin-insights.sql</code> in Supabase.</p> : (
          <>
            <p className="muted">New records each month. These aren&apos;t page views or visitors.</p>
            <div className="admin-chart" role="img" aria-label="New films, members, watchlists and watchlist saves each month">
              {months.map((m) => (
                <div className="admin-chart-group" key={m.month}>
                  <div className="admin-chart-bars">
                    {SERIES.map(([key, label], i) => {
                      const value = Number(m[key]);
                      return <div key={key} className={`admin-chart-bar admin-chart-bar-${i}`} style={{ height: `${Math.max(value ? 6 : 2, Math.round((value / max) * 100))}%` }} title={`${label}: ${value}`} />;
                    })}
                  </div>
                  <span className="muted">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="admin-chart-legend">{SERIES.map(([key, label], i) => <span key={key}><i className={`admin-chart-key admin-chart-bar-${i}`} />{label}</span>)}</div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th scope="col">Month</th>{SERIES.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
                <tbody>{months.map((m) => <tr key={m.month}><th scope="row">{m.label}</th>{SERIES.map(([key]) => <td key={key}>{Number(m[key])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      <Panel title="Most-saved community watchlists" icon="bookmark">
        {(topSaves.data ?? []).length ? (topSaves.data ?? []).map((s) => (
          <Row key={s.list_id} href={`/c/${s.list_id}`} aside={<span className="muted">{plural(s.saves, "save")}</span>}>{titles.get(s.list_id) ?? "Watchlist"}</Row>
        )) : <Empty title="No saves yet">Watchlists members save appear here.</Empty>}
      </Panel>
    </>
  );
}
