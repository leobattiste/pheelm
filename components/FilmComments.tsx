"use client";

import { useEffect, useRef, useState } from "react";
import Comments from "./Comments";
import { getBrowserClient } from "@/lib/supabase/client";
import { getComments, watchedBy, type CommentItem } from "@/lib/comments";

type Viewer = { id: string; handle: string | null; name: string | null; avatarUrl: string | null; isPrivate: boolean } | null;
type Loaded = { comments: CommentItem[]; viewer: Viewer; watched: string[] };

/** Gives up on a request that never answers, so the section can't stay on "Loading" forever. */
function within<T>(ms: number, work: PromiseLike<T>, fallback?: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => (fallback === undefined ? reject(new Error("timed out")) : resolve(fallback)), ms);
    Promise.resolve(work).then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}
const SESSION_MS = 3000; // past this, read the comments as signed out rather than wait
const LOAD_MS = 12000;   // past this, show "Try again"

/**
 * "What did you think?" on a film page. The page itself is cached for everyone, so the
 * conversation loads in the visitor's browser with their own session: their likes, their
 * profile, and only what they're allowed to see. Starts loading as it nears the screen.
 */
export default function FilmComments({ filmId, filmTitle }: { filmId: string; filmTitle: string }) {
  const [state, setState] = useState<Loaded | "loading" | "failed" | "off">("loading");
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) { setState("off"); return; }
    setState("loading"); // another film's comments must not show while this one's load
    let cancelled = false;
    const run = () => {
      setState("loading");
      void within(LOAD_MS, load()).catch(() => !cancelled && setState("failed"));
    };
    const load = async () => {
      // Checking who's signed in can wait on a token refresh; don't let that hold up the comments.
      const signedOut = { data: { session: null } } as Awaited<ReturnType<typeof db.auth.getSession>>;
      const { data: { session } } = await within(SESSION_MS, db.auth.getSession(), signedOut).catch(() => signedOut);
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
    if (attempt > 0 || !el || location.hash.startsWith("#comment") || typeof IntersectionObserver === "undefined") {
      run();
      return () => { cancelled = true; };
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [filmId, attempt]);

  // Opened from a notification or a profile: bring the comment into view once it's there.
  useEffect(() => {
    if (typeof state !== "object" || !location.hash.startsWith("#comment")) return;
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "center" });
  }, [state]);

  if (state === "off") return null;
  return (
    <div ref={box} className="film-comments">
      {state === "loading" ? (
        <section className="comments" id="comments" aria-busy="true" aria-label="Discussions">
          <div className="comments-head"><h2>Discussions</h2></div>
          <p className="comments-empty">Loading discussions…</p>
        </section>
      ) : state === "failed" ? (
        <section className="comments" aria-label="Discussions">
          <div className="comments-head"><h2>Discussions</h2></div>
          <p className="comments-empty" role="status">
            Comments didn&apos;t load.{" "}
            <button type="button" className="link-button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </p>
        </section>
      ) : (
        <Comments filmId={filmId} filmTitle={filmTitle} watchedIds={state.watched} initial={state.comments} viewer={state.viewer} />
      )}
    </div>
  );
}
