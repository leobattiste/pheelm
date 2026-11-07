import Link from "next/link";
import DirectorCard from "@/components/DirectorCard";
import { getDirectors, toDirectorSummary } from "@/lib/data";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";
import { countryName } from "@/lib/format";

const SIZE=50;
export default async function AdminPeople({searchParams}:{searchParams:Promise<{q?:string;all?:string;missing?:string;page?:string}>}){
  const {db}=await requireAdmin("/admin/people");
  const sp=await searchParams;
  const page=Math.max(1,Math.min(10000,Number.parseInt(sp.page??"1",10)||1));
  const q=(sp.q??"").trim().slice(0,100);
  let query=db.from("admin_people_quality")
    .select("id,slug,name,country,bio,photo_url,credits,directed",{count:"exact"})
    .order("name").range((page-1)*SIZE,page*SIZE-1);
  if(!sp.all) query=query.gt("directed",0);
  if(q) query=query.ilike("name",`%${q}%`);
  if(sp.missing==="bio") query=query.or("bio.is.null,bio.eq.");
  if(sp.missing==="photo") query=query.or("photo_url.is.null,photo_url.eq.");
  const [{data:people,count,error}, directors] = await Promise.all([query, getDirectors().catch(() => [])]);
  const summaries = new Map(directors.map(d => [d.id, toDirectorSummary(d)]));
  const href=(p:number)=>`/admin/people?${new URLSearchParams({q,all:sp.all??"",missing:sp.missing??"",page:String(p)}).toString()}`;
  return (
    <>
      <div className="admin-head"><div><h2 className="admin-section-heading">{sp.all?"Directors & people":"Directors"}</h2><p className="muted">Edit biographical details, portraits and filmography connections.</p></div><Link className="button ghost small" href="/admin/quality">Content quality</Link></div>
      <AdminBrowserToolbar action="/admin/people" query={q} placeholder="Search directors and people" filters={[
        { name: "all", label: "Show", value: sp.all ?? "", options: [{ value: "", label: "Directors" }, { value: "1", label: "Everyone" }] },
        { name: "missing", label: "Incomplete records", value: sp.missing ?? "", options: [{ value: "", label: "All records" }, { value: "bio", label: "Missing biography" }, { value: "photo", label: "Missing portrait" }] },
      ]} />
      <div className="actions">
        <Link aria-pressed={!sp.all} className="button ghost small" href="/admin/people">Directors</Link>
        <Link aria-pressed={!!sp.all} className="button ghost small" href="/admin/people?all=1">Everyone</Link>
      </div>
      <p className="muted">{count??0} matching people.</p>
      {error?<p className="notice error">Could not load people. Check the admin database upgrade.</p>:(
        <ul className="director-grid">
          {(people ?? []).map(p => <DirectorCard key={p.id} href={`/admin/people/${p.id}`} director={{
            id: p.id, slug: p.slug, name: p.name, country: p.country, photo_url: p.photo_url,
            films: p.directed, first: 0, last: 0, previews: summaries.get(p.id)?.previews ?? [],
          }} meta={`${p.country ? countryName(p.country) + " • " : ""}${p.directed} films directed`} footer={
            <div className="admin-card-controls"><span>{p.credits} credits</span><div className="admin-tags">
              {!p.bio && <span className="status-pill">Missing biography</span>}
              {!p.photo_url && <span className="status-pill">Missing portrait</span>}
            </div><Link href={`/admin/people/${p.id}`} className="link-button">Edit person</Link></div>
          } />)}
        </ul>
      )}
      {!people?.length&&!error&&<p className="empty">No matching people.</p>}
      <div className="actions admin-pagination">{page>1&&<Link className="button ghost small" href={href(page-1)}>Previous</Link>}<span className="muted">Page {page} of {Math.max(1,Math.ceil((count??0)/SIZE))}</span>{page*SIZE<(count??0)&&<Link className="button ghost small" href={href(page+1)}>Next</Link>}</div>
    </>
  );
}