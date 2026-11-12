import Link from "next/link";
import FilmCard from "@/components/FilmCard";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";
import { PageHeader, Pager, Stat, Stats, pageNumber } from "../ui";

const PAGE_SIZE=40;
export default async function EditorialPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}) {
  const {db}=await requireAdmin("/admin/editorial");
  const sp=await searchParams;
  const page=pageNumber(sp.page,5000);
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
      <PageHeader title="Editorial" description="Write and publish Pheelm's own essays on films. Synopses are edited with the film." />
      <Stats><Stat value={published??0} label="Published essays" /><Stat value={drafts??0} label="Drafts" /><Stat value="Find" label="Films without an essay" href="/admin/quality?issue=editorial" /></Stats>
      <AdminBrowserToolbar action="/admin/editorial" query={sp.q ?? ""} placeholder="Find a film to write about" />
      {error ? <p className="notice error">Editorial list could not be loaded.</p> : <ul className="film-grid admin-film-grid">
      {(films ?? []).map(f => {
        const editorial = (Array.isArray(f.film_editorials) ? f.film_editorials[0] : f.film_editorials) as {status:string;updated_at:string}|null;
        return <FilmCard key={f.id} href={`/admin/editorial/${f.id}`} film={{ id: f.id, slug: f.slug, title: f.title, year: f.year, poster_url: f.poster_url,
          directors: [], type: "feature", countries: [], languages: [], genres: [], runtime: null, wins: 0,
        }} controls={<div className="admin-card-controls"><span className={`status-pill ${editorial?.status ?? ""}`}>{editorial?.status ?? "Not started"}</span>
          <span className="muted">{editorial?.updated_at ? `Updated ${new Date(editorial.updated_at).toLocaleDateString("en-US")}` : "Ready for your perspective"}</span>
          <Link className="link-button" href={`/admin/editorial/${f.id}`}>Edit essay</Link>
        </div>} />;
      })}
      </ul>}
      <Pager page={page} total={count??0} size={PAGE_SIZE} href={queryString} />
    </>
  );
}
