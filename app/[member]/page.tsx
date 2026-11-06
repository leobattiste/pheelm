import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import ProfileEditor from "@/components/ProfileEditor";
import ShareButton from "@/components/ShareButton";
import { getMember, getTaggedIn } from "@/lib/community";
import { countryName, initials } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";

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

/** A member's profile: their name and bio, then their Watchlist (the collections they've made public). */
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

  const taggedIn = await getTaggedIn(member.id);

  const collectionsPanel = collections.length ? (
    <ul className="collection-list">{collections.map((c) => <CommunityTile key={c.id} c={c} showOwner={false} />)}</ul>
  ) : (
    <div className="empty-state">
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
        <span className="portrait portrait-initials" aria-hidden="true">{initials(name.replace(/^@/, ""))}</span>
        <div className="person-text">
          <h1>{name}</h1>
          {member.country && <p className="person-roles">{countryName(member.country)}</p>}
          <p className="person-sub">@{member.handle}</p>
          {member.bio && <p className="person-bio-line">{member.bio}</p>}
          <div className="person-actions">
            {own && <ProfileEditor handle={member.handle} displayName={member.display_name} isPrivate={!!member.is_private} country={member.country ?? null} bio={member.bio ?? null} />}
            {!member.is_private && <ShareButton title={`${name} on Pheelm`} />}
          </div>
          {own && member.is_private && <p className="person-sub">Private: only you can see this page.</p>}
        </div>
      </header>
      <section className="film-section member-collections" aria-labelledby="member-collections-h">
        <h2 id="member-collections-h">Watchlist</h2>
        {collectionsPanel}
      </section>
      {taggedIn.length > 0 && (
        <section className="film-section member-collections" aria-labelledby="member-tagged-h">
          <h2 id="member-tagged-h">Tagged in</h2>
          <ul className="collection-list">{taggedIn.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
        </section>
      )}
    </section>
  );
}
