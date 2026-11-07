import Icon from "@/components/Icon";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import ProfileEditor from "@/components/ProfileEditor";
import MoreMenu from "@/components/MoreMenu";
import ShareButton from "@/components/ShareButton";
import VerifiedBadge from "@/components/VerifiedBadge";
import { VERIFIED } from "@/lib/site";
import { getCollaboratingOn, getMember } from "@/lib/community";
import { countryName, initials } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";
import BlockButton from "@/components/BlockButton";
import DirectorCard from "@/components/DirectorCard";
import { FilmGrid } from "@/components/FilmCard";
import Tabs from "@/components/Tabs";
import { getDirectors, getFilms, toCard, toDirectorSummary } from "@/lib/data";

// Who's looking matters (your own page shows Edit and stays visible when private), so render per visit.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ member: string }> };

/** Member pages live at /@handle; anything else at the top level isn't a page. */
function handleOf(segment: string) {
  const s = decodeURIComponent(segment);
  return s.startsWith("@") && /^@[a-z0-9_]{3,24}$/i.test(s) ? s.slice(1).toLowerCase() : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const handle = handleOf((await params).member);
  const found = handle ? await getMember(handle) : null;
  if (!found) return {};
  if (found.member.is_private) return { title: `@${found.member.handle}`, robots: { index: false } };
  const name = found.member.display_name || `@${found.member.handle}`;
  return { title: `${name} (@${found.member.handle})`, description: `Collections of films by Black directors, made by ${name} on Pheelm.` };
}

/**
 * A member's profile: their name, then tabs for their public collections (Watchlist), the films
 * they've watched and the directors they follow. Watched and Following can each be hidden in Settings.
 */
export default async function MemberPage({ params }: Params) {
  const handle = handleOf((await params).member);
  if (!handle) notFound();
  const found = await getMember(handle);
  if (!found) notFound();
  const { member, collections } = found;
  const name = member.display_name || `@${member.handle}`;

  const db = await getServerClient();
  const viewer = db ? (await db.auth.getUser()).data.user : null;
  const own = viewer?.id === member.id;

  if (member.is_private && !own) {
    return (
      <section className="page">
        <header className="person-head">
          <span className="portrait portrait-initials" aria-hidden="true">{initials(member.handle)}</span>
          <div className="person-text">
            <h1>@{member.handle}</h1>
            <p className="person-sub">This profile is private.</p>
          </div>
        </header>
      </section>
    );
  }

  const [collaborating, followRows, directors, watchedRows, films, showsWatched, showsFollowing, blockRow] = await Promise.all([
    getCollaboratingOn(member.id),
    db ? db.from("follows").select("person_id, created_at").eq("user_id", member.id).order("created_at", { ascending: false }) : null,
    getDirectors(),
    db ? db.from("watched").select("film_id, watched_at").eq("user_id", member.id).order("watched_at", { ascending: false }) : null,
    getFilms(),
    own || !db ? true : db.rpc("shows_watched", { uid: member.id }).then((r) => (r.error ? false : !!r.data)),
    own || !db ? true : db.rpc("shows_following", { uid: member.id }).then((r) => (r.error ? true : !!r.data)),
    viewer && !own && db ? db.from("blocks").select("blocked_id").eq("blocker_id", viewer.id).eq("blocked_id", member.id).maybeSingle() : null,
  ]);
  const filmById = new Map(films.map((f) => [f.id, f]));
  const watched = ((watchedRows?.data ?? []) as { film_id: string }[]).map((r) => filmById.get(r.film_id)).filter((f) => f !== undefined);
  const watchedOn = !watchedRows?.error;
  const directorById = new Map(directors.map((d) => [d.id, d]));
  const following = ((followRows?.data ?? []) as { person_id: string }[]).map((r) => directorById.get(r.person_id)).filter((d) => d !== undefined);

  const collectionsPanel = collections.length ? (
    <ul className="collection-list">{collections.map((c) => <CommunityTile key={c.id} c={c} showOwner={false} />)}</ul>
  ) : (
    <div className="empty-state">
      <Icon name="stack" className="empty-icon" />
      <p>Nothing here yet.</p>
      {own && (
        <>
          <p className="muted">Make one of your collections public from your Watchlist and it shows up here.</p>
          <Link className="button ghost small" href="/me">Go to your Watchlist</Link>
        </>
      )}
    </div>
  );

  return (
    <section className="page member-page">
      <header className="person-head">
        {(own || !member.is_private) && (
          <MoreMenu corner label="Profile actions">
            {own && <ProfileEditor handle={member.handle} displayName={member.display_name} isPrivate={!!member.is_private} country={member.country ?? null} />}
            {!member.is_private && <ShareButton item title={`${name} on Pheelm`} />}
            {viewer && !own && <BlockButton memberId={member.id} handle={member.handle} blocked={!!blockRow?.data} />}
          </MoreMenu>
        )}
        <span className="portrait portrait-initials" aria-hidden="true">{initials(name.replace(/^@/, ""))}</span>
        <div className="person-text">
          <h1>{name}{VERIFIED[member.handle] && <VerifiedBadge title={VERIFIED[member.handle]} />}</h1>
          {member.country && <p className="person-roles">{countryName(member.country)}</p>}
          <p className="person-sub">@{member.handle}</p>
          {own && member.is_private && <p className="person-sub">Private: only you can see this page.</p>}
        </div>
      </header>
      <Tabs
        tabs={[
          {
            id: "watchlist",
            label: "Watchlist",
            panel: (
              <>
                {collectionsPanel}
                {collaborating.length > 0 && (
                  <section className="film-section member-collections" aria-labelledby="member-collab-h">
                    <h2 id="member-collab-h">Co-curating</h2>
                    <ul className="collection-list">{collaborating.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
                  </section>
                )}
              </>
            ),
          },
          ...(watchedOn && showsWatched ? [{
            id: "watched",
            label: "Watched",
            panel: watched.length ? (
              <FilmGrid films={watched.map(toCard)} />
            ) : (
              <div className="empty-state">
                <Icon name="eye" className="empty-icon" />
                <p>No watched films yet.</p>
                {own && <p className="muted">On any film, open the &#8943; menu and press <strong>Add to Watched</strong>.</p>}
              </div>
            ),
          }] : []),
          ...(showsFollowing ? [{
            id: "following",
            label: "Following",
            panel: following.length ? (
              <ul className="director-grid">{following.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} />)}</ul>
            ) : (
              <div className="empty-state">
                <Icon name="clapper" className="empty-icon" />
                <p>Not following any directors yet.</p>
                {own && (
                  <>
                    <p className="muted">Follow directors from their pages to hear when they have a new film.</p>
                    <Link className="button ghost small" href="/directors">Browse directors</Link>
                  </>
                )}
              </div>
            ),
          }] : []),
        ]}
      />
    </section>
  );
}
