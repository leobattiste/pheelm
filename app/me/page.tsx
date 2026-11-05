import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import { getFilms, toCard } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your watchlist", robots: { index: false } };

type Tab = "watchlist" | "seen" | "submissions";

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const db = await getServerClient();
  if (!db) {
    return (
      <section className="panel">
        <h1>Your watchlist</h1>
        <p className="lead">Watchlists switch on once the site is connected to Supabase.</p>
      </section>
    );
  }
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/me");

  const raw = (await searchParams).tab;
  const tab: Tab = raw === "seen" || raw === "submissions" ? raw : "watchlist";

  const [{ data: list }, { data: profile }, { data: submissions }, films] = await Promise.all([
    db.from("watchlist").select("film_id, seen, added_at").eq("user_id", user.id).order("added_at", { ascending: false }),
    db.from("profiles").select("display_name, is_admin").eq("id", user.id).maybeSingle(),
    db.from("submissions").select("id, title, director, year, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    getFilms(),
  ]);

  const byId = new Map(films.map((f) => [f.id, f]));
  const rows = list ?? [];
  const toWatch = rows.filter((r) => !r.seen).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);
  const seen = rows.filter((r) => r.seen).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);

  return (
    <section className="page">
      <header className="page-head">
        <h1>{profile?.display_name ? `${profile.display_name}’s films` : "Your films"}</h1>
        <p className="muted">
          {user.email}
          {profile?.is_admin && <> · <Link href="/admin">Admin</Link></>}
        </p>
      </header>

      <nav className="tabs" aria-label="Your films">
        <Link href="/me" aria-current={tab === "watchlist" ? "page" : undefined}>Watchlist ({toWatch.length})</Link>
        <Link href="/me?tab=seen" aria-current={tab === "seen" ? "page" : undefined}>Seen ({seen.length})</Link>
        <Link href="/me?tab=submissions" aria-current={tab === "submissions" ? "page" : undefined}>Submissions ({submissions?.length ?? 0})</Link>
      </nav>

      {tab === "watchlist" &&
        (toWatch.length ? (
          <FilmGrid films={toWatch.map(toCard)} />
        ) : (
          <p className="empty">
            Nothing here yet. Press <strong>+ Watchlist</strong> on any film to save it. <Link href="/films">Browse films</Link>
          </p>
        ))}

      {tab === "seen" &&
        (seen.length ? <FilmGrid films={seen.map(toCard)} /> : <p className="empty">Films you mark as seen will show up here.</p>)}

      {tab === "submissions" && (
        <>
          {submissions?.length ? (
            <table className="admin-table">
              <thead>
                <tr><th>Film</th><th>Director</th><th>Year</th><th>Status</th></tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{s.director}</td>
                    <td>{s.year ?? ""}</td>
                    <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">You haven&rsquo;t suggested any films yet.</p>
          )}
          <p style={{ marginTop: 24 }}>
            <Link className="button" href="/submit">Submit a film</Link>
          </p>
        </>
      )}

      <form action="/auth/signout" method="post" style={{ marginTop: 56 }}>
        <button className="button ghost small" type="submit">Sign out</button>
      </form>
    </section>
  );
}
