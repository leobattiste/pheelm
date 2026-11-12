import Link from "next/link";
import FilmCard from "@/components/FilmCard";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";
import { PageHeader, Pager, Pill, Stat, Stats, day, pageNumber, plural, type PillTone } from "../ui";

const PAGE_SIZE = 40;
const STATUSES = [
  { value: "all", label: "All films" }, { value: "none", label: "No essay yet" },
  { value: "draft", label: "Drafts" }, { value: "published", label: "Published" },
];
const SORTS = [{ value: "newest", label: "Newest films" }, { value: "oldest", label: "Oldest films" }, { value: "title", label: "Title A–Z" }];
const TONE: Record<string, PillTone> = { published: "ok", draft: "warn" };

/** Films and their essays: find what needs writing, continue drafts, or revisit what's published. */
export default async function EditorialPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string; sort?: string }> }) {
  const { db } = await requireAdmin("/admin/editorial");
  const sp = await searchParams;
  const page = pageNumber(sp.page, 5000);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = STATUSES.some((s) => s.value === sp.status) ? sp.status! : "all";
  const sort = SORTS.some((s) => s.value === sp.sort) ? sp.sort! : "newest";
  const joined = status === "draft" || status === "published";
  let query = db.from("films")
    .select(`id,title,year,slug,status,poster_url,film_editorials${joined ? "!inner" : ""}(status,updated_at)`, { count: "exact" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (joined) query = query.eq("film_editorials.status", status);
  if (status === "none") query = query.is("film_editorials", null);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  query = sort === "title" ? query.order("title") : query.order("year", { ascending: sort === "oldest" }).order("title");
  const [{ data: films, count, error }, { count: drafts }, { count: published }] = await Promise.all([
    query,
    db.from("film_editorials").select("film_id", { count: "exact", head: true }).eq("status", "draft"),
    db.from("film_editorials").select("film_id", { count: "exact", head: true }).eq("status", "published"),
  ]);
  const href = (p: number) => `/admin/editorial?${new URLSearchParams({ ...(q ? { q } : {}), status, sort, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Editorial" description="Write and publish Pheelm's own essays on films. Synopses are edited with the film." />
      <Stats>
        <Stat value={published ?? 0} label="Published essays" href="/admin/editorial?status=published" />
        <Stat value={drafts ?? 0} label="Drafts" href="/admin/editorial?status=draft" />
        <Stat value="Find" label="Films without an essay" href="/admin/editorial?status=none" />
      </Stats>
      <AdminBrowserToolbar action="/admin/editorial" query={q} placeholder="Find a film to write about" filters={[
        { name: "status", label: "Essay", value: status, options: STATUSES },
        { name: "sort", label: "Sort by", value: sort, options: SORTS },
      ]} />
      {error ? <p className="notice error">Films couldn&apos;t load. Try again in a moment.</p> : (
        <>
          <p className="muted">{plural(count ?? 0, "film")}.</p>
          <ul className="film-grid admin-film-grid">
            {(films ?? []).map((f) => {
              const editorial = (Array.isArray(f.film_editorials) ? f.film_editorials[0] : f.film_editorials) as { status: string; updated_at: string } | null;
              return <FilmCard key={f.id} href={`/admin/editorial/${f.id}`} film={{
                id: f.id, slug: f.slug, title: f.title, year: f.year, poster_url: f.poster_url,
                directors: [], type: "feature", countries: [], languages: [], genres: [], runtime: null, wins: 0,
              }} controls={<div className="admin-card-controls">
                <Pill tone={TONE[editorial?.status ?? ""] ?? "neutral"}>{editorial?.status === "published" ? "Published" : editorial?.status === "draft" ? "Draft" : "No essay yet"}</Pill>
                {editorial?.updated_at && <span className="muted">Updated {day(editorial.updated_at)}</span>}
                <Link className="link-button" href={`/admin/editorial/${f.id}`}>{editorial ? "Edit essay" : "Write essay"}</Link>
              </div>} />;
            })}
          </ul>
        </>
      )}
      <Pager page={page} total={count ?? 0} size={PAGE_SIZE} href={href} />
    </>
  );
}
