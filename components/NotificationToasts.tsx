"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { NotificationType } from "@/lib/notifications";
import { toast } from "./Toast";

type Row = { id: string; type: NotificationType; created_at: string; actor_id: string | null; list_id: string | null; film_id?: string | null; person_id?: string | null };

const EVERY = 45_000;

/** One line for a new notification: "Sam replied to your comment". */
function line(r: Row, who: string, list?: string, film?: string, person?: string): string {
  switch (r.type) {
    case "comment": return `${who} commented on ${list ? `“${list}”` : "your watchlist"}`;
    case "reply": return `${who} replied to your comment`;
    case "mention": return `${who} mentioned you in a comment`;
    case "invite": return `${who} invited you to co-curate ${list ? `“${list}”` : "a watchlist"}`;
    case "request": return `${who} asked to co-curate ${list ? `“${list}”` : "your watchlist"}`;
    case "invite_accepted": return `${who} accepted your invite`;
    case "invite_declined": return `${who} declined your invite`;
    case "request_accepted": return `${who} approved your request`;
    case "request_declined": return `${who} declined your request`;
    case "removed": return `${who} removed you from ${list ? `“${list}”` : "a watchlist"}`;
    case "new_film": return `New film${film ? `: ${film}` : ""}${person ? ` by ${person}` : ""}`;
    case "collection_film": return `A film was added to ${list ? `“${list}”` : "a watchlist you follow"}`;
    case "featured": return `Your watchlist${list ? ` “${list}”` : ""} was featured`;
    case "report": return "A watchlist was reported";
    case "comment_report": return "A comment was reported";
    case "submission": return "New film suggestion to review";
    case "message": return "New message to answer";
    case "new_member": return "A new member joined";
    default: return "You have a new notification";
  }
}

/**
 * Shows a toast when a notification arrives while you're on the site (it checks every 45 seconds
 * and when you come back to the tab). Notifications from before you opened the page aren't shown,
 * and nothing shows on the Notifications page itself, which lists them.
 */
export default function NotificationToasts() {
  const path = usePathname();
  const onNotifications = useRef(false);
  onNotifications.current = path === "/notifications";

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return;
    let active = true;
    let userId: string | null = null;
    let since: string | null = null;
    let busy = false;

    const check = async () => {
      if (!userId || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        if (since === null) {
          // Start from the newest one that's already there, so only later ones show.
          const { data, error } = await db.from("notifications").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
          if (error) return;
          since = (data?.[0] as { created_at: string } | undefined)?.created_at ?? new Date(Date.now() - 1000).toISOString();
          return;
        }
        const { data, error } = await db.from("notifications")
          .select("id, type, created_at, actor_id, list_id, film_id, person_id")
          .eq("user_id", userId).is("read_at", null).gt("created_at", since).order("created_at", { ascending: true }).limit(10);
        if (error || !data?.length) return;
        const rows = data as unknown as Row[];
        since = rows[rows.length - 1].created_at;
        window.dispatchEvent(new Event("notificationschange"));
        if (!active || onNotifications.current) return;
        const view = { label: "View", href: "/notifications" };
        if (rows.length > 3) { toast(`${rows.length} new notifications`, { action: view, duration: 8000 }); return; }
        const ids = (key: "actor_id" | "list_id" | "film_id" | "person_id") => [...new Set(rows.map((r) => r[key]).filter((x): x is string => !!x))];
        const [actors, lists, films, people] = await Promise.all([
          ids("actor_id").length ? db.from("member_profiles").select("id, handle, display_name").in("id", ids("actor_id")) : null,
          ids("list_id").length ? db.from("lists").select("id, title").in("id", ids("list_id")) : null,
          ids("film_id").length ? db.from("films").select("id, title").in("id", ids("film_id")) : null,
          ids("person_id").length ? db.from("people").select("id, name").in("id", ids("person_id")) : null,
        ]);
        const byId = <T extends { id: string }>(res: { data: unknown } | null) => new Map(((res?.data ?? []) as T[]).map((x) => [x.id, x]));
        const actorBy = byId<{ id: string; handle: string | null; display_name: string | null }>(actors);
        const listBy = byId<{ id: string; title: string }>(lists);
        const filmBy = byId<{ id: string; title: string }>(films);
        const personBy = byId<{ id: string; name: string }>(people);
        for (const r of rows) {
          const a = r.actor_id ? actorBy.get(r.actor_id) : undefined;
          const who = a?.display_name || (a?.handle ? `@${a.handle}` : "Someone");
          toast(line(r, who, r.list_id ? listBy.get(r.list_id)?.title : undefined, r.film_id ? filmBy.get(r.film_id)?.title : undefined, r.person_id ? personBy.get(r.person_id)?.name : undefined), { action: view, duration: 8000 });
        }
      } catch {
        // Try again at the next check.
      } finally {
        busy = false;
      }
    };

    const start = async () => {
      const { data } = await db.auth.getSession();
      const next = data.session?.user.id ?? null;
      if (next !== userId) { userId = next; since = null; }
      if (userId) void check();
    };
    void start();
    const { data: sub } = db.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void start(); }, 0); });
    const every = setInterval(() => void check(), EVERY);
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(every); document.removeEventListener("visibilitychange", visible); sub.subscription.unsubscribe(); };
  }, []);

  return null;
}
