import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "./community";

export type NotificationType =
  | "invite" | "request" | "invite_accepted" | "invite_declined"
  | "request_accepted" | "request_declined" | "removed" | "comment" | "reply" | "mention" | "new_film" | "collection_film"
  // For admins: things to review, and new members (owner only). For curators: their collection was featured.
  | "report" | "comment_report" | "submission" | "message" | "new_member" | "featured";

export type Notification = {
  id: string;
  type: NotificationType;
  created_at: string;
  read_at: string | null;
  actor: Member | null;
  list: { id: string; title: string } | null;
  comment: { id: string; body: string } | null;
  /** For new films: the film, and the followed director it's by. */
  film: { slug: string; title: string; year: number | null; poster_url: string | null } | null;
  person: { slug: string; name: string } | null;
  /** For invites and requests: whether it can still be answered, and the requester's note. */
  open: boolean;
  note: string | null;
  /** For admin notifications: a short summary (the report's reason, the film suggested, the message). */
  detail: string | null;
};

type Row = { id: string; type: NotificationType; created_at: string; read_at: string | null; actor_id: string | null; list_id: string | null; comment_id: string | null; user_id: string; film_id?: string | null; person_id?: string | null; detail?: string | null };

/**
 * The signed-in member's latest notifications, with who did it, which collection, the comment it's
 * about, and for invites and requests whether they're still waiting for an answer.
 */
export async function getNotifications(db: SupabaseClient, userId: string, limit = 60): Promise<{ available: boolean; items: Notification[] }> {
  const query = (cols: string) => db.from("notifications").select(cols).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  let { data, error } = await query("id, type, created_at, read_at, actor_id, list_id, comment_id, user_id, film_id, person_id, detail");
  // Before admins-watched-blocks.sql has run there's no detail.
  if (error) ({ data, error } = await query("id, type, created_at, read_at, actor_id, list_id, comment_id, user_id, film_id, person_id"));
  // Before follow-notifications.sql has run there are no film columns.
  if (error) ({ data, error } = await query("id, type, created_at, read_at, actor_id, list_id, comment_id, user_id"));
  if (error) return { available: false, items: [] };
  const rows = (data ?? []) as unknown as Row[];
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const actorIds = uniq(rows.map((r) => r.actor_id));
  const listIds = uniq(rows.map((r) => r.list_id));
  const commentIds = uniq(rows.map((r) => r.comment_id));
  const filmIds = uniq(rows.map((r) => r.film_id ?? null));
  const personIds = uniq(rows.map((r) => r.person_id ?? null));

  const [actors, lists, comments, members, films, people] = await Promise.all([
    actorIds.length ? db.from("member_profiles").select("id, handle, display_name, is_private, avatar_url").in("id", actorIds) : null,
    listIds.length ? db.from("lists").select("id, title, user_id").in("id", listIds) : null,
    commentIds.length ? db.from("list_comments").select("id, body, removed_at").in("id", commentIds) : null,
    listIds.length ? db.from("list_members").select("list_id, user_id, status, note").in("list_id", listIds) : null,
    filmIds.length ? db.from("films").select("id, slug, title, year, poster_url").in("id", filmIds) : null,
    personIds.length ? db.from("people").select("id, slug, name").in("id", personIds) : null,
  ]);
  const filmBy = new Map(((films?.data ?? []) as { id: string; slug: string; title: string; year: number | null; poster_url: string | null }[]).map((f) => [f.id, f]));
  const personBy = new Map(((people?.data ?? []) as { id: string; slug: string; name: string }[]).map((p) => [p.id, p]));
  const actorBy = new Map(((actors?.data ?? []) as Member[]).map((a) => [a.id, a]));
  const listBy = new Map(((lists?.data ?? []) as { id: string; title: string }[]).map((l) => [l.id, l]));
  const commentBy = new Map(((comments?.data ?? []) as { id: string; body: string; removed_at: string | null }[]).filter((c) => !c.removed_at).map((c) => [c.id, c]));
  const memberRows = (members?.data ?? []) as { list_id: string; user_id: string; status: string; note: string | null }[];
  const status = (lid: string | null, uid: string | null) => memberRows.find((m) => m.list_id === lid && m.user_id === uid);

  return {
    available: true,
    items: rows.map((r) => {
      // An invite is about me; a request is about the person asking.
      const m = r.type === "invite" ? status(r.list_id, userId) : r.type === "request" ? status(r.list_id, r.actor_id) : undefined;
      return {
        id: r.id,
        type: r.type,
        created_at: r.created_at,
        read_at: r.read_at,
        actor: (r.actor_id && actorBy.get(r.actor_id)) || null,
        list: (r.list_id && listBy.get(r.list_id)) || null,
        comment: (r.comment_id && commentBy.get(r.comment_id)) || null,
        film: (r.film_id && filmBy.get(r.film_id)) || null,
        person: (r.person_id && personBy.get(r.person_id)) || null,
        open: r.type === "invite" ? m?.status === "invited" : r.type === "request" ? m?.status === "requested" : false,
        note: r.type === "request" ? m?.note ?? null : null,
        detail: r.detail ?? null,
      };
    }),
  };
}

/** How many unread notifications the signed-in member has (0 until collaboration.sql has run). */
export async function unreadCount(db: SupabaseClient, userId: string) {
  const { count, error } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return error ? 0 : count ?? 0;
}
