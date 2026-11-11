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
      <div className="admin-head"><h2 className="admin-section-heading">Submissions</h2></div>
      <div className="actions">{["pending","approved","rejected"].map(s=><Link key={s} className="button ghost small" aria-pressed={s===status} href={`/admin/submissions?status=${s}`}>{s[0].toUpperCase()+s.slice(1)}</Link>)}</div>
      <p className="muted">Approving creates a film draft to check before publishing. Compare possible matches first; review notes remain internal.</p>
      {error?<p className="notice error">Unable to load submissions.</p>:data?.length?(
        <ul className="admin-submission-list">
          {data.map(s => {
            const match = matches.get(`${canon(s.title)}|${s.year}`);
            return <li key={s.id} className="account-section">
              <div className="admin-head"><div><h3>{s.title}{s.year ? ` (${s.year})` : ""}</h3><p className="muted">{s.director}</p></div>
                {s.kind === "own" && <span className="status-pill">Own film</span>}
              </div>
              <p className="label">Sent {new Date(s.created_at).toLocaleDateString("en-GB")}</p>
              {match && <p className="notice error">Possible duplicate: <Link href={`/admin/films/${match}`}>Check existing film</Link></p>}
              {s.link && /^https?:\/\//i.test(s.link) && <a className="link-button" href={s.link} target="_blank" rel="noopener noreferrer">View film link</a>}
              {s.note && <p>{s.note}</p>}
              {s.details && <details><summary>Submitted details</summary><dl className="details">{Object.entries(s.details as Record<string, unknown>).filter(([,v]) => v).map(([k,v]) => <div key={k}><dt>{k.replace(/_/g, " ")}</dt><dd>{String(v)}</dd></div>)}</dl></details>}
              {status === "pending" ? <form action={reviewSubmission} className="settings-form">
                <input type="hidden" name="id" value={s.id} />
                <label className="field">Staff note <span className="hint">optional</span><textarea name="review_note" rows={2} defaultValue={s.review_note ?? ""} /></label>
                <div className="actions"><button className="button small" name="decision" value="approve">Approve</button><button className="button ghost small" name="decision" value="reject">Reject</button></div>
              </form> : <p className="muted">{s.review_note || "No review note"}</p>}
            </li>;
          })}
        </ul>
      ):<p className="empty">Nothing {status}.</p>}
      {(data??[]).length>=100&&<p className="muted">Showing the 100 most recent submissions in this category.</p>}
    </>
  );
}
