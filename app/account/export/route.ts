import { NextResponse } from "next/server";
import { getServerClient, getViewer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Your data, as a JSON file: your profile, Watchlist, collections (with their films), the
 * directors, collections and members you follow, your comments and likes, the films you suggested,
 * your collaborations, notifications and email and notification settings.
 */
export async function GET() {
  const db = await getServerClient();
  if (!db) return NextResponse.json({ error: "Accounts aren't available." }, { status: 503 });
  const user = await getViewer(db);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [profile, watchlist, lists, follows, saves, comments, submissions, watched, blocks, memberFollows, collaborations, likes, notifications, emailPrefs, notificationPrefs, tour] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("watchlist").select("added_at, films(title, year, slug)").eq("user_id", user.id).order("added_at"),
    db.from("lists").select("title, description, is_public, created_at, list_films(added_at, films(title, year, slug))").eq("user_id", user.id),
    db.from("follows").select("created_at, people(name, slug)").eq("user_id", user.id),
    db.from("list_saves").select("created_at, lists(title, id)").eq("user_id", user.id),
    db.from("list_comments").select("body, created_at, list_id, film_id").eq("user_id", user.id),
    db.from("submissions").select("title, director, year, status, created_at").eq("user_id", user.id),
    db.from("watched").select("watched_at, films(title, year, slug)").eq("user_id", user.id).order("watched_at"),
    db.from("blocks").select("created_at, blocked_id").eq("blocker_id", user.id),
    db.from("member_follows").select("created_at, followed_id").eq("follower_id", user.id),
    db.from("list_members").select("list_id, status, note, created_at, responded_at, lists(title)").eq("user_id", user.id),
    db.from("comment_likes").select("comment_id, created_at").eq("user_id", user.id),
    db.from("notifications").select("type, detail, created_at, read_at, list_id, film_id, person_id").eq("user_id", user.id).order("created_at"),
    db.from("email_preferences").select("collaboration_emails, activity_emails, announcement_emails, digest_frequency").eq("user_id", user.id).maybeSingle(),
    db.from("notification_preferences").select("disabled_types").eq("user_id", user.id).maybeSingle(),
    db.from("tour_progress").select("state, updated_at").eq("user_id", user.id).maybeSingle(),
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
    following_members: memberFollows.data ?? [],
    collaborations: collaborations.data ?? [],
    comment_likes: likes.data ?? [],
    notifications: notifications.data ?? [],
    email_settings: emailPrefs.data,
    notification_settings: notificationPrefs.data,
    tour_progress: tour.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pheelm-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
