import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { reviewSubmission } from "../actions";

export default async function AdminSubmissions({searchParams}:{searchParams:Promise<{status?:string}>}){
  const {db}=await requireAdmin("/admin/submissions");
  const raw=(await searchParams).status??"pending";
  const status=["pending","approved","rejected"].includes(raw)?raw:"pending";
  const [{data,error},{data:known}]=await Promise.all([
    db.from("submissions").select("*").eq("status",status).order("created_at",{ascending:false}).limit(100),
    db.from("films").select("id,title,year").limit(2000),
  ]);
  const canon=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const matches=new Map<string,string>();
  for(const film of known??[])matches.set(`${canon(film.title)}|${film.year}`,film.id);
  return (
    <>
      <div className="admin-head"><h1>Submissions</h1></div>
      <div className="actions">{["pending","approved","rejected"].map(s=><Link key={s} className="button ghost small" aria-pressed={s===status} href={`/admin/submissions?status=${s}`}>{s[0].toUpperCase()+s.slice(1)}</Link>)}</div>
      <p className="muted">Approving creates a film draft to check before publishing. Compare possible matches first; review notes remain internal.</p>
      {error?<p className="notice error">Unable to load submissions.</p>:data?.length?(
        <div className="table-wrap"><table className="admin-table">
          <thead><tr><th>Film</th><th>Director</th><th>Year</th><th>Link</th><th>Submitted details</th><th>Sent</th><th>Review</th></tr></thead>
          <tbody>{data.map(s=>{
            const match=matches.get(`${canon(s.title)}|${s.year}`);
            return <tr key={s.id}>
              <td><strong>{s.title}</strong>{s.kind==="own"&&<span className="status-pill">Own film</span>}
                {match&&<p className="notice error">Possible duplicate: <Link href={`/admin/films/${match}`}>Check existing film</Link></p>}
              </td>
              <td>{s.director}</td><td>{s.year??"—"}</td>
              <td>{s.link&&<a href={s.link} target="_blank" rel="noopener noreferrer">Open</a>}</td>
              <td>{s.note&&<p>{s.note}</p>}{s.details&&<details><summary>Details</summary><dl className="details">
                {Object.entries(s.details as Record<string,unknown>).filter(([,v])=>v).map(([k,v])=><div key={k}><dt>{k.replace(/_/g," ")}</dt><dd>{String(v)}</dd></div>)}
              </dl></details>}</td>
              <td>{new Date(s.created_at).toLocaleDateString("en-GB")}</td>
              <td>{status==="pending"?<form action={reviewSubmission} className="form">
                <input type="hidden" name="id" value={s.id}/>
                <label className="field">Staff note <span className="hint">optional</span><textarea name="review_note" rows={2} defaultValue={s.review_note??""}/></label>
                <div className="actions"><button className="button small" name="decision" value="approve">Approve</button><button className="button ghost small" name="decision" value="reject">Reject</button></div>
              </form>:<span className="muted">{s.review_note||"No review note"}</span>}</td>
            </tr>;
          })}</tbody>
        </table></div>
      ):<p className="empty">Nothing {status}.</p>}
      {(data??[]).length>=100&&<p className="muted">Showing the 100 most recent submissions in this category.</p>}
    </>
  );
}
