import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskToCollaborate from "@/components/AskToCollaborate";
import CollectionEditor from "@/components/CollectionEditor";
import Comments from "@/components/Comments";
import Icon from "@/components/Icon";
import { FilmGrid } from "@/components/FilmCard";
import MoreMenu from "@/components/MoreMenu";
import PeopleSheet from "@/components/PeopleSheet";
import ReportCollection from "@/components/ReportCollection";
import SaveCollectionButton from "@/components/SaveCollectionButton";
import ShareButton from "@/components/ShareButton";
import { getCollaboration, MAX_COLLABORATORS } from "@/lib/collab";
import { getComments } from "@/lib/comments";
import { collectionExtras, MIN_FILMS, type Member } from "@/lib/community";
import { getFilms, toCard } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";
import { respondToInvite } from "../actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
type ListRow = {
  id: string; title: string; description: string | null; is_public: boolean; staff_pick: boolean; user_id: string;
  comments_enabled?: boolean; pinned_comment_id?: string | null;
  list_films: { film_id: string; added_at: string; added_by?: string | null }[];
};

/** A collection, readable when it's public, or by its owner and collaborators. */
async function load(id: string): Promise<ListRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getServerClient();
  if (!db) return null;
  const full = await db
    .from("lists")
    .select("id, title, description, is_public, staff_pick, user_id, comments_enabled, pinned_comment_id, list_films(film_id, added_at, added_by)")
    .eq("id", id)
    .maybeSingle();
  if (!full.error) return full.data as ListRow | null;
  // Before collaboration.sql has run.
  const { data } = await db.from("lists").select("id, title, description, is_public, staff_pick, user_id, list_films(film_id, added_at)").eq("id", id).maybeSingle();
  return data as ListRow | null;
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

/** "@a", "@a and @b", "@a, @b and @c". */
function People({ list }: { list: Member[] }) {
  return <>{list.map((m, i) => <span key={m.id}>{i > 0 && (i === list.length - 1 ? " and " : ", ")}<Handle m={m} /></span>)}</>;
}

/**
 * A collection. Everyone sees the films and the conversation. Its owner and collaborators manage
 * it here: Edit, People (invites, requests, leaving), and films show who added them. Other
 * members can ask to collaborate; an invited member accepts or declines here.
 */
export default async function MemberCollectionPage({ params }: Params) {
  const list = await load((await params).id);
  if (!list) notFound();
  const db = await getServerClient();
  const viewer = (await db?.auth.getUser())?.data.user ?? null;
  const isOwner = viewer?.id === list.user_id;

  const [films, { owner, saves }, collab, { available: commentsOn, comments }, viewerProfile] = await Promise.all([
    getFilms(),
    collectionExtras(list.id, list.user_id),
    getCollaboration(db, list.id, viewer?.id ?? null),
    list.is_public ? getComments(db, list.id, viewer?.id ?? null) : Promise.resolve({ available: false, comments: [] }),
    viewer && db ? db.from("profiles").select("*").eq("id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const vp = (viewerProfile.data ?? null) as { handle?: string | null; display_name?: string | null; is_private?: boolean } | null;
  const isCollaborator = collab.mine?.status === "active";
  const canEdit = isOwner || isCollaborator;
  const invitedMe = collab.mine?.status === "invited";

  const byId = new Map(films.map((f) => [f.id, f]));
  const rows = [...list.list_films].sort((a, b) => b.added_at.localeCompare(a.added_at));
  const items = rows.map((r) => byId.get(r.film_id)).filter((f) => f !== undefined);
  const count = items.length;

  // With collaborators, each film says who added it.
  const everyone = new Map<string, Member>([...(owner ? [[owner.id, owner] as [string, Member]] : []), ...collab.collaborators.map((p) => [p.id, p] as [string, Member])]);
  const extras = collab.collaborators.length
    ? Object.fromEntries(rows.flatMap((r) => {
        const m = r.added_by ? everyone.get(r.added_by) : null;
        return m ? [[r.film_id, `Added by @${m.handle}`]] : [];
      }))
    : undefined;

  const inCommunity = list.is_public && !!vp?.handle && count >= MIN_FILMS;
  const declinedUntil = collab.mine?.status === "declined" && collab.mine.respondedAt
    ? new Date(new Date(collab.mine.respondedAt).getTime() + 30 * 86400000)
    : null;
  const againOn = declinedUntil && declinedUntil > new Date()
    ? declinedUntil.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  return (
    <section className="page">
      <header className="page-head has-corner">
        <MoreMenu corner label="Collection actions">
          {canEdit && (
            <CollectionEditor
              list={{ ...list, comments_enabled: list.comments_enabled ?? true }}
              isOwner={isOwner}
              collaborators={collab.collaborators.length}
            />
          )}
          {collab.available && (canEdit || collab.collaborators.length > 0) && (
            <PeopleSheet
              listId={list.id}
              owner={owner}
              collaborators={collab.collaborators}
              invited={collab.invited}
              requests={collab.requests}
              isOwner={isOwner}
              isCollaborator={isCollaborator}
              max={MAX_COLLABORATORS}
            />
          )}
          {!canEdit && list.is_public && <SaveCollectionButton listId={list.id} ownerId={list.user_id} initialSaves={saves} />}
          {collab.available && !canEdit && !invitedMe && list.is_public && (
            <AskToCollaborate
              listId={list.id}
              ownerHandle={owner?.handle ?? null}
              signedIn={!!viewer}
              hasProfile={!!vp?.handle}
              status={collab.mine?.status === "requested" ? "requested" : collab.mine?.status === "declined" ? "declined" : null}
              againOn={againOn}
            />
          )}
          {commentsOn && (
            <a className="button ghost" href="#comments">
              <Icon name="comment" />
              {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Comment"}
            </a>
          )}
          {list.is_public && <ShareButton item title={list.title} />}
          {!canEdit && list.is_public && <ReportCollection listId={list.id} />}
        </MoreMenu>
        <p className="crumbs">
          {canEdit && <><Link href="/me">Your Watchlist</Link>{" • "}</>}
          {owner ? <>A collection by <Handle m={owner} /></> : "A collection on Pheelm"}
          {collab.collaborators.length > 0 && <> with <People list={collab.collaborators} /></>}
          {list.staff_pick && <span className="staff-pick">Staff pick</span>}
        </p>
        <h1>{list.title}</h1>
        {list.description && <p className="lead">{list.description}</p>}
        <ul className="collection-meta">
          <li><Icon name="film" />{count} {count === 1 ? "film" : "films"}</li>
          {list.is_public && saves > 0 && <li><Icon name="bookmark" />Saved by {saves}</li>}
          {canEdit && <li><Icon name={list.is_public ? "globe" : "lock"} />{list.is_public ? "Public" : "Private"}</li>}
          {isCollaborator && <li><Icon name="users" />You&rsquo;re a collaborator</li>}
        </ul>

        {invitedMe && (
          <div className="invite-banner" role="region" aria-label="Invitation">
            <p>{owner ? <><Handle m={owner} /> invited</> : "You've been invited"} you to collaborate on this collection. You&rsquo;d add films and edit it together.</p>
            <div className="actions">
              <form action={respondToInvite}>
                <input type="hidden" name="list_id" value={list.id} />
                <input type="hidden" name="accept" value="1" />
                <input type="hidden" name="back" value={`/c/${list.id}`} />
                <button type="submit" className="button small">Accept</button>
              </form>
              <form action={respondToInvite}>
                <input type="hidden" name="list_id" value={list.id} />
                <input type="hidden" name="accept" value="0" />
                <input type="hidden" name="back" value={list.is_public ? `/c/${list.id}` : "/notifications"} />
                <button type="submit" className="button ghost small">Decline</button>
              </form>
            </div>
          </div>
        )}

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
        <FilmGrid films={items.map(toCard)} extras={extras} />
      ) : (
        <div className="empty-state">
          <Icon name="film" className="empty-icon" />
          <p>This collection is empty for now.</p>
          {canEdit && <p className="muted">On any film, press <strong>Watchlist</strong> and tick &ldquo;{list.title}&rdquo; to add it here.</p>}
        </div>
      )}

      {commentsOn && (
        <Comments
          listId={list.id}
          ownerId={list.user_id}
          collaboratorIds={collab.collaborators.map((p) => p.id)}
          initial={comments}
          pinnedId={list.pinned_comment_id ?? null}
          enabled={list.comments_enabled ?? true}
          viewer={viewer ? { id: viewer.id, handle: vp?.handle ?? null, name: vp?.display_name ?? null, isPrivate: !!vp?.is_private } : null}
        />
      )}
      {!canEdit && !viewer && (
        <div className="collection-foot">
          <p className="label">Make collections of your own: <Link href="/me">sign in and start saving films</Link>.</p>
        </div>
      )}
    </section>
  );
}
