import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import { getFilms, toCard } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";
import { createCollection } from "./actions";
import CollectionSettings from "./CollectionSettings";
import CommunityTile from "@/components/CommunityTile";
import { enrich, MIN_FILMS, type Row as CommunityRow } from "@/lib/community";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watchlist", description: PAGE_COPY.watchlist, robots: { index: false } };

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
  // Old links: following is gone, submissions moved to the Account page.
  if (sp.c === "following") redirect("/profile");
  if (sp.c === "submissions") redirect("/account#submissions");
  const [{ data: saved }, { data: profile }, listsResult, films] = await Promise.all([
    db.from("watchlist").select("film_id, added_at").eq("user_id", user.id).order("added_at", { ascending: false }),
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("lists").select("id, title, description, is_public, list_films(film_id, added_at)").eq("user_id", user.id).order("created_at"),
    getFilms(),
  ]);
  // Collections saved from the community, newest first. Until community.sql has run, none.
  const savedResult = await db
    .from("list_saves")
    .select("created_at, lists(id, title, description, staff_pick, created_at, user_id, list_films(film_id, added_at))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const communityReady = !savedResult.error;
  const savedCollections = communityReady
    ? await enrich(((savedResult.data ?? []) as unknown as { lists: CommunityRow | null }[]).map((r) => r.lists).filter((l): l is CommunityRow => !!l))
    : [];
  const handle: string | null = (profile as { handle?: string | null } | null)?.handle ?? null;
  // Until supabase/member-collections.sql has run, the lists table doesn't exist yet.
  const listsReady = !listsResult.error;
  const lists = (listsResult.data ?? []) as ListRow[];

  const byId = new Map(films.map((f) => [f.id, f]));
  const all = (saved ?? []).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);
  const selected = sp.c === "saved" ? sp.c : lists.find((l) => l.id === sp.c) ?? null;
  const listFilms = (l: ListRow) =>
    [...l.list_films].sort((a, b) => b.added_at.localeCompare(a.added_at)).map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Watchlist</h1>
        <p className="lead">{PAGE_COPY.watchlist}</p>
      </header>

      <nav className="collection-tabs" aria-label="Your collections">
        <Link className="chip" href="/me" aria-pressed={!selected}>All <span className="count">{all.length}</span></Link>
        {communityReady && savedCollections.length > 0 && (
          <Link className="chip" href="/me?c=saved" aria-pressed={selected === "saved"}>Saved <span className="count">{savedCollections.length}</span></Link>
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

      {selected === "saved" ? (
        <>
          <div className="section-head"><p className="label">Collections you&rsquo;ve saved from the community.</p></div>
          <ul className="collection-list">{savedCollections.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
        </>
      ) : selected ? (
        <>
          <CollectionSettings list={{ id: selected.id, title: selected.title, description: selected.description, is_public: selected.is_public }} count={selected.list_films.length} handle={communityReady ? handle : undefined} minFilms={MIN_FILMS} />
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

    </section>
  );
}
