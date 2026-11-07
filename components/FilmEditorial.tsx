import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

/** Only published editorial text is public; row-level security hides drafts. */
export default async function FilmEditorial({ filmId }: { filmId: string }) {
  if (!supabaseEnabled) return null;
  const db = createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const {data} = await db.from("film_editorials").select("essay,sources").eq("film_id",filmId).eq("status","published").maybeSingle();
  if (!data?.essay) return null;
  const sources = (data.sources ?? "").split("\n").map((s:string)=>s.trim()).filter((s:string)=>/^https?:\/\//i.test(s));
  return (
    <section className="film-section" aria-labelledby="perspective-h">
      <h2 id="perspective-h">Our perspective</h2>
      <div className="film-essay">{data.essay.split(/\n{2,}/).map((paragraph:string,index:number)=><p key={index}>{paragraph}</p>)}</div>
      {sources.length>0&&<details className="more"><summary className="button ghost small">Sources ({sources.length})</summary><ul className="admin-sources">{sources.map((url:string,i:number)=><li key={i}><a href={url} rel="noopener noreferrer" target="_blank">{url}</a></li>)}</ul></details>}
    </section>
  );
}
