import Link from "next/link";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import AdminAddPanel from "../AdminAddPanel";
import { AdminSelectionProvider, AdminSelectionTools } from "../AdminSelectionBar";
import { requireAdmin } from "@/lib/admin";
import { PageHeader } from "../ui";
import { countryName } from "@/lib/format";
import { createFilm } from "../actions";
import BulkAdd from "./BulkAdd";
import FilmQueue from "./FilmQueue";
import BulkControls, { type AdminFilmRow } from "./BulkControls";
import { bulkFilmChange } from "./bulk-actions";
import queue from "@/data/film-queue.json";

type Params = {
  status?: string; missing?: string; q?: string; type?: string; featured?: string;
  country?: string; genre?: string; decade?: string; sort?: string;
  page?: string; limit?: string; updated?: string; error?: string;
};

const SIZES = ["20", "40", "80", "all"];
const TYPES = ["feature", "documentary", "short", "animation"];
const SORTS = ["newest", "oldest", "title", "recent"];

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
  const missing = ["poster", "synopsis"].includes(sp.missing ?? "") ? sp.missing! : "";
  const featured = ["yes", "no"].includes(sp.featured ?? "") ? sp.featured! : "";
  const decade = /^\d{4}$/.test(sp.decade ?? "") ? Number(sp.decade) : null;
  const country = /^[A-Za-z]{2}$/.test(sp.country ?? "") ? sp.country!.toUpperCase() : "";
  const genre = (sp.genre ?? "").trim().slice(0, 60);

  const build = () => {
    let query = db.from("films")
      .select("id,slug,title,year,type,status,poster_url,featured,tmdb_id,credits(role,people(name))", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    if (missing === "poster") query = query.is("poster_url", null);
    if (missing === "synopsis") query = query.is("synopsis", null);
    if (featured) query = query.eq("featured", featured === "yes");
    if (country) query = query.contains("countries", [country]);
    if (genre) query = query.contains("genres", [genre]);
    if (decade !== null) query = query.gte("year", decade).lt("year", decade + 10);
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
    if (sort === "oldest") return query.order("year", { ascending: true }).order("title");
    if (sort === "title") return query.order("title", { ascending: true });
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

  const [result, collectionsResult, allResult, facetsResult] = await Promise.all([
    load(),
    db.from("lists").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }),
    page === 1 && !q ? db.from("films").select("title,year").limit(5000) : Promise.resolve({ data: [] as { title: string; year: number }[] }),
    db.rpc("admin_film_facets"),
  ]);
  const { data: films, count, error } = result;
  const all = allResult.data ?? [];
  const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const have = new Map<string, number[]>();
  for (const film of all) have.set(plain(film.title), [...(have.get(plain(film.title)) ?? []), film.year]);
  const waiting = (queue as { t: string; y: number; d: string[]; n?: string }[])
    .filter((item) => !(have.get(plain(item.t)) ?? []).some((year) => Math.abs(year - item.y) <= 1));
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
      <PageHeader title="Films" description="Add, import, edit and publish films. Drafts stay hidden until you publish them." />
      {!!sp.updated && <p className="notice ok" role="status">{sp.updated} films updated.</p>}
      {sp.error === "selection" && <p className="notice error">Select at least one film first.</p>}
      <AdminBrowserToolbar action="/admin/films" query={q} pageSize={size} placeholder="Search films" compact count={count ?? 0} noun="films"
        addControl={<AdminAddPanel label="Add or import films">
          <div className="admin-toolbox-body">
          <form action={createFilm} className="fieldset form">
            <h2>Add a film</h2>
            <div className="form-row">
              <label className="field">Title<input name="title" required /></label>
              <label className="field">Year<input name="year" inputMode="numeric" pattern="[0-9]{4}" required /></label>
              <label className="field">Director<input name="director" required /></label>
              <label className="field">TMDB id <span className="hint">optional</span><input name="tmdb_id" inputMode="numeric" /></label>
            </div>
            <div className="actions"><button className="button">Create draft</button></div>
          </form>
          {page === 1 && !q && <FilmQueue items={waiting} />}
          <BulkAdd collections={collectionsResult.data ?? []} />
        </div>
        </AdminAddPanel>}
        panelTools={<><Link className="button ghost" href="/admin/quality">Content quality</Link><Link className="button ghost" href="/admin/automation">Automation</Link></>}
        selectionControls={<AdminSelectionTools entity="films" ids={(films ?? []).map(film => film.id)} canDelete={owner} action={bulkFilmChange}/>}
        filters={[
        { name: "status", label: "Publication status", value: status, options: [{ value: "", label: "All films" }, { value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
        { name: "type", label: "Film type", value: type, options: [{ value: "", label: "All types" }, { value: "feature", label: "Feature" }, { value: "documentary", label: "Documentary" }, { value: "short", label: "Short" }, { value: "animation", label: "Animation" }] },
        { name: "decade", label: "Decade", value: decade?.toString() ?? "", options: [{ value: "", label: "All decades" }, ...decades.map((d) => ({ value: String(d), label: `${d}s` }))] },
        { name: "country", label: "Country", value: country, options: [{ value: "", label: "All countries" }, ...countries.map((code) => ({ value: code, label: countryName(code) }))] },
        { name: "genre", label: "Genre", value: genre, options: [{ value: "", label: "All genres" }, ...genres.map((value) => ({ value, label: value }))] },
        { name: "featured", label: "Featured", value: featured, options: [{ value: "", label: "All" }, { value: "yes", label: "Featured" }, { value: "no", label: "Not featured" }] },
        { name: "missing", label: "Incomplete records", value: missing, options: [{ value: "", label: "Any" }, { value: "poster", label: "Missing poster" }, { value: "synopsis", label: "Missing synopsis" }] },
        { name: "sort", label: "Sort by", value: sort, options: [{ value: "newest", label: "Newest releases" }, { value: "oldest", label: "Oldest releases" }, { value: "title", label: "Title A–Z" }, { value: "recent", label: "Recently updated" }] },
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
