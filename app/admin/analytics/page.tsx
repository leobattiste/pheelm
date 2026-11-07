import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

type Stamp={created_at:string};
const metricTables=[["films","Films"],["profiles","Members"],["lists","Collections"],["list_saves","Collection saves"]] as const;
export default async function AnalyticsPage(){
  const {db}=await requireAdmin("/admin/analytics");
  const now=new Date();
  const begin=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5,1));
  async function recent(table:string):Promise<Stamp[]>{
    const out:Stamp[]=[];
    for(let offset=0;offset<20000;offset+=1000){
      const {data,error}=await db.from(table).select("created_at").gte("created_at",begin.toISOString()).order("created_at").range(offset,offset+999);
      if(error) return out;
      out.push(...(data??[]));
      if(!data||data.length<1000)break;
    }
    return out;
  }
  const [rows,topSaves,watched]=await Promise.all([
    Promise.all(metricTables.map(([table])=>recent(table))),
    db.from("list_save_counts").select("list_id,saves").order("saves",{ascending:false}).limit(6),
    db.from("watched").select("film_id",{count:"exact",head:true}),
  ]);
  const months=Array.from({length:6},(_,i)=>new Date(Date.UTC(begin.getUTCFullYear(),begin.getUTCMonth()+i,1)));
  const timeline=months.map(month=>{
    const key=month.toISOString().slice(0,7);
    return {key,label:month.toLocaleDateString("en-US",{month:"short",year:"2-digit",timeZone:"UTC"}),values:rows.map(records=>records.filter(r=>r.created_at.slice(0,7)===key).length)};
  });
  const max=Math.max(1,...timeline.flatMap(m=>m.values));
  const ids=(topSaves.data??[]).map(s=>s.list_id);
  const {data:topLists}=ids.length?await db.from("lists").select("id,title").in("id",ids):{data:[] as {id:string;title:string}[]};
  const labels=new Map((topLists??[]).map(l=>[l.id,l.title]));
  return (
    <>
      <div className="admin-head"><div><h2 className="admin-section-heading">Analytics</h2><p className="muted">Platform activity from first-party records. No visitor tracking is added.</p></div><Link className="button ghost small" href="/admin/activity">Admin activity</Link></div>
      <div className="stats">
        {metricTables.map(([,label],i)=><div className="stat" key={label}><strong>{rows[i].length}</strong><span>{label} in the last six months</span></div>)}
        <div className="stat"><strong>{watched.count??0}</strong><span>Films marked watched · all time</span></div>
      </div>
      <section className="account-section">
        <h2>Six-month activity</h2>
        <p className="muted">New records per month, not page views or unique visitors.</p>
        <div className="admin-chart" role="img" aria-label="Monthly record creation for films, members, collections and collection saves">
          {timeline.map(month=><div className="admin-chart-group" key={month.key}>
            <div className="admin-chart-bars">{month.values.map((value,i)=><div key={i} className={`admin-chart-bar admin-chart-bar-${i}`} style={{height:`${Math.max(value?6:2,Math.round(value/max*100))}%`}} title={`${metricTables[i][1]}: ${value}`}/>)}</div>
            <span className="muted">{month.label}</span>
          </div>)}
        </div>
        <div className="admin-chart-legend">{metricTables.map(([,label],i)=><span key={label}><i className={`admin-chart-key admin-chart-bar-${i}`}/>{label}</span>)}</div>
      </section>
      <section className="account-section">
        <h2>Most-saved community collections</h2>
        {(topSaves.data??[]).length?(topSaves.data??[]).map(s=><div className="admin-attention-row" key={s.list_id}>
          <Link href={`/c/${s.list_id}`}>{labels.get(s.list_id)??"Collection"}</Link><span className="muted">{s.saves} saves</span>
        </div>):<p className="muted">No collection saves yet.</p>}
      </section>
      <p className="muted">These metrics use content and community records. Traffic, visitor location and page-view analytics are deliberately not collected here.</p>
    </>
  );
}
