import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";
import { building } from "@/lib/data";

type Editorial = { essay: string | null; sources: string | null };
const client = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// A build renders every film page; there all published editorials are read once, not one per page.
let all: Promise<Map<string, Editorial>> | null = null;
function allEditorials() {
  all ??= (async () => {
    const map = new Map<string, Editorial>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client().from("film_editorials").select("film_id,essay,sources").eq("status", "published").range(from, from + 999);
      if (error) throw error;
      for (const r of (data ?? []) as (Editorial & { film_id: string })[]) map.set(r.film_id, r);
      if (!data || data.length < 1000) return map;
    }
  })();
  return all;
}

/** Only published editorial text is public; row-level security hides drafts. */
export default async function FilmEditorial({ filmId }: { filmId: string }) {
  if (!supabaseEnabled) return null;
  const data: Editorial | null = building()
    ? (await allEditorials()).get(filmId) ?? null
    : (await client().from("film_editorials").select("essay,sources").eq("film_id", filmId).eq("status", "published").maybeSingle()).data;
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
