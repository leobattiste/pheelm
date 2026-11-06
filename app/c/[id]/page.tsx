import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import Comments from "@/components/Comments";
import ReportCollection from "@/components/ReportCollection";
import SaveCollectionButton from "@/components/SaveCollectionButton";
import { collectionExtras, type Member } from "@/lib/community";
import { untagMember } from "@/app/me/actions";
import { getComments } from "@/lib/comments";
import { getFilms, toCard } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** A member's collection, readable here only when they've made it public (or it's theirs). */
async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getServerClient();
  if (!db) return null;
  const { data } = await db
    .from("lists")
    .select("id, title, description, is_public, user_id, list_films(film_id, added_at)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const list = await load((await params).id);
  if (!list) return {};
  return { title: list.title, description: list.description ?? `A collection of ${list.list_films.length} films on Pheelm.`, robots: list.is_public ? undefined : { index: false } };
}

/** Whether staff picked it (a separate read, so the page works before community.sql has run). */
async function isStaffPick(id: string) {
  const db = await getServerClient();
  const { data } = (await db?.from("lists").select("staff_pick").eq("id", id).maybeSingle()) ?? { data: null };
  return !!(data as { staff_pick?: boolean } | null)?.staff_pick;
}

/** A member's @handle, linked to their profile unless it's private. */
function Handle({ m }: { m: Member }) {
  return m.is_private ? <>@{m.handle}</> : <Link href={`/@${m.handle}`}>@{m.handle}</Link>;
}

export default async function MemberCollectionPage({ params }: Params) {
  const list = await load((await params).id);
  if (!list) notFound();
  const [films, { owner, saves, tagged }] = await Promise.all([getFilms(), collectionExtras(list.id, list.user_id)]);
  const db = await getServerClient();
  const viewer = (await db?.auth.getUser())?.data.user ?? null;
  const youreTagged = !!viewer && tagged.some((t) => t.id === viewer.id);
  const [{ available: commentsOn, comments }, viewerProfile] = await Promise.all([
    list.is_public ? getComments(db, list.id, viewer?.id ?? null) : Promise.resolve({ available: false, comments: [] }),
    viewer && db ? db.from("profiles").select("*").eq("id", viewer.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const vp = (viewerProfile.data ?? null) as { handle?: string | null; display_name?: string | null; is_private?: boolean } | null;
  const staffPick = await isStaffPick(list.id);
  const byId = new Map(films.map((f) => [f.id, f]));
  const items = [...list.list_films]
    .sort((a, b) => b.added_at.localeCompare(a.added_at))
    .map((r) => byId.get(r.film_id))
    .filter((f) => f !== undefined);

  return (
    <section className="page">
      <header className="page-head">
        <p className="crumbs">
          {owner ? <>A collection by <Handle m={owner} /></> : "A collection on Pheelm"}
          {tagged.length > 0 && <> with {tagged.map((t, i) => <span key={t.id}>{i > 0 && (i === tagged.length - 1 ? " and " : ", ")}<Handle m={t} /></span>)}</>}
          {staffPick && <span className="staff-pick">Staff pick</span>}
        </p>
        <h1>{list.title}</h1>
        {list.description && <p className="lead">{list.description}</p>}
        {list.is_public && (
          <div className="collection-actions">
            <SaveCollectionButton listId={list.id} ownerId={list.user_id} initialSaves={saves} />
            {commentsOn && (
              <a className="button ghost" href="#comments">
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5z" /></svg>
                {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Comment"}
              </a>
            )}
            {youreTagged && (
              <form action={untagMember}>
                <input type="hidden" name="list_id" value={list.id} />
                <input type="hidden" name="back" value={`/c/${list.id}`} />
                <button type="submit" className="button ghost">Remove my tag</button>
              </form>
            )}
          </div>
        )}
      </header>
      <div className="section-head">
        <p className="label">{items.length} {items.length === 1 ? "film" : "films"}</p>
      </div>
      {items.length ? (
        <FilmGrid films={items.map(toCard)} />
      ) : (
        <div className="empty-state"><p>This collection is empty for now.</p></div>
      )}
      {commentsOn && (
        <Comments
          listId={list.id}
          ownerId={list.user_id}
          taggedIds={tagged.map((t) => t.id)}
          initial={comments}
          viewer={viewer ? { id: viewer.id, handle: vp?.handle ?? null, name: vp?.display_name ?? null, isPrivate: !!vp?.is_private } : null}
        />
      )}
      <div className="collection-foot">
        <p className="label">Make collections of your own: <Link href="/me">sign in and start saving films</Link>.</p>
        {list.is_public && <ReportCollection listId={list.id} />}
      </div>
    </section>
  );
}
