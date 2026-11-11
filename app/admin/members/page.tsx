import Link from "next/link";
import DirectorCard from "@/components/DirectorCard";
import AdminBrowserToolbar from "../AdminBrowserToolbar";
import { requireAdmin } from "@/lib/admin";
import { setAdmin } from "../actions";

type Row={
  id:string;handle:string|null;display_name:string|null;email:string|null;created_at:string;last_seen:string|null;
  is_admin:boolean;is_owner:boolean;is_private:boolean;lists:number;saved:number;comments:number;
};
const day=(iso:string|null)=>iso?new Date(iso).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"}):"Never";
const SIZE=40;

export default async function AdminMembers({searchParams}:{searchParams:Promise<{q?:string;segment?:string;page?:string}>}){
  const {db,owner}=await requireAdmin("/admin/members");
  const {data,error}=await db.rpc("admin_members");
  if(error)return <><div className="admin-head"><h2 className="admin-section-heading">Members</h2></div><p className="notice error">Unable to load members.</p></>;
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
  const { data: photos } = await db.from("profiles").select("id, avatar_url").in("id", pageRows.map(r => r.id));
  const photoById = new Map((photos ?? []).map(p => [p.id, p.avatar_url as string | null]));
  const href=(p:number)=>`/admin/members?${new URLSearchParams({q,segment,page:String(p)}).toString()}`;
  return (
    <>
      <div className="admin-head"><div><h2 className="admin-section-heading">Members</h2><p className="muted">{rows.length} members · {rows.filter(r=>r.is_admin).length} admins · {rows.filter(r=>new Date(r.created_at).getTime()>=week).length} joined this week</p></div></div>
      <AdminBrowserToolbar action="/admin/members" query={sp.q ?? ""} placeholder={owner ? "Search handle, name or email" : "Search members"} filters={[
        { name: "segment", label: "Members", value: segment, options: [{ value: "all", label: "Everyone" }, { value: "admins", label: "Admins" }, { value: "new", label: "New this week" }, { value: "active", label: "Signed in recently" }, { value: "inactive", label: "Not recently signed in" }] },
      ]} />
      <p className="muted">{filtered.length} matching members. Only the owner can change admin roles.</p>
      <ul className="director-grid admin-member-grid">
        {pageRows.map(r => <DirectorCard key={r.id} href={`/admin/members/${r.id}`} showPreviews={false} director={{
          id: r.id, slug: r.id, name: r.display_name || (r.handle ? `@${r.handle}` : "No profile yet"),
          country: null, photo_url: photoById.get(r.id) ?? null, films: 0, first: 0, last: 0, previews: [],
        }} meta={r.handle ? `@${r.handle}` : "Member"} footer={
          <div className="admin-card-controls">
            <div className="admin-tags">{r.is_owner ? <span className="status-pill">Owner</span> : r.is_admin ? <span className="status-pill">Admin</span> : <span className="status-pill">Member</span>}{r.is_private && <span className="status-pill">Private</span>}</div>
            {owner && r.email && <p className="muted">{r.email}</p>}
            <dl className="admin-member-stats"><div><dt>Watchlists</dt><dd>{r.lists}</dd></div><div><dt>Saved</dt><dd>{r.saved}</dd></div><div><dt>Comments</dt><dd>{r.comments}</dd></div></dl>
            <p className="muted">Joined {day(r.created_at)}<br />Last signed in: {day(r.last_seen)}</p>
            <div className="actions"><Link className="link-button" href={`/admin/members/${r.id}`}>View member</Link>
              {owner && !r.is_owner && <form action={setAdmin}><input type="hidden" name="id" value={r.id}/><input type="hidden" name="make" value={r.is_admin ? "false" : "true"}/><button className="button ghost small" type="submit">{r.is_admin ? "Remove admin" : "Make admin"}</button></form>}
            </div>
          </div>
        } />)}
      </ul>
      {!pageRows.length&&<p className="empty">No matching members.</p>}
      <div className="actions admin-pagination">{page>1&&<Link className="button ghost small" href={href(page-1)}>Previous</Link>}<span className="muted">Page {page} of {Math.max(1,Math.ceil(filtered.length/SIZE))}</span>{page*SIZE<filtered.length&&<Link className="button ghost small" href={href(page+1)}>Next</Link>}</div>
    </>
  );
}
