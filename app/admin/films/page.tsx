import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createFilm } from "../actions";
import BulkAdd from "./BulkAdd";
import FilmQueue from "./FilmQueue";
import BulkControls, { type AdminFilmRow } from "./BulkControls";
import { bulkFilmChange } from "./bulk-actions";
import queue from "@/data/film-queue.json";

const PAGE_SIZE = 40;

export default async function AdminFilms({ searchParams }: { searchParams: Promise<{ status?: string; missing?: string; q?: string; type?: string; page?: string; updated?: string; error?: string }> }) {
  const { db, user } = await requireAdmin("/admin/films");
  const sp = await searchParams;
  const page = Math.max(1, Math.min(5000, Number.parseInt(sp.page ?? "1",10)||1));
  const q = (sp.q ?? "").trim().slice(0, 100);
  let query = db.from("films")
    .select("id,slug,title,year,type,status,poster_url,featured,tmdb_id,credits(role,people(name))", { count: "exact" })
    .order("year",{ascending:false}).order("title").range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  if (sp.status === "draft" || sp.status === "published") query = query.eq("status",sp.status);
  if (["feature","documentary","short","animation"].includes(sp.type??"")) query = query.eq("type",sp.type);
  if (sp.missing === "poster") query = query.is("poster_url",null);
  if (sp.missing === "synopsis") query = query.is("synopsis",null);
  if (q) query = query.ilike("title",`%${q}%`);
  const [{ data: films, count, error }, { data: collections }, { data: all }] = await Promise.all([
    query,
    db.from("lists").select("id,title").eq("user_id",user.id).order("created_at",{ascending:false}),
    page === 1 && !q ? db.from("films").select("title,year").limit(5000) : Promise.resolve({data:[] as {title:string;year:number}[]}),
  ]);
  const plain=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const have=new Map<string,number[]>();
  for(const film of all??[]) have.set(plain(film.title),[...(have.get(plain(film.title))??[]),film.year]);
  const waiting=(queue as {t:string;y:number;d:string[];n?:string}[]).filter(item=>!(have.get(plain(item.t))??[]).some(y=>Math.abs(y-item.y)<=1));
  const href=(p:number)=>`/admin/films?${new URLSearchParams({q,status:sp.status??"",type:sp.type??"",missing:sp.missing??"",page:String(p)}).toString()}`;
  return (
    <>
      <div className="admin-head"><div><h1>Films</h1><p className="muted">Manage the catalog, publication status and credits.</p></div>
        <div className="actions"><Link className="button ghost small" href="/admin/quality">Content quality</Link><Link className="button ghost small" href="/admin/automation">Automation</Link></div>
      </div>
      {!!sp.updated&&<p className="notice ok">{sp.updated} films updated.</p>}
      {sp.error==="selection"&&<p className="notice error">Select at least one film first.</p>}
      <details className="admin-toolbox"><summary className="button ghost small">Add or import films</summary>
        <div className="admin-toolbox-body">
          <form action={createFilm} className="fieldset form">
            <h2>Add a film</h2>
            <div className="form-row"><label className="field">Title<input name="title" required/></label>
            <label className="field">Year<input name="year" inputMode="numeric" pattern="[0-9]{4}" required/></label>
            <label className="field">Director<input name="director" required/></label>
            <label className="field">TMDB id <span className="hint">optional</span><input name="tmdb_id" inputMode="numeric"/></label></div>
            <div className="actions"><button className="button">Create draft</button></div>
          </form>
          {page === 1 && !q && <FilmQueue items={waiting} />}
          <BulkAdd collections={collections??[]} />
        </div>
      </details>
      <form className="admin-filters" role="search">
        <label className="field">Search<input name="q" className="search-input" defaultValue={q} placeholder="Film title" /></label>
        <label className="field">Status<select name="status" defaultValue={sp.status??""}><option value="">All</option><option value="published">Published</option><option value="draft">Drafts</option></select></label>
        <label className="field">Type<select name="type" defaultValue={sp.type??""}><option value="">All</option><option value="feature">Feature</option><option value="documentary">Documentary</option><option value="short">Short</option><option value="animation">Animation</option></select></label>
        <label className="field">Missing<select name="missing" defaultValue={sp.missing??""}><option value="">Any</option><option value="poster">Poster</option><option value="synopsis">Synopsis</option></select></label>
        <button className="button ghost small">Filter</button>
        <Link className="button ghost small" href="/admin/films">Reset</Link>
      </form>
      <p className="muted">{count??0} matching films.</p>
      {error ? <p className="notice error">Could not load films. Try again.</p> : (
        <form action={bulkFilmChange}>
          <BulkControls films={(films??[]) as unknown as AdminFilmRow[]} />
        </form>
      )}
      {!films?.length&&!error&&<p className="empty">No films match your filters.</p>}
      <div className="actions admin-pagination">
        {page>1&&<Link className="button ghost small" href={href(page-1)}>Previous</Link>}
        <span className="muted">Page {page} of {Math.max(1,Math.ceil((count??0)/PAGE_SIZE))}</span>
        {page*PAGE_SIZE<(count??0)&&<Link className="button ghost small" href={href(page+1)}>Next</Link>}
      </div>
    </>
  );
}
