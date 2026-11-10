import type { Metadata } from "next";
import { getWatchlist } from "@/lib/watchlists";
import { watchlistPath, watchlistMetadata } from "@/lib/watchlist-links";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskToCollaborate from "@/components/AskToCollaborate";
import CollectionDescription from "@/components/CollectionDescription";
import Breadcrumbs from "@/components/Breadcrumbs";
import FeatureCollection from "@/components/FeatureCollection";
import FeedbackLink from "@/components/FeedbackLink";
import { viewerIsAdmin } from "@/lib/admin";
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
import { respondToInvite } from "@/app/c/actions";
import { SITE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return watchlistMetadata(await getWatchlist((await params).slug));
}

/** A member's @handle, linked to their profile unless it's private. */
function Handle({ m }: { m: Member }) {
  return m.is_private ? <>@{m.handle}</> : <Link href={`/@${m.handle}`}>@{m.handle}</Link>;
}

/**
 * A collection. Everyone sees the films and the conversation. Its owner and collaborators manage
 * it here: Edit, Curators (invites, requests, leaving), and films show who added them. Other
 * members can ask to co-curate; an invited member accepts or declines here.
 */
export default async function MemberCollectionPage({ params, searchParams }: Params & { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const list = await getWatchlist((await params).slug);
  if (!list) notFound();
  const db = await getServerClient();
  const viewer = (await db?.auth.getUser())?.data.user ?? null;
  const isOwner = viewer?.id === list.user_id;

  const [films, { owner }, collab, { available: commentsOn, comments }, viewerProfile, isAdmin] = await Promise.all([
    getFilms(),
    collectionExtras(list.id, list.user_id),
    getCollaboration(db, list.id, viewer?.id ?? null),
    list.is_public ? getComments(db, list.id, viewer?.id ?? null) : Promise.resolve({ available: false, comments: [] }),
    viewer && db ? db.from("profiles").select("*").eq("id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
    viewerIsAdmin(db, viewer?.id),
  ]);
  // Admins feature community collections from the menu (staff picks are featured already).
  const canFeature = isAdmin && list.is_public && !list.staff_pick;
  const featured = canFeature && db ? !!((await db.from("lists").select("featured").eq("id", list.id).maybeSingle()).data as { featured?: boolean } | null)?.featured : false;
  const vp = (viewerProfile.data ?? null) as { handle?: string | null; display_name?: string | null; avatar_url?: string | null; is_private?: boolean } | null;
  const isCollaborator = collab.mine?.status === "active";
  const canEdit = isOwner || isCollaborator;
  const invitedMe = collab.mine?.status === "invited";

  const byId = new Map(films.map((f) => [f.id, f]));
  // Pheelm's collections read as a timeline, oldest film first; members' show the newest additions first.
  const rows = [...list.list_films].sort((a, b) =>
    list.staff_pick ? (byId.get(a.film_id)?.year ?? 0) - (byId.get(b.film_id)?.year ?? 0) : b.added_at.localeCompare(a.added_at));
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

  // For search engines: a public collection as an ordered list of films.
  const jsonLd = list.is_public && !list.hidden ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.title,
    ...(list.description ? { description: list.description } : {}),
    url: `${SITE_URL}${watchlistPath(list)}`,
    numberOfItems: items.length,
    itemListElement: items.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/films/${f.slug}`,
      item: { "@type": "Movie", name: f.title, dateCreated: String(f.year), url: `${SITE_URL}/films/${f.slug}`, ...(f.poster_url ? { image: f.poster_url } : {}) },
    })),
  } : null;

  return (
    <section className="page">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <Breadcrumbs parent="Watchlists" href="/watchlists" current={list.title} />
      <header className="page-head has-corner">
        <MoreMenu corner label="Collection actions">
          {canEdit && (
            <CollectionEditor
              list={{ ...list, comments_enabled: list.comments_enabled ?? true }}
              isOwner={isOwner}
              collaborators={collab.collaborators.length}
            />
          )}
          {!canEdit && list.is_public && <SaveCollectionButton listId={list.id} ownerId={list.user_id} />}
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
          {collab.available && (
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
          {commentsOn && (
            <a className="button ghost" href="#comments">
              <Icon name="comment" />
              {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Comment"}
            </a>
          )}
          {list.is_public && <ShareButton item title={list.title} url={`${SITE_URL}${watchlistPath(list)}`} />}
          {list.is_public && <FeedbackLink about={watchlistPath(list)} label={`Collection: ${list.title}`} />}
          {canFeature && <FeatureCollection listId={list.id} featured={featured} />}
          {!canEdit && list.is_public && <ReportCollection listId={list.id} />}
        </MoreMenu>
        <h1>{list.title}</h1>
        {list.description && <CollectionDescription title={list.title} text={list.description} />}
        {canEdit && (
          <ul className="collection-meta">
            <li><Icon name={list.is_public ? "globe" : "lock"} />{list.is_public ? "Public" : "Private"}</li>
            {isCollaborator && <li><Icon name="users" />You&rsquo;re a co-curator</li>}
          </ul>
        )}
        {sp.error === "description" && (
          <p className="notice error" role="alert">That description is too long, so it wasn&rsquo;t saved. Keep it under 10,000 characters.</p>
        )}

        {invitedMe && (
          <div className="invite-banner" role="region" aria-label="Invitation">
            <p>{owner ? <><Handle m={owner} /> invited</> : "You've been invited"} you to co-curate this collection. You&rsquo;d add films and edit it together.</p>
            <div className="actions">
              <form action={respondToInvite}>
                <input type="hidden" name="list_id" value={list.id} />
                <input type="hidden" name="accept" value="1" />
                <input type="hidden" name="back" value={watchlistPath(list)} />
                <button type="submit" className="button small">Accept</button>
              </form>
              <form action={respondToInvite}>
                <input type="hidden" name="list_id" value={list.id} />
                <input type="hidden" name="accept" value="0" />
                <input type="hidden" name="back" value={list.is_public ? watchlistPath(list) : "/notifications"} />
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
          viewer={viewer ? { id: viewer.id, handle: vp?.handle ?? null, name: vp?.display_name ?? null, avatarUrl: vp?.avatar_url ?? null, isPrivate: !!vp?.is_private } : null}
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
