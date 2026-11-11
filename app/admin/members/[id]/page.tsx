import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { setAdmin } from "../../actions";

type Row={id:string;handle:string|null;display_name:string|null;email:string|null;created_at:string;last_seen:string|null;is_admin:boolean;is_owner:boolean;is_private:boolean;lists:number;saved:number;comments:number};
export default async function MemberDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {db,owner}=await requireAdmin(`/admin/members/${id}`);
  const {data:members,error}=await db.rpc("admin_members");
  if(error)throw new Error("Cannot load member record.");
  const person=((members??[]) as Row[]).find(m=>m.id===id);
  if(!person)notFound();
  const [{data:collections},{data:comments},{data:history}]=await Promise.all([
    db.from("lists").select("id,title,is_public,hidden,created_at").eq("user_id",id).order("created_at",{ascending:false}).limit(20),
    db.from("list_comments").select("id,body,list_id,created_at").eq("user_id",id).order("created_at",{ascending:false}).limit(15),
    db.from("admin_activity").select("id,action,created_at,details").eq("target_type","member").eq("target_id",id).order("created_at",{ascending:false}).limit(10),
  ]);
  return (
    <>
      <div className="admin-head">
        <div><p className="muted"><Link href="/admin/members">Members</Link></p><h2 className="admin-section-heading">{person.display_name||person.handle||"Member"}</h2>
        {person.handle&&<p className="muted">@{person.handle}</p>}</div>
        <div className="actions">{person.handle&&<Link className="button ghost small" href={`/@${person.handle}`}>View profile</Link>}
          {owner&&!person.is_owner&&<form action={setAdmin}><input type="hidden" name="id" value={id}/><input type="hidden" name="make" value={person.is_admin?"false":"true"}/>
          <button className="button ghost small">{person.is_admin?"Remove admin":"Make admin"}</button></form>}</div>
      </div>
      <div className="stats">
        <div className="stat"><strong>{person.lists}</strong><span>Watchlists</span></div>
        <div className="stat"><strong>{person.saved}</strong><span>Saved watchlists</span></div>
        <div className="stat"><strong>{person.comments}</strong><span>Comments</span></div>
      </div>
      <section className="fieldset"><h2>Account</h2><dl className="details">
        {owner&&<div><dt>Email</dt><dd>{person.email??"—"}</dd></div>}
        <div><dt>Joined</dt><dd>{new Date(person.created_at).toLocaleDateString("en-US")}</dd></div>
        <div><dt>Last signed in</dt><dd>{person.last_seen?new Date(person.last_seen).toLocaleDateString("en-US"):"Never"}</dd></div>
        <div><dt>Role</dt><dd>{person.is_owner?"Owner":person.is_admin?"Admin":"Member"}</dd></div>
        <div><dt>Profile</dt><dd>{person.is_private?"Private":"Public"}</dd></div>
      </dl></section>
      <section className="fieldset"><h2>Recent watchlists</h2>
        {(collections??[]).length?collections!.map(c=><div className="admin-attention-row" key={c.id}><Link href={`/c/${c.id}`}>{c.title}</Link><span className="muted">{c.hidden?"Hidden":c.is_public?"Public":"Private"}</span></div>):<p className="muted">No accessible watchlists.</p>}
      </section>
      <section className="fieldset"><h2>Recent comments</h2>
        {(comments??[]).length?comments!.map(c=><div className="admin-attention-row" key={c.id}><Link href={`/c/${c.list_id}#comment-${c.id}`}>{c.body.slice(0,120)}</Link><span className="muted">{new Date(c.created_at).toLocaleDateString("en-US")}</span></div>):<p className="muted">No comments.</p>}
      </section>
      <section className="fieldset"><h2>Role history</h2>
        {(history??[]).length?history!.map(h=><div className="admin-attention-row" key={h.id}><span>{h.action}</span><span className="muted">{new Date(h.created_at).toLocaleDateString("en-US")}</span></div>):<p className="muted">No recorded changes.</p>}
      </section>
    </>
  );
}
