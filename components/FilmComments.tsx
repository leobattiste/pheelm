"use client";

import { useEffect, useRef, useState } from "react";
import Comments from "./Comments";
import { getBrowserClient } from "@/lib/supabase/client";
import { getComments, watchedBy, type CommentItem } from "@/lib/comments";

type Viewer = { id: string; handle: string | null; name: string | null; avatarUrl: string | null; isPrivate: boolean } | null;
type Loaded = { comments: CommentItem[]; viewer: Viewer; watched: string[] };

/**
 * "What did you think?" on a film page. The page itself is cached for everyone, so the
 * conversation loads in the visitor's browser with their own session: their likes, their
 * profile, and only what they're allowed to see. Starts loading as it nears the screen.
 */
export default function FilmComments({ filmId, filmTitle }: { filmId: string; filmTitle: string }) {
  const [state, setState] = useState<Loaded | "loading" | "off">("loading");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) { setState("off"); return; }
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await db.auth.getSession();
      const userId = session?.user.id ?? null;
      const [{ available, comments }, profile] = await Promise.all([
        getComments(db, { film: filmId }, userId),
        userId ? db.from("member_profiles").select("handle, display_name, avatar_url, is_private").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      if (!available) { setState("off"); return; }
      const p = profile.data as { handle: string | null; display_name: string | null; avatar_url: string | null; is_private: boolean | null } | null;
      const viewer: Viewer = userId ? { id: userId, handle: p?.handle ?? null, name: p?.display_name ?? null, avatarUrl: p?.avatar_url ?? null, isPrivate: !!p?.is_private } : null;
      // The viewer is included so their badge shows on a comment they post now.
      const watched = await watchedBy(db, filmId, [...new Set([...comments.map((c) => c.user_id), ...(userId ? [userId] : [])])]);
      if (!cancelled) setState({ comments, viewer, watched });
    };
    const el = box.current;
    // Load straight away for a link to a comment; otherwise as the section comes near.
    if (!el || location.hash.startsWith("#comment") || typeof IntersectionObserver === "undefined") {
      void load().catch(() => !cancelled && setState("off"));
      return () => { cancelled = true; };
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      void load().catch(() => !cancelled && setState("off"));
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [filmId]);

  // Opened from a notification or a profile: bring the comment into view once it's there.
  useEffect(() => {
    if (typeof state !== "object" || !location.hash.startsWith("#comment")) return;
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "center" });
  }, [state]);

  if (state === "off") return null;
  return (
    <div ref={box} className="film-comments">
      {state === "loading" ? (
        <section className="comments" aria-busy="true" aria-label="Comments">
          <div className="comments-head"><h2>Comments</h2></div>
          <p className="comments-empty">Loading comments…</p>
        </section>
      ) : (
        <Comments filmId={filmId} filmTitle={filmTitle} watchedIds={state.watched} initial={state.comments} viewer={state.viewer} />
      )}
    </div>
  );
}
