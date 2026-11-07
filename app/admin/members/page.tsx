import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { setAdmin } from "../actions";

type Row={
  id:string;handle:string|null;display_name:string|null;email:string|null;created_at:string;last_seen:string|null;
  is_admin:boolean;is_owner:boolean;is_private:boolean;lists:number;saved:number;comments:number;
};
const day=(iso:string|null)=>iso?new Date(iso).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Never";
const SIZE=40;

export default async function AdminMembers({searchParams}:{searchParams:Promise<{q?:string;segment?:string;page?:string}>}){
  const {db,owner}=await requireAdmin("/admin/members");
  const {data,error}=await db.rpc("admin_members");
  if(error)return <><div className="admin-head"><h1>Members</h1></div><p className="notice error">Unable to load members.</p></>;
  const rows=(data??[]) as Row[];
  const sp=await searchParams;
  const q=(sp.q??"").trim().toLowerCase().slice(0,100);
  const segment=["admins","new","active","inactive"].includes(sp.segment??"")?sp.segment!:"all";
  const week=Date.now()-7*86400000;
  const month=Date.now()-30*86400000;
  const filtered=rows.filter(r=>{
    const matches=!q||[r.handle,r.display_name,...(owner?[r.email]:[])].some(x=>x?.toLowerCase().includes(q));
    const group=segment==="all"||(segment==="admins"&&r.is_admin)||(segment==="new"&&new Date(r.created_at).getTime()>=week)
      ||(segment==="active"&&!!r.last_seen&&new Date(r.last_seen).getTime()>=month)
      ||(segment==="inactive"&&(!r.last_seen||new Date(r.last_seen).getTime()<month));
    return matches&&group;
  });
  const page=Math.max(1,Math.min(10000,Number.parseInt(sp.page??"1",10)||1));
  const pageRows=filtered.slice((page-1)*SIZE,page*SIZE);
  const href=(p:number)=>`/admin/members?${new URLSearchParams({q,segment,page:String(p)}).toString()}`;
  return (
    <>
      <div className="admin-head"><div><h1>Members</h1><p className="muted">{rows.length} members · {rows.filter(r=>r.is_admin).length} admins · {rows.filter(r=>new Date(r.created_at).getTime()>=week).length} joined this week</p></div></div>
      <form className="admin-filters" role="search">
        <label className="field">Search<input className="search-input" name="q" defaultValue={sp.q??""} placeholder={owner?"Handle, name or email":"Handle or name"}/></label>
        <label className="field">Filter<select name="segment" defaultValue={segment}><option value="all">Everyone</option><option value="admins">Admins</option><option value="new">New this week</option><option value="active">Signed in recently</option><option value="inactive">Not recently signed in</option></select></label>
        <button className="button ghost small">Filter</button><Link className="button ghost small" href="/admin/members">Reset</Link>
      </form>
      <p className="muted">{filtered.length} matching members. Only the owner can change admin roles.</p>
      <div className="table-wrap"><table className="admin-table"><thead>
        <tr><th>Member</th>{owner&&<th>Email</th>}<th>Joined</th><th>Last signed in</th><th>Collections</th><th>Saved</th><th>Comments</th><th /></tr>
      </thead><tbody>{pageRows.map(r=><tr key={r.id}>
        <td><Link href={`/admin/members/${r.id}`}>{r.handle?`@${r.handle}`:r.display_name||"No profile yet"}</Link>
          {r.is_owner?<span className="status-pill">Owner</span>:r.is_admin?<span className="status-pill">Admin</span>:null}
          {r.is_private&&<span className="status-pill">Private</span>}
        </td>
        {owner&&<td>{r.email??"—"}</td>}<td>{day(r.created_at)}</td><td>{day(r.last_seen)}</td><td>{r.lists}</td><td>{r.saved}</td><td>{r.comments}</td>
        <td>{owner&&!r.is_owner&&<form action={setAdmin}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="make" value={r.is_admin?"false":"true"}/>
        <button className="button ghost small" type="submit">{r.is_admin?"Remove admin":"Make admin"}</button></form>}</td>
      </tr>)}</tbody></table></div>
      {!pageRows.length&&<p className="empty">No matching members.</p>}
      <div className="actions admin-pagination">{page>1&&<Link className="button ghost small" href={href(page-1)}>Previous</Link>}<span className="muted">Page {page} of {Math.max(1,Math.ceil(filtered.length/SIZE))}</span>{page*SIZE<filtered.length&&<Link className="button ghost small" href={href(page+1)}>Next</Link>}</div>
    </>
  );
}
