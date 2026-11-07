import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

const PAGE_SIZE=50;
export default async function ActivityPage({searchParams}:{searchParams:Promise<{type?:string;page?:string}>}){
  const {db}=await requireAdmin("/admin/activity");
  const sp=await searchParams;
  const page=Math.max(1,Math.min(10000,Number.parseInt(sp.page??"1",10)||1));
  const type=["film","person","member","collection","comment","submission","message"].includes(sp.type??"")?sp.type!:"all";
  let query=db.from("admin_activity").select("id,actor_id,action,target_type,target_id,details,created_at",{count:"exact"})
    .order("created_at",{ascending:false}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  if(type!=="all")query=query.eq("target_type",type);
  const {data, count,error}=await query;
  const actors=[...new Set((data??[]).map(a=>a.actor_id).filter((v):v is string=>!!v))];
  const {data:profiles}=actors.length?await db.from("member_profiles").select("id,handle").in("id",actors):{data:[] as {id:string;handle:string|null}[]};
  const names=new Map((profiles??[]).map(p=>[p.id,p.handle]));
  const href=(p:number)=>`/admin/activity?type=${type}&page=${p}`;
  return (
    <>
      <div className="admin-head"><div><h1>Activity log</h1><p className="muted">A read-only record of changes made through admin actions.</p></div><Link className="button ghost small" href="/admin">Overview</Link></div>
      <div className="actions">
        {["all","film","person","member","collection","comment","submission","message"].map(t=><Link className="button ghost small" key={t} aria-pressed={type===t} href={`/admin/activity?type=${t}`}>{t==="all"?"All":t[0].toUpperCase()+t.slice(1)}</Link>)}
      </div>
      {error?<p className="notice error">Unable to load the admin activity log.</p>:(
        <div className="table-wrap"><table className="admin-table">
          <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Admin</th><th>Details</th></tr></thead>
          <tbody>{(data??[]).map(a=><tr key={a.id}>
            <td>{new Date(a.created_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</td>
            <td><strong>{a.action}</strong></td>
            <td>{a.target_type}</td><td>{a.actor_id?(names.get(a.actor_id)?`@${names.get(a.actor_id)}`:"Admin"):"Deleted account"}</td>
            <td className="muted">{a.details??"—"}</td>
          </tr>)}</tbody>
        </table></div>
      )}
      {!data?.length&&!error&&<p className="empty">No activity recorded yet. New changes will appear here.</p>}
      <div className="actions admin-pagination">{page>1&&<Link className="button ghost small" href={href(page-1)}>Previous</Link>}<span className="muted">Page {page} of {Math.max(1,Math.ceil((count??0)/PAGE_SIZE))}</span>{page*PAGE_SIZE<(count??0)&&<Link className="button ghost small" href={href(page+1)}>Next</Link>}</div>
    </>
  );
}
