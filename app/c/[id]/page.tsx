import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import ReportCollection from "@/components/ReportCollection";
import SaveCollectionButton from "@/components/SaveCollectionButton";
import { collectionExtras } from "@/lib/community";
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

export default async function MemberCollectionPage({ params }: Params) {
  const list = await load((await params).id);
  if (!list) notFound();
  const [films, { owner, saves }] = await Promise.all([getFilms(), collectionExtras(list.id, list.user_id)]);
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
          {owner ? <>A collection by {owner.is_private ? `@${owner.handle}` : <Link href={`/@${owner.handle}`}>@{owner.handle}</Link>}</> : "A collection on Pheelm"}
          {staffPick && <span className="staff-pick">Staff pick</span>}
        </p>
        <h1>{list.title}</h1>
        {list.description && <p className="lead">{list.description}</p>}
        {list.is_public && <div className="collection-actions"><SaveCollectionButton listId={list.id} ownerId={list.user_id} initialSaves={saves} /></div>}
      </header>
      <div className="section-head">
        <p className="label">{items.length} {items.length === 1 ? "film" : "films"}</p>
      </div>
      {items.length ? (
        <FilmGrid films={items.map(toCard)} />
      ) : (
        <div className="empty-state"><p>This collection is empty for now.</p></div>
      )}
      <div className="collection-foot">
        <p className="label">Make collections of your own: <Link href="/me">sign in and start saving films</Link>.</p>
        {list.is_public && <ReportCollection listId={list.id} />}
      </div>
    </section>
  );
}
