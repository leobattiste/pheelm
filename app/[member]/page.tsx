import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import DirectorCard from "@/components/DirectorCard";
import ProfileEditor from "@/components/ProfileEditor";
import Tabs from "@/components/Tabs";
import { getMember } from "@/lib/community";
import { getDirectors, toDirectorSummary } from "@/lib/data";
import { initials } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";
import { Following, type Update } from "../account/sections";

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

/** A member's profile: their name, then tabs for their public collections and the directors they follow. */
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
        <header className="member-head">
          <span className="member-avatar" aria-hidden="true">{initials(member.handle)}</span>
          <div>
            <h1>@{member.handle}</h1>
            <p className="muted">This profile is private.</p>
          </div>
        </header>
      </section>
    );
  }

  const [follows, directors, updates] = await Promise.all([
    db ? db.from("follows").select("person_id, created_at").eq("user_id", member.id).order("created_at", { ascending: false }) : null,
    getDirectors(),
    own && db ? db.rpc("follow_updates") : null,
  ]);
  const order = new Map(((follows?.data ?? []) as { person_id: string }[]).map((f, i) => [f.person_id, i]));
  const followed = directors
    .filter((d) => order.has(d.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map(toDirectorSummary);
  const saves = collections.reduce((n, c) => n + c.saves, 0);

  const tabs = [
    {
      id: "collections",
      label: `Collections${collections.length ? ` (${collections.length})` : ""}`,
      panel: collections.length ? (
        <ul className="collection-list">{collections.map((c) => <CommunityTile key={c.id} c={c} showOwner={false} />)}</ul>
      ) : (
        <div className="empty-state">
          <p>No public collections yet.</p>
          {own && (
            <>
              <p className="muted">Make one of your collections public from your Watchlist and it shows up here.</p>
              <Link className="button ghost small" href="/me">Go to your Watchlist</Link>
            </>
          )}
        </div>
      ),
    },
    {
      id: "following",
      label: `Following${followed.length ? ` (${followed.length})` : ""}`,
      panel: own ? (
        <Following directors={followed} updates={(updates?.data ?? []) as Update[]} />
      ) : followed.length ? (
        <ul className="director-grid">{followed.map((d) => <DirectorCard key={d.id} director={d} />)}</ul>
      ) : (
        <div className="empty-state"><p>Not following any directors yet.</p></div>
      ),
    },
  ];

  return (
    <section className="page member-page">
      <header className="member-head">
        <span className="member-avatar" aria-hidden="true">{initials(name.replace(/^@/, ""))}</span>
        <div className="member-head-text">
          <h1>{name}</h1>
          <p className="muted">
            @{member.handle}
            {saves > 0 && ` • Collections saved ${saves} ${saves === 1 ? "time" : "times"}`}
          </p>
          {own && (
            <div className="member-own">
              <ProfileEditor handle={member.handle} displayName={member.display_name} isPrivate={!!member.is_private} />
              <span className="muted">{member.is_private ? "Private: only you can see this page" : "Public profile"}</span>
            </div>
          )}
        </div>
      </header>
      <Tabs tabs={tabs} />
    </section>
  );
}
