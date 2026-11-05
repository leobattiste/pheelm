import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import GridToggle from "@/components/GridToggle";
import { getFilms, toCard } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";
import { createCollection } from "./actions";
import CollectionSettings from "./CollectionSettings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your films", robots: { index: false } };

type ListRow = { id: string; title: string; description: string | null; is_public: boolean; list_films: { film_id: string; added_at: string }[] };

export default async function MePage({ searchParams }: { searchParams: Promise<{ c?: string; error?: string }> }) {
  const db = await getServerClient();
  if (!db) {
    return (
      <section className="panel">
        <h1>Your films</h1>
        <p className="lead">Watchlists switch on once the site is connected to Supabase.</p>
      </section>
    );
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/me");

  const sp = await searchParams;
  const [{ data: saved }, { data: profile }, { data: submissions }, listsResult, films] = await Promise.all([
    db.from("watchlist").select("film_id, added_at").eq("user_id", user.id).order("added_at", { ascending: false }),
    db.from("profiles").select("display_name, is_admin").eq("id", user.id).maybeSingle(),
    db.from("submissions").select("id, title, director, year, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("lists").select("id, title, description, is_public, list_films(film_id, added_at)").eq("user_id", user.id).order("created_at"),
    getFilms(),
  ]);
  // Until supabase/member-collections.sql has run, the lists table doesn't exist yet.
  const listsReady = !listsResult.error;
  const lists = (listsResult.data ?? []) as ListRow[];

  const byId = new Map(films.map((f) => [f.id, f]));
  const all = (saved ?? []).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);
  const selected = sp.c === "submissions" ? "submissions" : lists.find((l) => l.id === sp.c) ?? null;
  const listFilms = (l: ListRow) =>
    [...l.list_films].sort((a, b) => b.added_at.localeCompare(a.added_at)).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);

  return (
    <section className="page">
      <header className="page-head">
        <h1>{profile?.display_name ? `${profile.display_name}’s films` : "Your films"}</h1>
        <p className="label">
          {user.email}
          {profile?.is_admin && <> · <Link href="/admin">Admin</Link></>}
        </p>
      </header>

      <nav className="collection-tabs" aria-label="Your collections">
        <Link className="chip" href="/me" aria-pressed={!selected}>All <span className="count">{all.length}</span></Link>
        {lists.map((l) => (
          <Link key={l.id} className="chip" href={`/me?c=${l.id}`} aria-pressed={typeof selected === "object" && selected?.id === l.id}>
            {l.title} <span className="count">{l.list_films.length}</span>
          </Link>
        ))}
        {listsReady && (
          <form action={createCollection} className="new-collection">
            <label className="visually-hidden" htmlFor="c-title">New collection name</label>
            <input id="c-title" name="title" placeholder="New collection" maxLength={80} required />
            <button className="chip" type="submit" aria-label="Create collection">
              <svg className="x" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10" /></svg>
            </button>
          </form>
        )}
      </nav>
      {sp.error === "collection" && <p className="notice error">The collection couldn&rsquo;t be created. Try again.</p>}
      {!listsReady && <p className="notice">Collections switch on once the site owner runs supabase/member-collections.sql in Supabase.</p>}

      {selected === "submissions" ? (
        <Submissions rows={submissions ?? []} />
      ) : selected ? (
        <>
          <CollectionSettings list={{ id: selected.id, title: selected.title, description: selected.description, is_public: selected.is_public }} count={selected.list_films.length} />
          {selected.list_films.length ? (
            <FilmGrid films={listFilms(selected).map(toCard)} />
          ) : (
            <div className="empty-state">
              <p>This collection is empty.</p>
              <p className="muted">On any film, press <strong>Watchlist</strong> and tick &ldquo;{selected.title}&rdquo; to add it here.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="section-head">
            <p className="label">Everything you&rsquo;ve saved, newest first.</p>
            <GridToggle />
          </div>
          {all.length ? (
            <FilmGrid films={all.map(toCard)} />
          ) : (
            <div className="empty-state">
              <p>Nothing saved yet.</p>
              <p className="muted">Press <strong>Watchlist</strong> on any film to save it here, then sort it into collections of your own.</p>
              <Link className="button ghost small" href="/films">Browse films</Link>
            </div>
          )}
        </>
      )}

      <div className="me-foot">
        <Link className="link-button" href="/me?c=submissions">Your submissions ({submissions?.length ?? 0})</Link>
        <form action="/auth/signout" method="post">
          <button className="button ghost small" type="submit">Sign out</button>
        </form>
      </div>
    </section>
  );
}

function Submissions({ rows }: { rows: { id: string; title: string; director: string; year: number | null; status: string }[] }) {
  return (
    <>
      {rows.length ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Film</th><th>Director</th><th>Year</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td>{s.director}</td>
                  <td>{s.year ?? ""}</td>
                  <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">You haven&rsquo;t suggested any films yet.</p>
      )}
      <p style={{ marginTop: 24 }}>
        <Link className="button" href="/submit">Submit a film</Link>
      </p>
    </>
  );
}
