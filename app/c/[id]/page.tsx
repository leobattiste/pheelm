import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CollectionEditor from "@/components/CollectionEditor";
import Comments from "@/components/Comments";
import { FilmGrid } from "@/components/FilmCard";
import ReportCollection from "@/components/ReportCollection";
import SaveCollectionButton from "@/components/SaveCollectionButton";
import ShareButton from "@/components/ShareButton";
import { getComments } from "@/lib/comments";
import { collectionExtras, MIN_FILMS, type Member } from "@/lib/community";
import { getFilms, toCard } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** A member's collection, readable here when it's public, or by its owner. */
async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getServerClient();
  if (!db) return null;
  const { data } = await db
    .from("lists")
    .select("id, title, description, is_public, staff_pick, user_id, list_films(film_id, added_at)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const list = await load((await params).id);
  if (!list) return {};
  return { title: list.title, description: list.description ?? `A collection of ${list.list_films.length} films on Pheelm.`, robots: list.is_public ? undefined : { index: false } };
}

/** A member's @handle, linked to their profile unless it's private. */
function Handle({ m }: { m: Member }) {
  return m.is_private ? <>@{m.handle}</> : <Link href={`/@${m.handle}`}>@{m.handle}</Link>;
}

/**
 * A member's collection. Everyone sees the films and the conversation; its owner also gets Edit
 * and Share here (this is where collections are managed, not on the Watchlist page).
 */
export default async function MemberCollectionPage({ params }: Params) {
  const list = await load((await params).id);
  if (!list) notFound();
  const db = await getServerClient();
  const viewer = (await db?.auth.getUser())?.data.user ?? null;
  const isOwner = viewer?.id === list.user_id;

  const [films, { owner, saves }, { available: commentsOn, comments }, viewerProfile] = await Promise.all([
    getFilms(),
    collectionExtras(list.id, list.user_id),
    list.is_public ? getComments(db, list.id, viewer?.id ?? null) : Promise.resolve({ available: false, comments: [] }),
    viewer && db ? db.from("profiles").select("*").eq("id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const vp = (viewerProfile.data ?? null) as { handle?: string | null; display_name?: string | null; is_private?: boolean } | null;
  const byId = new Map(films.map((f) => [f.id, f]));
  const items = [...list.list_films]
    .sort((a, b) => b.added_at.localeCompare(a.added_at))
    .map((r) => byId.get(r.film_id))
    .filter((f) => f !== undefined);
  const count = items.length;
  const inCommunity = list.is_public && !!vp?.handle && count >= MIN_FILMS;

  return (
    <section className="page">
      <header className="page-head">
        <p className="crumbs">
          {isOwner ? <Link href="/me">Your Watchlist</Link> : owner ? <>A collection by <Handle m={owner} /></> : "A collection on Pheelm"}
          {list.staff_pick && <span className="staff-pick">Staff pick</span>}
        </p>
        <h1>{list.title}</h1>
        {list.description && <p className="lead">{list.description}</p>}
        <p className="collection-meta">
          {count} {count === 1 ? "film" : "films"}
          {list.is_public && saves > 0 && <> • Saved by {saves}</>}
          {isOwner && <> • {list.is_public ? "Public" : "Private"}</>}
        </p>
        <div className="collection-actions">
          {isOwner ? (
            <>
              <CollectionEditor list={list} isOwner />
              {list.is_public && <ShareButton title={list.title} />}
            </>
          ) : list.is_public ? (
            <SaveCollectionButton listId={list.id} ownerId={list.user_id} initialSaves={saves} />
          ) : null}
          {commentsOn && (
            <a className="button ghost" href="#comments">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5z" /></svg>
              {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Comment"}
            </a>
          )}
          {!isOwner && list.is_public && viewer && <ShareButton title={list.title} />}
        </div>
        {isOwner && list.is_public && !inCommunity && (
          <p className="community-status">
            To appear in the community:{" "}
            {count < MIN_FILMS && `add ${MIN_FILMS - count} more ${MIN_FILMS - count === 1 ? "film" : "films"}`}
            {count < MIN_FILMS && !vp?.handle && " and "}
            {!vp?.handle && <Link href="/profile">create your profile</Link>}.
          </p>
        )}
      </header>

      {items.length ? (
        <FilmGrid films={items.map(toCard)} />
      ) : (
        <div className="empty-state">
          <p>This collection is empty for now.</p>
          {isOwner && <p className="muted">On any film, press <strong>Watchlist</strong> and tick &ldquo;{list.title}&rdquo; to add it here.</p>}
        </div>
      )}

      {commentsOn && (
        <Comments
          listId={list.id}
          ownerId={list.user_id}
          initial={comments}
          viewer={viewer ? { id: viewer.id, handle: vp?.handle ?? null, name: vp?.display_name ?? null, isPrivate: !!vp?.is_private } : null}
        />
      )}
      {!isOwner && (
        <div className="collection-foot">
          {!viewer && <p className="label">Make collections of your own: <Link href="/me">sign in and start saving films</Link>.</p>}
          {list.is_public && <ReportCollection listId={list.id} />}
        </div>
      )}
    </section>
  );
}
