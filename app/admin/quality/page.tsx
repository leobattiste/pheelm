import Link from "next/link";
import FilmCard from "@/components/FilmCard";
import { getFilms, toCard } from "@/lib/data";
import { requireAdmin } from "@/lib/admin";

const ISSUES = [
  ["poster", "Missing posters"],
  ["synopsis", "Missing synopses"],
  ["director", "Missing directors"],
  ["editorial", "Unpublished essays"],
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
  const page = Math.max(1, Math.min(5000, Number.parseInt(sp.page ?? "1", 10) || 1));
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
    ...ISSUES.slice(0, 5).map(([key]) => db.from("admin_film_quality")
      .select("id", { count: "exact", head: true }).contains("issues", [key])),
  ]);
  const issueCounts = new Map(ISSUES.slice(0, 5).map(([key], i) => [key, issueQueries[i].count ?? 0]));
  const [{ count: noBio }, { count: noPhoto }] = await Promise.all([
    db.from("admin_people_quality").select("id", { count: "exact", head: true }).gt("directed", 0).or("bio.is.null,bio.eq."),
    db.from("admin_people_quality").select("id", { count: "exact", head: true }).gt("directed", 0).or("photo_url.is.null,photo_url.eq."),
  ]);
  const catalog = new Map((await getFilms().catch(() => [])).map(f => [f.id, toCard(f)]));
  const last = Math.ceil((count ?? 0) / PER_PAGE);
  const href = (p: number) => `/admin/quality?issue=${issue}&page=${p}`;

  return (
    <>
      <div className="admin-head">
        <div><h2 className="admin-section-heading">Content quality</h2><p className="muted">Find incomplete records and fix them at the source.</p></div>
        <Link className="button ghost small" href="/admin/automation">Automation</Link>
      </div>
      <div className="stats">
        {ISSUES.slice(0, 5).map(([key, label]) => (
          <Link className="stat" href={`/admin/quality?issue=${key}`} key={key}>
            <strong>{issueCounts.get(key) ?? 0}</strong><span>{label}</span>
          </Link>
        ))}
      </div>
      <section className="account-section">
        <h2>Directors to complete</h2>
        <div className="actions">
          <Link href="/admin/people?missing=bio">Missing biography: {noBio ?? "—"}</Link>
          <Link href="/admin/people?missing=photo">Missing portrait: {noPhoto ?? "—"}</Link>
        </div>
      </section>
      <div className="actions" aria-label="Filter content issues">
        <Link className="button ghost small" aria-pressed={issue === "all"} href="/admin/quality">All issues</Link>
        {ISSUES.map(([key, label]) => <Link key={key} className="button ghost small" aria-pressed={issue === key} href={`/admin/quality?issue=${key}`}>{label}</Link>)}
      </div>
      {error ? <p className="notice error">Unable to load content checks. Verify the admin database upgrade.</p> : (
        <>
          <p className="muted">{count ?? 0} films need attention. Select a film to edit it. Missing essays can be managed in Editorial.</p>
          <ul className="film-grid admin-film-grid">
            {(films ?? []).map(f => <FilmCard key={f.id} href={`/admin/films/${f.id}`} film={catalog.get(f.id) ?? {
              id: f.id, slug: f.slug, title: f.title, year: f.year, poster_url: null, directors: [], type: "feature",
              countries: [], languages: [], genres: [], runtime: null, wins: 0,
            }} controls={<div className="admin-card-controls"><span className={`status-pill ${f.status}`}>{f.status}</span>
              <div className="admin-tags">{(f.issues as string[]).map(label => <span className="status-pill" key={label}>{label}</span>)}</div>
              <Link className="link-button" href={`/admin/editorial/${f.id}`}>Edit essay</Link>
            </div>} />)}
          </ul>
          {!films?.length && <p className="empty">No matching issues.</p>}
          <div className="actions admin-pagination">
            {page > 1 && <Link className="button ghost small" href={href(page - 1)}>Previous</Link>}
            <span className="muted">Page {page} of {Math.max(1, last)}</span>
            {page < last && <Link className="button ghost small" href={href(page + 1)}>Next</Link>}
          </div>
        </>
      )}
    </>
  );
}
