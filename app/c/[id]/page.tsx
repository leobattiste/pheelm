import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
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
    .select("id, title, description, is_public, list_films(film_id, added_at)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const list = await load((await params).id);
  if (!list) return {};
  return { title: list.title, description: list.description ?? `A collection of ${list.list_films.length} films on Pheelm.`, robots: list.is_public ? undefined : { index: false } };
}

export default async function MemberCollectionPage({ params }: Params) {
  const list = await load((await params).id);
  if (!list) notFound();
  const films = await getFilms();
  const byId = new Map(films.map((f) => [f.id, f]));
  const items = [...list.list_films]
    .sort((a, b) => b.added_at.localeCompare(a.added_at))
    .map((r) => byId.get(r.film_id))
    .filter((f) => f !== undefined);

  return (
    <section className="page">
      <header className="page-head">
        <p className="crumbs">A collection on Pheelm</p>
        <h1>{list.title}</h1>
        {list.description && <p className="lead">{list.description}</p>}
      </header>
      <div className="section-head">
        <p className="label">{items.length} {items.length === 1 ? "film" : "films"}</p>
      </div>
      {items.length ? (
        <FilmGrid films={items.map(toCard)} />
      ) : (
        <div className="empty-state"><p>This collection is empty for now.</p></div>
      )}
      <p className="label" style={{ marginTop: 48 }}>
        Make collections of your own: <Link href="/me">sign in and start saving films</Link>.
      </p>
    </section>
  );
}
