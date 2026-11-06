import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import { FilmGrid } from "@/components/FilmCard";
import Poster from "@/components/Poster";
import { enrich, type Row as CommunityRow } from "@/lib/community";
import { getFilms, toCard } from "@/lib/data";
import { tintStyle } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";
import { createCollection } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watchlist", description: PAGE_COPY.watchlist, robots: { index: false } };

type ListRow = CommunityRow & { is_public: boolean };
const LIST_COLS = "id, title, description, is_public, staff_pick, created_at, user_id, list_films(film_id, added_at)";

/**
 * Your Watchlist: everything you've saved, then your collections and the ones you collaborate on
 * as cards (each opens on its own page, where it's edited), then collections saved from the
 * community.
 */
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
  // Old links: a collection now opens on its own page; following is gone; submissions moved.
  if (sp.c && /^[0-9a-f-]{36}$/i.test(sp.c)) redirect(`/c/${sp.c}`);
  if (sp.c === "following" || sp.c === "saved") redirect("/me");
  if (sp.c === "submissions") redirect("/account#submissions");

  const [{ data: saved }, listsResult, savedResult, films, sharedResult] = await Promise.all([
    db.from("watchlist").select("film_id, added_at").eq("user_id", user.id).order("added_at", { ascending: false }),
    db.from("lists").select(LIST_COLS).eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("list_saves").select("created_at, lists(id, title, description, staff_pick, created_at, user_id, list_films(film_id, added_at))").eq("user_id", user.id).order("created_at", { ascending: false }),
    getFilms(),
    // Collections you collaborate on. Until collaboration.sql has run, none.
    db.from("list_members").select("list_id").eq("user_id", user.id).eq("status", "active"),
  ]);

  const byId = new Map(films.map((f) => [f.id, f]));
  const all = (saved ?? []).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);

  // Everything you've saved, as its own page.
  if (sp.c === "all") {
    return (
      <section className="page">
        <header className="page-head">
          <p className="crumbs"><Link href="/me">Watchlist</Link></p>
          <h1>All saved films</h1>
          <p className="lead">Everything you&rsquo;ve saved, newest first.</p>
        </header>
        {all.length ? (
          <FilmGrid films={all.map(toCard)} />
        ) : (
          <div className="empty-state">
            <p>Nothing saved yet.</p>
            <p className="muted">Press <strong>Watchlist</strong> on any film to save it here.</p>
            <Link className="button ghost small" href="/films">Browse films</Link>
          </div>
        )}
      </section>
    );
  }

  const ownRows = (listsResult.data ?? []) as ListRow[];
  const publicById = new Map(ownRows.map((l) => [l.id, l.is_public]));
  const sharedIds = ((sharedResult.data ?? []) as { list_id: string }[]).map((r) => r.list_id);
  const sharedRows = sharedIds.length
    ? (((await db.from("lists").select(LIST_COLS).in("id", sharedIds).order("created_at", { ascending: false })).data ?? []) as ListRow[])
    : [];
  const [own, shared, savedCollections] = await Promise.all([
    enrich(ownRows),
    enrich(sharedRows),
    enrich(((savedResult.data ?? []) as unknown as { lists: CommunityRow | null }[]).map((r) => r.lists).filter((l): l is CommunityRow => !!l)),
  ]);
  const latest = all.slice(0, 3);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Watchlist</h1>
        <p className="lead">{PAGE_COPY.watchlist}</p>
      </header>
      {sp.error === "collection" && <p className="notice error">The collection couldn&rsquo;t be created. Try again.</p>}

      <ul className="collection-list watchlist-cards">
        <li>
          <Link href="/me?c=all" className="collection-tile" style={tintStyle(latest.find((f) => f.color)?.color)}>
            <span className="collection-fan" aria-hidden="true">
              {[0, 1, 2].map((i) => {
                const f = latest[i];
                return f
                  ? <Poster key={f.id} title={f.title} year={f.year} directors={f.directors.map((d) => d.name)} src={f.poster_url} sizes="140px" />
                  : <span key={`empty-${i}`} className="poster poster-empty" />;
              })}
            </span>
            <span className="collection-title">All saved films</span>
            <span className="collection-desc">{all.length} {all.length === 1 ? "film" : "films"}</span>
          </Link>
        </li>
        {own.map((c) => <CommunityTile key={c.id} c={c} showOwner={false} badge={publicById.get(c.id) ? "Public" : "Private"} />)}
        {shared.map((c) => <CommunityTile key={c.id} c={c} badge="Shared" />)}
        <li>
          <form action={createCollection} className="collection-tile new-collection-card">
            <span className="new-collection-plus" aria-hidden="true">
              <svg viewBox="0 0 20 20"><path d="M10 4.5v11M4.5 10h11" /></svg>
            </span>
            <label className="collection-title" htmlFor="new-collection">New collection</label>
            <span className="new-collection-row">
              <input id="new-collection" name="title" placeholder="Name it" maxLength={80} required />
              <button className="button small" type="submit">Create</button>
            </span>
          </form>
        </li>
      </ul>

      {savedCollections.length > 0 && (
        <section className="film-section" aria-labelledby="saved-h">
          <h2 id="saved-h">Saved from the community</h2>
          <ul className="collection-list">{savedCollections.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
        </section>
      )}
    </section>
  );
}
