import Link from "next/link";
import FilmCard from "@/components/FilmCard";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";

const PAGE_SIZE=40;
export default async function EditorialPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}) {
  const {db}=await requireAdmin("/admin/editorial");
  const sp=await searchParams;
  const page=Math.max(1, Math.min(5000,Number.parseInt(sp.page??"1",10)||1));
  let query=db.from("films").select("id,title,year,slug,status,poster_url,film_editorials(status,updated_at)",{count:"exact"})
    .order("year",{ascending:false}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  if(sp.q) query=query.ilike("title",`%${sp.q.slice(0,100)}%`);
  const [{data:films,count,error},{count:drafts},{count:published}]=await Promise.all([
    query,
    db.from("film_editorials").select("film_id",{count:"exact",head:true}).eq("status","draft"),
    db.from("film_editorials").select("film_id",{count:"exact",head:true}).eq("status","published"),
  ]);
  const queryString=(p:number)=>`/admin/editorial?page=${p}&q=${encodeURIComponent(sp.q??"")}`;
  return (
    <>
      <div className="admin-head"><div><h2 className="admin-section-heading">Editorial</h2><p className="muted">Write, review and publish original film perspectives. Synopses stay in the film editor.</p></div><Link className="button ghost small" href="/admin/quality?issue=editorial">Essays needed</Link></div>
      <div className="stats"><div className="stat"><strong>{published??0}</strong><span>Published essays</span></div><div className="stat"><strong>{drafts??0}</strong><span>Draft essays</span></div><Link className="stat" href="/admin/quality?issue=editorial"><strong>Review</strong><span>Films without a published essay</span></Link></div>
      <AdminBrowserToolbar action="/admin/editorial" query={sp.q ?? ""} placeholder="Find a film to write about" />
      {error ? <p className="notice error">Editorial list could not be loaded.</p> : <ul className="film-grid admin-film-grid">
      {(films ?? []).map(f => {
        const editorial = (Array.isArray(f.film_editorials) ? f.film_editorials[0] : f.film_editorials) as {status:string;updated_at:string}|null;
        return <FilmCard key={f.id} href={`/admin/editorial/${f.id}`} film={{ id: f.id, slug: f.slug, title: f.title, year: f.year, poster_url: f.poster_url,
          directors: [], type: "feature", countries: [], languages: [], genres: [], runtime: null, wins: 0,
        }} controls={<div className="admin-card-controls"><span className={`status-pill ${editorial?.status ?? ""}`}>{editorial?.status ?? "Not started"}</span>
          <span className="muted">{editorial?.updated_at ? `Updated ${new Date(editorial.updated_at).toLocaleDateString("en-GB")}` : "Ready for your perspective"}</span>
          <Link className="link-button" href={`/admin/editorial/${f.id}`}>Edit essay</Link>
        </div>} />;
      })}
      </ul>}
      <div className="actions admin-pagination">{page>1&&<Link className="button ghost small" href={queryString(page-1)}>Previous</Link>}<span className="muted">Page {page} of {Math.max(1,Math.ceil((count??0)/PAGE_SIZE))}</span>{page*PAGE_SIZE<(count??0)&&<Link className="button ghost small" href={queryString(page+1)}>Next</Link>}</div>
    </>
  );
}
