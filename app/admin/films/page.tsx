import Link from "next/link";
import Poster from "@/components/Poster";
import { requireAdmin } from "@/lib/admin";
import { TYPE_LABELS } from "@/lib/format";
import type { FilmType } from "@/lib/types";
import { createFilm } from "../actions";
import BulkAdd from "./BulkAdd";
import FilmQueue from "./FilmQueue";
import queue from "@/data/film-queue.json";

export default async function AdminFilms({ searchParams }: { searchParams: Promise<{ status?: string; missing?: string; q?: string }> }) {
  const { db, user } = await requireAdmin();
  const sp = await searchParams;
  let query = db.from("films").select("id, slug, title, year, type, status, poster_url, featured, tmdb_id, credits(role, people(name))").order("year", { ascending: false }).limit(2000);
  if (sp.status === "draft") query = query.eq("status", "draft");
  if (sp.missing === "poster") query = query.is("poster_url", null);
  if (sp.q) query = query.ilike("title", `%${sp.q}%`);
  const [{ data: films }, { data: collections }, { data: all }] = await Promise.all([
    query,
    // The admin's own collections (Pheelm's collections live there since they moved to @leo).
    db.from("lists").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("films").select("title, year").limit(5000),
  ]);
  // Queued films not on the site yet (same title within a year).
  const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const have = new Map<string, number[]>();
  for (const f of all ?? []) have.set(plain(f.title), [...(have.get(plain(f.title)) ?? []), f.year]);
  const waiting = (queue as { t: string; y: number; d: string[] }[]).filter((q) => !(have.get(plain(q.t)) ?? []).some((y) => Math.abs(y - q.y) <= 1));

  return (
    <>
      <div className="admin-head">
        <h1>Films</h1>
      </div>

      <form action={createFilm} className="fieldset form">
        <h2>Add a film</h2>
        <div className="form-row">
          <label className="field">Title<input name="title" required /></label>
          <label className="field">Year<input name="year" inputMode="numeric" pattern="[0-9]{4}" required /></label>
          <label className="field">Director<input name="director" required /></label>
          <label className="field">TMDB id <span className="hint">optional</span><input name="tmdb_id" inputMode="numeric" /></label>
        </div>
        <div className="actions">
          <button className="button" type="submit">Create draft</button>
        </div>
      </form>

      <FilmQueue items={waiting} />

      <BulkAdd collections={collections ?? []} />

      <form className="actions" role="search">
        <input className="search-input" name="q" defaultValue={sp.q} placeholder="Search titles" aria-label="Search titles" />
        <button className="button ghost small" type="submit">Search</button>
        <Link className="button ghost small" href="/admin/films">All</Link>
        <Link className="button ghost small" href="/admin/films?status=draft">Drafts</Link>
        <Link className="button ghost small" href="/admin/films?missing=poster">No poster</Link>
      </form>

      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th className="thumb" /><th>Title</th><th>Director</th><th>Year</th><th>Type</th><th>Status</th><th>TMDB</th></tr>
          </thead>
          <tbody>
            {(films ?? []).map((f: any) => {
              const directors = (f.credits ?? []).filter((c: any) => c.role === "director").map((c: any) => c.people?.name).filter(Boolean);
              return (
                <tr key={f.id}>
                  <td className="thumb"><Poster title={f.title} year={f.year} directors={[]} src={f.poster_url} /></td>
                  <td><Link href={`/admin/films/${f.id}`}>{f.title}</Link>{f.featured && " ★"}</td>
                  <td>{directors.join(", ")}</td>
                  <td>{f.year}</td>
                  <td>{TYPE_LABELS[f.type as FilmType]}</td>
                  <td><span className={`status-pill ${f.status}`}>{f.status}</span></td>
                  <td>{f.tmdb_id ? "✓" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!films?.length && <p className="empty">No films match.</p>}
    </>
  );
}
