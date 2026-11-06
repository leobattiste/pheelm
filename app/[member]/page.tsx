import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import { getMember } from "@/lib/community";
import { initials } from "@/lib/format";

export const revalidate = 300;

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
  const name = found.member.display_name || `@${found.member.handle}`;
  return { title: `${name} (@${found.member.handle})`, description: `Collections of films by Black directors, made by ${name} on Pheelm.` };
}

/** A member's public page: their name and every collection they've made public. */
export default async function MemberPage({ params }: Params) {
  const handle = handleOf((await params).member);
  if (!handle) notFound();
  const found = await getMember(handle);
  if (!found) notFound();
  const { member, collections } = found;
  const saves = collections.reduce((n, c) => n + c.saves, 0);
  const name = member.display_name || `@${member.handle}`;

  return (
    <section className="page">
      <header className="member-head">
        <span className="member-avatar" aria-hidden="true">{initials(name.replace(/^@/, ""))}</span>
        <div>
          <h1>{name}</h1>
          <p className="muted">
            @{member.handle} • {collections.length} {collections.length === 1 ? "collection" : "collections"}
            {saves > 0 && ` • Saved ${saves} ${saves === 1 ? "time" : "times"}`}
          </p>
        </div>
      </header>
      {collections.length ? (
        <ul className="collection-list">{collections.map((c) => <CommunityTile key={c.id} c={c} showOwner={false} />)}</ul>
      ) : (
        <div className="empty-state"><p>No public collections yet.</p></div>
      )}
    </section>
  );
}
