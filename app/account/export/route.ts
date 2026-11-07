import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Your data, as a JSON file: your profile, Watchlist, collections (with their films), the
 * directors and collections you follow, your comments and the films you suggested.
 */
export async function GET() {
  const db = await getServerClient();
  if (!db) return NextResponse.json({ error: "Accounts aren't available." }, { status: 503 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [profile, watchlist, lists, follows, saves, comments, submissions, watched, blocks] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("watchlist").select("added_at, films(title, year, slug)").eq("user_id", user.id).order("added_at"),
    db.from("lists").select("title, description, is_public, created_at, list_films(added_at, films(title, year, slug))").eq("user_id", user.id),
    db.from("follows").select("created_at, people(name, slug)").eq("user_id", user.id),
    db.from("list_saves").select("created_at, lists(title, id)").eq("user_id", user.id),
    db.from("list_comments").select("body, created_at, list_id").eq("user_id", user.id),
    db.from("submissions").select("title, director, year, status, created_at").eq("user_id", user.id),
    db.from("watched").select("watched_at, films(title, year, slug)").eq("user_id", user.id).order("watched_at"),
    db.from("blocks").select("created_at, blocked_id").eq("blocker_id", user.id),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    email: user.email,
    profile: profile.data,
    watchlist: watchlist.data ?? [],
    watched: watched.data ?? [],
    collections: lists.data ?? [],
    following_directors: follows.data ?? [],
    following_collections: saves.data ?? [],
    comments: comments.data ?? [],
    submissions: submissions.data ?? [],
    blocked: blocks.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pheelm-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
