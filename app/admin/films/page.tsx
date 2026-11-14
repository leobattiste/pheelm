import Link from "next/link";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import AdminMenu from "../AdminMenu";
import { AdminSelectionProvider, AdminSelectionTools } from "../AdminSelectionBar";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "../ui";
import { countryName } from "@/lib/format";
import BulkControls, { type AdminFilmRow } from "./BulkControls";
import { bulkFilmChange } from "./bulk-actions";

type Params = {
  status?: string; missing?: string; q?: string; type?: string; featured?: string;
  country?: string; genre?: string; decade?: string; sort?: string;
  page?: string; limit?: string; updated?: string; error?: string;
};

const SIZES = ["20", "40", "80", "all"];
const TYPES = ["feature", "documentary", "short", "animation"];
const SORTS = ["newest", "oldest", "title", "recent", "added"];
// What a film can be missing. "any" is any of the first six.
const BLANK = (column: string) => `${column}.is.null,${column}.eq.`;
const MISSING: Record<string, { label: string; or: string }> = {
  poster: { label: "Missing poster", or: BLANK("poster_url") },
  backdrop: { label: "Missing backdrop image", or: BLANK("backdrop_url") },
  synopsis: { label: "Missing synopsis", or: BLANK("synopsis") },
  trailer: { label: "Missing trailer", or: BLANK("trailer_url") },
  runtime: { label: "Missing runtime", or: "runtime.is.null" },
  genres: { label: "Missing genres", or: "genres.cd.{}" },
  countries: { label: "Missing country", or: "countries.cd.{}" },
  languages: { label: "Missing language", or: "languages.cd.{}" },
  watch: { label: "Missing where to watch", or: "watch.eq.[]" },
  tmdb: { label: "Not linked to TMDB", or: "tmdb_id.is.null" },
};
const MISSING_ANY = ["poster", "synopsis", "trailer", "runtime", "genres", "countries"].map((k) => MISSING[k].or).join(",");

export default async function AdminFilms({ searchParams }: { searchParams: Promise<Params> }) {
  const { db, user, owner } = await requireAdmin("/admin/films");
  const sp = await searchParams;
  const size = SIZES.includes(sp.limit ?? "") ? sp.limit! : "40";
  const page = size === "all" ? 1 : Math.max(1, Math.min(5000, Number.parseInt(sp.page ?? "1", 10) || 1));
  const perPage = size === "all" ? 500 : Number(size);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const sort = SORTS.includes(sp.sort ?? "") ? sp.sort! : "newest";
  const status = ["draft", "published"].includes(sp.status ?? "") ? sp.status! : "";
  const type = TYPES.includes(sp.type ?? "") ? sp.type! : "";
  const missing = sp.missing === "any" || sp.missing! in MISSING ? sp.missing! : "";
  const featured = ["yes", "no"].includes(sp.featured ?? "") ? sp.featured! : "";
  const decade = /^\d{4}$/.test(sp.decade ?? "") ? Number(sp.decade) : null;
  const country = /^[A-Za-z]{2}$/.test(sp.country ?? "") ? sp.country!.toUpperCase() : "";
  const genre = (sp.genre ?? "").trim().slice(0, 60);

  const build = () => {
    let query = db.from("films")
      .select("id,slug,title,year,type,status,poster_url,featured,tmdb_id,credits(role,people(name))", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    if (missing === "any") query = query.or(MISSING_ANY);
    else if (missing) query = query.or(MISSING[missing].or);
    if (featured) query = query.eq("featured", featured === "yes");
    if (country) query = query.contains("countries", [country]);
    if (genre) query = query.contains("genres", [genre]);
    if (decade !== null) query = query.gte("year", decade).lt("year", decade + 10);
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
    if (sort === "oldest") return query.order("year", { ascending: true }).order("title");
    if (sort === "title") return query.order("title", { ascending: true });
    if (sort === "added") return query.order("created_at", { ascending: false }).order("title");
    if (sort === "recent") return query.order("updated_at", { ascending: false }).order("title");
    return query.order("year", { ascending: false }).order("title");
  };

  const load = async () => {
    const first = await build().range(size === "all" ? 0 : (page - 1) * perPage, size === "all" ? 499 : page * perPage - 1);
    if (first.error || size !== "all") return first;
    const rows = [...(first.data ?? [])];
    const count = first.count ?? rows.length;
    for (let start = 500; start < count; start += 500) {
      const next = await build().range(start, Math.min(start + 499, count - 1));
      if (next.error) return { data: rows, count, error: next.error };
      rows.push(...(next.data ?? []));
      if (!next.data?.length) break;
    }
    return { data: rows, count, error: null };
  };

  const [result, facetsResult, suggestions] = await Promise.all([
    load(),
    db.rpc("admin_film_facets"),
    db.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const { data: films, count, error } = result;
  // Every decade, country and genre in the catalog, worked out in the database.
  const facets = (facetsResult.data ?? {}) as { decades?: number[]; countries?: string[]; genres?: string[] };
  const countries = facets.countries ?? [];
  const genres = facets.genres ?? [];
  const decades = facets.decades ?? [];
  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) if (!["page", "updated", "error"].includes(key) && value) baseParams.set(key, value);
  const href = (next: number) => { const p = new URLSearchParams(baseParams); p.set("page", String(next)); return `/admin/films?${p.toString()}`; };
  const shown = films?.length ?? 0;

  return (
    <AdminSelectionProvider key="films" entity="films"><section className="admin-films">
      <PageHeader title="Films" description="Everything in the catalog. Drafts stay hidden until you publish them."
        actions={<>
          <AdminMenu>
            <Link href="/admin/submissions">Suggestions from members{!!suggestions.count && <span className="admin-count">{suggestions.count}</span>}</Link>
            <Link href="/admin/automation">Fill missing details from TMDB</Link>
          </AdminMenu>
          <Link className="button" href="/admin/films/add">Add films</Link>
        </>} />
      {!!sp.updated && <p className="notice ok" role="status">{sp.updated} films updated.</p>}
      {sp.error === "selection" && <p className="notice error">Select at least one film first.</p>}
      <AdminBrowserToolbar action="/admin/films" query={q} pageSize={size} placeholder="Search films" compact count={count ?? 0} noun="films"
        selectionControls={<AdminSelectionTools entity="films" ids={(films ?? []).map(film => film.id)} canDelete={owner} action={bulkFilmChange}/>}
        filters={[
        { name: "status", label: "Publication status", value: status, options: [{ value: "", label: "All films" }, { value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
        { name: "type", label: "Film type", value: type, options: [{ value: "", label: "All types" }, { value: "feature", label: "Feature" }, { value: "documentary", label: "Documentary" }, { value: "short", label: "Short" }, { value: "animation", label: "Animation" }] },
        { name: "decade", label: "Decade", value: decade?.toString() ?? "", options: [{ value: "", label: "All decades" }, ...decades.map((d) => ({ value: String(d), label: `${d}s` }))] },
        { name: "country", label: "Country", value: country, options: [{ value: "", label: "All countries" }, ...countries.map((code) => ({ value: code, label: countryName(code) }))] },
        { name: "genre", label: "Genre", value: genre, options: [{ value: "", label: "All genres" }, ...genres.map((value) => ({ value, label: value }))] },
        { name: "featured", label: "Featured", value: featured, options: [{ value: "", label: "All" }, { value: "yes", label: "Featured" }, { value: "no", label: "Not featured" }] },
        { name: "missing", label: "Needs fixing", value: missing, options: [{ value: "", label: "Nothing in particular" }, { value: "any", label: "Missing any key detail" }, ...Object.entries(MISSING).map(([value, m]) => ({ value, label: m.label }))] },
        { name: "sort", label: "Sort by", value: sort, options: [{ value: "newest", label: "Newest releases" }, { value: "oldest", label: "Oldest releases" }, { value: "title", label: "Title A–Z" }, { value: "recent", label: "Recently updated" }, { value: "added", label: "Latest added" }] },
      ]} />
      {error ? <p className="notice error">Could not load films. Try again.</p> : (
        <BulkControls films={(films ?? []) as unknown as AdminFilmRow[]} canDelete={owner} />
      )}
      {!shown && !error && <p className="empty">No films match your filters.</p>}
      {size !== "all" && <div className="actions admin-pagination">
        {page > 1 && <Link className="button ghost small" href={href(page - 1)}>Previous</Link>}
        <span className="muted">Page {page} of {Math.max(1, Math.ceil((count ?? 0) / perPage))}</span>
        {page * perPage < (count ?? 0) && <Link className="button ghost small" href={href(page + 1)}>Next</Link>}
      </div>}

    </section></AdminSelectionProvider>
  );
}
