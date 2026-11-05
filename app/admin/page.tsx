import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { tmdbEnabled } from "@/lib/tmdb";
import BulkImport from "./BulkImport";

export default async function AdminHome() {
  const { db } = await requireAdmin();
  const count = async (table: string, filter?: (q: any) => any) => {
    let q = db.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    return (await q).count ?? 0;
  };
  const [films, drafts, people, collections, articles, pending, members] = await Promise.all([
    count("films", (q) => q.eq("status", "published")),
    count("films", (q) => q.eq("status", "draft")),
    count("people"),
    count("collections"),
    count("articles"),
    count("submissions", (q) => q.eq("status", "pending")),
    count("profiles"),
  ]);
  const { data: missing } = await db.from("films").select("id, title").is("poster_url", null).order("year");

  return (
    <>
      <div className="admin-head">
        <h1>Overview</h1>
      </div>
      <div className="stats">
        <Link className="stat" href="/admin/films"><strong>{films}</strong><span>Films live</span></Link>
        <Link className="stat" href="/admin/films?status=draft"><strong>{drafts}</strong><span>Drafts</span></Link>
        <Link className="stat" href="/admin/people"><strong>{people}</strong><span>People</span></Link>
        <Link className="stat" href="/admin/collections"><strong>{collections}</strong><span>Collections</span></Link>
        <Link className="stat" href="/admin/journal"><strong>{articles}</strong><span>Journal stories</span></Link>
        <Link className="stat" href="/admin/submissions"><strong>{pending}</strong><span>Submissions to review</span></Link>
        <div className="stat"><strong>{members}</strong><span>Members</span></div>
        <Link className="stat" href="/admin/films?missing=poster"><strong>{missing?.length ?? 0}</strong><span>Films without a poster</span></Link>
      </div>

      <section className="fieldset">
        <h2>TMDB import</h2>
        {tmdbEnabled ? (
          <BulkImport films={missing ?? []} />
        ) : (
          <p className="muted">
            Off. To fill posters, synopses, cast and crew, trailers and where to watch automatically, get a free API key at
            themoviedb.org (Settings → API), add it in Vercel as <code>TMDB_API_KEY</code> and redeploy. Until then, add posters by hand in each film&rsquo;s editor.
          </p>
        )}
      </section>
    </>
  );
}
