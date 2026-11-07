import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { tmdbEnabled } from "@/lib/tmdb";

export default async function AdminHome() {
  const {db}=await requireAdmin("/admin");
  const count=async(table:string,filter?:(q:any)=>any)=>{
    let q=db.from(table).select("id",{count:"exact",head:true});
    if(filter) q=filter(q);
    const result=await q;
    return result.count??0;
  };
  const now=new Date();
  const weekAgo=new Date(now.getTime()-7*86400000).toISOString();
  const [films,drafts,people,members,newMembers,submissions,openReports,commentReports,missingPosters,missingDirectors,missingEssays,recent,activity]=await Promise.all([
    count("films",q=>q.eq("status","published")),
    count("films",q=>q.eq("status","draft")),
    count("people"),
    count("profiles"),
    count("profiles",q=>q.gte("created_at",weekAgo)),
    count("submissions",q=>q.eq("status","pending")),
    count("list_reports",q=>q.eq("resolved",false)),
    count("comment_reports",q=>q.eq("resolved",false)),
    count("admin_film_quality",q=>q.contains("issues",["poster"])),
    count("admin_film_quality",q=>q.contains("issues",["director"])),
    count("admin_film_quality",q=>q.contains("issues",["editorial"])),
    db.from("films").select("id,title,year,status,updated_at").order("updated_at",{ascending:false}).limit(6),
    db.from("admin_activity").select("id,action,target_type,details,created_at").order("created_at",{ascending:false}).limit(6),
  ]);
  const tasks=[
    {name:"Film drafts",count:drafts,href:"/admin/films?status=draft"},
    {name:"Film submissions",count:submissions,href:"/admin/submissions"},
    {name:"Community reports",count:openReports+commentReports,href:"/admin/community"},
    {name:"Films without posters",count:missingPosters,href:"/admin/quality?issue=poster"},
    {name:"Films without directors",count:missingDirectors,href:"/admin/quality?issue=director"},
    {name:"Essays to publish",count:missingEssays,href:"/admin/quality?issue=editorial"},
  ];
  return (
    <>
      <div className="admin-head"><div><h1>Overview</h1><p className="muted">Your catalog, community and editorial work at a glance.</p></div><div className="actions">
        <Link className="button ghost small" href="/admin/films">Manage films</Link><Link className="button ghost small" href="/admin/automation">Run automation</Link>
      </div></div>
      <div className="stats">
        <Link className="stat" href="/admin/films?status=published"><strong>{films}</strong><span>Published films</span></Link>
        <Link className="stat" href="/admin/people"><strong>{people}</strong><span>People</span></Link>
        <Link className="stat" href="/admin/members"><strong>{members}</strong><span>Members · {newMembers} new this week</span></Link>
        <Link className="stat" href="/admin/community"><strong>{openReports+commentReports}</strong><span>Open reports</span></Link>
      </div>
      <div className="admin-overview-grid">
        <section className="fieldset">
          <h2>Needs attention</h2>
          {tasks.map(t=><Link className="admin-attention-row" href={t.href} key={t.name}><span>{t.name}</span><strong>{t.count}</strong></Link>)}
        </section>
        <section className="fieldset">
          <h2>Recently updated films</h2>
          {recent.data?.length?recent.data.map(f=><Link className="admin-attention-row" href={`/admin/films/${f.id}`} key={f.id}>
            <span>{f.title} <span className="muted">({f.year})</span></span><span className="status-pill">{f.status}</span>
          </Link>):<p className="muted">No films yet.</p>}
        </section>
        <section className="fieldset">
          <h2>Recent admin activity</h2>
          {activity.data?.length?activity.data.map(a=><div className="admin-attention-row" key={a.id}>
            <span>{a.action}<span className="muted"> · {a.target_type}</span></span>
            <span className="muted">{new Date(a.created_at).toLocaleDateString("en-GB")}</span>
          </div>):<p className="muted">Activity will appear as changes are made.</p>}
          <Link href="/admin/activity">View activity log</Link>
        </section>
        <section className="fieldset">
          <h2>Tools</h2>
          <p className="muted">TMDB enrichment is {tmdbEnabled?"configured":"not configured"}. Automated imports are reviewed through the film editors.</p>
          <div className="actions"><Link className="button ghost small" href="/admin/quality">Content quality</Link><Link className="button ghost small" href="/admin/editorial">Editorial</Link><Link className="button ghost small" href="/admin/analytics">Analytics</Link></div>
        </section>
      </div>
    </>
  );
}
