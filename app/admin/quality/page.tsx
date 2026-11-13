import Link from "next/link";
import FilmCard from "@/components/FilmCard";
import { getFilms, toCard } from "@/lib/data";
import { requireAdmin } from "@/lib/admin";
import { Empty, PageHeader, Pager, Panel, Pill, Row, ViewTabs, pageNumber, plural } from "../ui";

const ISSUES = [
  ["poster", "Missing posters"],
  ["synopsis", "Missing synopses"],
  ["director", "Missing directors"],
  ["editorial", "Missing essays"],
  ["duplicate", "Possible duplicates"],
  ["country", "Missing countries"],
  ["language", "Missing languages"],
  ["runtime", "Missing runtimes"],
  ["tmdb", "No TMDB match"],
] as const;
const PER_PAGE = 40;

export default async function QualityPage({ searchParams }: { searchParams: Promise<{ issue?: string; page?: string }> }) {
  const { db } = await requireAdmin("/admin/quality");
  const sp = await searchParams;
  const issue = ISSUES.some(([id]) => id === sp.issue) ? sp.issue! : "all";
  const page = pageNumber(sp.page, 5000);
  const offset = (page - 1) * PER_PAGE;

  let query = db.from("admin_film_quality")
    .select("id,slug,title,year,status,issues,issue_count", { count: "exact" })
    .gt("issue_count", 0)
    .order("issue_count", { ascending: false })
    .order("year", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);
  if (issue !== "all") query = query.contains("issues", [issue]);
  const [{ data: films, count, error }, ...issueQueries] = await Promise.all([
    query,
    ...ISSUES.map(([key]) => db.from("admin_film_quality")
      .select("id", { count: "exact", head: true }).contains("issues", [key])),
  ]);
  const issueCounts = new Map(ISSUES.map(([key], i) => [key, issueQueries[i].count ?? 0]));
  const label = new Map<string, string>(ISSUES);
  const [{ count: noBio }, { count: noPhoto }] = await Promise.all([
    db.from("admin_people_quality").select("id", { count: "exact", head: true }).gt("directed", 0).or("bio.is.null,bio.eq."),
    db.from("admin_people_quality").select("id", { count: "exact", head: true }).gt("directed", 0).or("photo_url.is.null,photo_url.eq."),
  ]);
  const catalog = new Map((await getFilms().catch(() => [])).map(f => [f.id, toCard(f)]));
  const href = (p: number) => `/admin/quality?issue=${issue}&page=${p}`;

  return (
    <>
      <PageHeader back={{ href: "/admin/films", label: "Films" }} title="Content quality" description="Films with missing or doubtful details. Open a film to fix it at the source."
        actions={<Link className="button ghost small" href="/admin/automation">Fill gaps automatically</Link>} />
      <ViewTabs label="Filter by issue" items={[
        { label: "All issues", href: "/admin/quality", active: issue === "all" },
        ...ISSUES.map(([key, text]) => ({ label: text, href: `/admin/quality?issue=${key}`, active: issue === key, count: issueCounts.get(key) ?? 0 })),
      ]} />
      <Panel title="Directors to complete" icon="users2">
        <Row href="/admin/people?missing=bio" aside={<strong className="admin-number">{noBio ?? 0}</strong>}>Directors without a biography</Row>
        <Row href="/admin/people?missing=photo" aside={<strong className="admin-number">{noPhoto ?? 0}</strong>}>Directors without a portrait</Row>
      </Panel>
      {error ? <p className="notice error">Content checks couldn&apos;t load. Try again in a moment.</p> : (
        <>
          <p className="muted">{plural(count ?? 0, "film")} {issue === "all" ? "need attention" : `with ${(label.get(issue) ?? "").toLowerCase()}`}.</p>
          {films?.length ? <ul className="film-grid admin-film-grid">
            {films.map(f => <FilmCard key={f.id} href={`/admin/films/${f.id}`} film={catalog.get(f.id) ?? {
              id: f.id, slug: f.slug, title: f.title, year: f.year, poster_url: null, directors: [], type: "feature",
              countries: [], languages: [], genres: [], runtime: null, wins: 0,
            }} controls={<div className="admin-card-controls">
              <div className="admin-tags">
                <Pill tone={f.status === "published" ? "ok" : "warn"}>{f.status === "published" ? "Published" : "Draft"}</Pill>
                {(f.issues as string[]).map(key => <Pill key={key} tone="danger">{(label.get(key) ?? key).replace(/^Missing /, "No ")}</Pill>)}
              </div>
              <div className="actions">
                <Link className="link-button" href={`/admin/films/${f.id}`}>Edit film</Link>
                {(f.issues as string[]).includes("editorial") && <Link className="link-button" href={`/admin/editorial/${f.id}`}>Write essay</Link>}
              </div>
            </div>} />)}
          </ul> : <Empty title="Nothing to fix here">Every film passes this check.</Empty>}
          <Pager page={page} total={count ?? 0} size={PER_PAGE} href={href} />
        </>
      )}
    </>
  );
}
