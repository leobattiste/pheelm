import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import DirectorCard from "@/components/DirectorCard";
import Poster from "@/components/Poster";
import { MarkSeen } from "@/components/UpdatesDot";
import { getDirectors, getFilms, toCard, toDirectorSummary } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";
import { createCollection } from "./actions";
import CollectionSettings from "./CollectionSettings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watchlist", robots: { index: false } };

type ListRow = { id: string; title: string; description: string | null; is_public: boolean; list_films: { film_id: string; added_at: string }[] };

export default async function MePage({ searchParams }: { searchParams: Promise<{ c?: string; error?: string }> }) {
  const db = await getServerClient();
  if (!db) {
    return (
      <section className="panel">
        <h1>Watchlist</h1>
        <p className="lead">Watchlists aren&rsquo;t available yet. Check back soon.</p>
      </section>
    );
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/me");

  const sp = await searchParams;
  const [{ data: saved }, { data: profile }, { data: submissions }, listsResult, films, followsResult, updatesResult, directors] = await Promise.all([
    db.from("watchlist").select("film_id, added_at").eq("user_id", user.id).order("added_at", { ascending: false }),
    db.from("profiles").select("display_name, is_admin").eq("id", user.id).maybeSingle(),
    db.from("submissions").select("id, title, director, year, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("lists").select("id, title, description, is_public, list_films(film_id, added_at)").eq("user_id", user.id).order("created_at"),
    getFilms(),
    db.from("follows").select("person_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.rpc("follow_updates"),
    getDirectors(),
  ]);
  // Until supabase/follows.sql has run, following isn't available.
  const followsReady = !followsResult.error;
  const followedIds = new Set((followsResult.data ?? []).map((f: { person_id: string }) => f.person_id));
  const followed = directors.filter((d) => followedIds.has(d.id)).map(toDirectorSummary);
  const updates = (updatesResult.data ?? []) as Update[];
  // Until supabase/member-collections.sql has run, the lists table doesn't exist yet.
  const listsReady = !listsResult.error;
  const lists = (listsResult.data ?? []) as ListRow[];

  const byId = new Map(films.map((f) => [f.id, f]));
  const all = (saved ?? []).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);
  const selected = sp.c === "submissions" || sp.c === "following" ? sp.c : lists.find((l) => l.id === sp.c) ?? null;
  const listFilms = (l: ListRow) =>
    [...l.list_films].sort((a, b) => b.added_at.localeCompare(a.added_at)).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Watchlist</h1>
        <p className="label">
          {user.email}
          {profile?.is_admin && <> · <Link href="/admin">Admin</Link></>}
        </p>
      </header>

      <nav className="collection-tabs" aria-label="Your collections">
        <Link className="chip" href="/me" aria-pressed={!selected}>All <span className="count">{all.length}</span></Link>
        {followsReady && (
          <Link className="chip" href="/me?c=following" aria-pressed={selected === "following"}>
            Following <span className="count">{followed.length}</span>
            {updates.length > 0 && selected !== "following" && <span className="updates-dot" aria-label="New films" />}
          </Link>
        )}
        {lists.map((l) => (
          <Link key={l.id} className="chip" href={`/me?c=${l.id}`} aria-pressed={typeof selected === "object" && selected !== null && selected.id === l.id}>
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
      {!listsReady && <p className="notice">Your own collections aren&rsquo;t available yet.</p>}

      {selected === "submissions" ? (
        <Submissions rows={submissions ?? []} />
      ) : selected === "following" ? (
        <Following directors={followed} updates={updates} />
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

type Update = { film_id: string; slug: string; title: string; year: number; poster_url: string | null; director_name: string; director_slug: string; added_at: string };

/** Directors the member follows, and the films by them added since they followed. */
function Following({ directors, updates }: { directors: ReturnType<typeof toDirectorSummary>[]; updates: Update[] }) {
  if (!directors.length) {
    return (
      <div className="empty-state">
        <p>You&rsquo;re not following anyone yet.</p>
        <p className="muted">Press <strong>Follow</strong> on a director&rsquo;s page to see their new films here as they&rsquo;re added.</p>
        <Link className="button ghost small" href="/directors">Browse directors</Link>
      </div>
    );
  }
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  return (
    <>
      <MarkSeen newest={updates[0]?.added_at ?? null} />
      <section className="film-section" aria-labelledby="new-h" style={{ marginTop: 0 }}>
        <h2 id="new-h">New from directors you follow</h2>
        {updates.length ? (
          <ul className="update-list">
            {updates.map((u) => (
              <li key={u.film_id + u.director_slug}>
                <Link href={`/films/${u.slug}`}>
                  <Poster title={u.title} year={u.year} directors={[u.director_name]} src={u.poster_url} sizes="40px" />
                  <span>
                    <span className="update-title">{u.title}</span>
                    <span className="update-meta"> · {u.director_name}, {u.year}</span>
                  </span>
                  <span className="update-when">Added {fmt.format(new Date(u.added_at))}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="label" style={{ marginBottom: 40 }}>Nothing new yet. Films by these directors will show up here when they&rsquo;re added to Pheelm.</p>
        )}
      </section>
      <section className="film-section" aria-labelledby="following-h">
        <h2 id="following-h">Directors you follow</h2>
        <ul className="director-grid">
          {directors.map((d) => <DirectorCard key={d.id} director={d} />)}
        </ul>
      </section>
    </>
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
