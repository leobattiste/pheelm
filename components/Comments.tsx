"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CommentAuthor, CommentItem } from "@/lib/comments";
import { postModeratedComment, editModeratedComment } from "@/app/c/comment-actions";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";
import UserAvatar from "./UserAvatar";
import Icon from "@/components/Icon";

type Viewer = { id: string; handle: string | null; name: string | null; avatarUrl?: string | null; isPrivate?: boolean } | null;
type Props = {
  listId: string;
  ownerId: string;
  collaboratorIds?: string[];
  pinnedId?: string | null;
  enabled?: boolean;
  initial: CommentItem[];
  viewer: Viewer;
};
type Sort = "top" | "new";

const MAX = 1000;
const REPLIES_SHOWN = 2;
const PIN = <Icon name="pin" />;

/** "now", "5m", "3h", "2d", then a date. */
function ago(iso: string, now: number) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d`;
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}) });
}

/** The comment's text, with line breaks kept and @handles linked to profiles. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(@[a-z0-9_]{3,24})\b/gi);
  return (
    <p className="comment-body">
      {parts.map((p, i) =>
        i % 2 ? <Link key={i} href={`/${p.toLowerCase()}`} className="mention">{p}</Link> : <Fragment key={i}>{p}</Fragment>,
      )}
    </p>
  );
}

/** A text box that grows with what's typed. Cmd/Ctrl+Enter sends; Escape cancels. */
function Composer({
  label, placeholder, initial = "", submitLabel, busy, autoFocus, onSubmit, onCancel,
}: {
  label: string; placeholder: string; initial?: string; submitLabel: string; busy: boolean; autoFocus?: boolean;
  onSubmit: (text: string) => Promise<boolean>; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = box.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  const left = MAX - text.length;
  const ready = text.trim().length > 0 && left >= 0 && !busy;
  const send = async () => {
    if (!ready) return;
    if (await onSubmit(text.trim())) setText("");
  };

  return (
    <div className="composer">
      <label className="visually-hidden" htmlFor={`c-${label}`}>{label}</label>
      <textarea
        id={`c-${label}`}
        ref={box}
        rows={1}
        value={text}
        placeholder={placeholder}
        maxLength={MAX + 200}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
          if (e.key === "Escape" && onCancel) { e.preventDefault(); onCancel(); }
        }}
      />
      <div className="composer-foot">
        <span className={`composer-count${left < 0 ? " over" : ""}`} aria-live="polite">{left < 100 ? `${left} left` : ""}</span>
        {onCancel && <button type="button" className="button quiet small" onClick={onCancel}>Cancel</button>}
        <button type="button" className="button small" disabled={!ready} onClick={send}>{busy ? "Posting…" : submitLabel}</button>
      </div>
    </div>
  );
}

/**
 * The conversation on a member's public collection: comments with one level of replies, likes,
 * editing and deleting, @mentions, and Top or Newest order. The owner can pin one comment and
 * turn comments off; the owner and collaborators can remove any comment (one with replies stays
 * as "Comment removed" so the thread reads); anyone signed in can report one. Changes show
 * straight away and are saved in the background; if saving fails, the change is undone.
 */
export default function Comments({ listId, ownerId, collaboratorIds = [], pinnedId = null, enabled = true, initial, viewer }: Props) {
  const [comments, setComments] = useState<CommentItem[]>(initial);
  const [sort, setSort] = useState<Sort>("top");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pinned, setPinned] = useState<string | null>(pinnedId);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  // Keep "5m ago" fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const me: CommentAuthor | null = viewer?.handle ? { id: viewer.id, handle: viewer.handle, display_name: viewer.name, avatar_url: viewer.avatarUrl, is_private: viewer.isPrivate } : null;
  const isOwner = viewer?.id === ownerId;
  const crew = useMemo(() => new Set(collaboratorIds), [collaboratorIds]);
  const canModerate = isOwner || (!!viewer && crew.has(viewer.id));

  const threads = useMemo(() => {
    const tops = comments.filter((c) => !c.parent_id);
    const replies = new Map<string, CommentItem[]>();
    for (const c of comments) if (c.parent_id) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
    const score = (c: CommentItem) => c.likes + (replies.get(c.id)?.length ?? 0) * 0.5;
    tops.sort(sort === "top"
      ? (a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at)
      : (a, b) => b.created_at.localeCompare(a.created_at));
    // The pinned comment leads; removed comments with no replies left drop out.
    const pin = tops.findIndex((c) => c.id === pinned);
    if (pin > 0) tops.unshift(...tops.splice(pin, 1));
    return tops.filter((c) => !c.removed_at || replies.get(c.id)?.length).map((c) => ({ c, replies: replies.get(c.id) ?? [] }));
  }, [comments, sort, pinned]);

  const fail = (message: string) => {
    setError(message);
    setTimeout(() => setError((e) => (e === message ? null : e)), 6000);
  };
  const reason = (e: { code?: string; message?: string } | null) =>
    e?.message?.includes("very fast") ? "You're commenting very fast. Wait a minute and try again." : "That didn't go through. Check your connection and try again.";

  const post = async (body: string, parentId: string | null) => {
    if (!viewer || !me) return false;
    setBusy(true);
    try {
      const result = await postModeratedComment({ listId, parentId, body });
      if (!result.ok) { fail(result.message); return false; }
      const comment: CommentItem = { ...result.comment, likes: 0, liked: false, author: me };
      setComments((cs) => [...cs, comment]);
      if (parentId) setOpen((o) => new Set(o).add(parentId));
      setReplyTo(null);
      return true;
    } catch {
      fail("That didn't go through. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (id: string, body: string) => {
    setBusy(true);
    try {
      const result = await editModeratedComment({ id, body });
      if (!result.ok) { fail(result.message); return false; }
      setComments((cs) => cs.map((c) =>
        c.id === id ? { ...c, body: result.comment.body, edited_at: result.comment.edited_at } : c));
      setEditing(null);
      return true;
    } catch {
      fail("Your comment couldn't be updated. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const db = getBrowserClient();
    if (!db) return;
    const before = comments;
    const target = comments.find((c) => c.id === id);
    const keepsReplies = !!target && !target.parent_id && comments.some((c) => c.parent_id === id);
    setComments((cs) => keepsReplies
      ? cs.map((c) => (c.id === id ? { ...c, removed_at: new Date().toISOString(), likes: 0, liked: false } : c))
      : cs.filter((c) => c.id !== id));
    if (pinned === id) setPinned(null);
    setConfirming(null);
    let { error: e } = await db.rpc("remove_comment", { cid: id });
    // Before collaboration.sql has run, delete directly (replies go with it).
    if (e && /function|schema cache/i.test(e.message ?? "")) {
      ({ error: e } = await db.from("list_comments").delete().eq("id", id));
      if (!e) setComments((cs) => cs.filter((c) => c.id !== id && c.parent_id !== id));
    }
    if (e) { setComments(before); fail(reason(e)); }
  };

  const togglePin = async (id: string) => {
    const db = getBrowserClient();
    if (!db) return;
    const next = pinned === id ? null : id;
    const before = pinned;
    setPinned(next);
    const { error: e } = await db.from("lists").update({ pinned_comment_id: next }).eq("id", listId);
    if (e) { setPinned(before); fail(reason(e)); }
    else if (next) setSort("top");
  };

  const report = async (id: string) => {
    const db = getBrowserClient();
    if (!db || !viewer) return;
    setReporting(null);
    setReported((r) => new Set(r).add(id));
    const { error: e } = await db.from("comment_reports").insert({ comment_id: id, user_id: viewer.id, reason: "Reported from the watchlist page" });
    if (e) {
      setReported((r) => { const n = new Set(r); n.delete(id); return n; });
      fail(reason(e));
    }
  };

  const like = async (c: CommentItem) => {
    if (!viewer) { openSignIn(); return; }
    const db = getBrowserClient();
    if (!db || c.id.startsWith("temp-")) return;
    const on = !c.liked;
    const flip = (x: CommentItem) => (x.id === c.id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x);
    setComments((cs) => cs.map(flip));
    const { error: e } = on
      ? await db.from("comment_likes").insert({ comment_id: c.id, user_id: viewer.id })
      : await db.from("comment_likes").delete().eq("comment_id", c.id).eq("user_id", viewer.id);
    if (e && e.code !== "23505") {
      setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, liked: !on, likes: x.likes + (on ? -1 : 1) } : x)));
      fail(reason(e));
    }
  };

  const total = comments.filter((c) => !c.removed_at).length;

  const item = (c: CommentItem, reply = false) => {
    const a = c.author;
    const name = a?.display_name || (a ? `@${a.handle}` : "A former member");
    const mine = viewer?.id === c.user_id;
    const pending = c.id.startsWith("temp-");
    if (c.removed_at) {
      return (
        <article className="comment is-removed" id={`comment-${c.id}`}>
          <span className="comment-avatar" aria-hidden="true" />
          <div className="comment-main"><p className="comment-body">Comment removed</p></div>
        </article>
      );
    }
    const isPinned = !reply && pinned === c.id;
    return (
      <article className={`comment${reply ? " is-reply" : ""}${pending ? " is-pending" : ""}`} id={`comment-${c.id}`} aria-busy={pending}>
        <UserAvatar person={a ?? {}} className="comment-avatar" />
        <div className="comment-main">
          <header className="comment-head">
            {a && !a.is_private ? <Link href={`/@${a.handle}`} className="comment-name">{name}</Link> : <span className="comment-name">{name}</span>}
            {c.user_id === ownerId && <span className="comment-badge">Owner</span>}
            {c.user_id !== ownerId && crew.has(c.user_id) && <span className="comment-badge">Co-curator</span>}
            {isPinned && <span className="comment-pinned">{PIN}Pinned</span>}
            <time className="comment-time" dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()}>{pending ? "Posting…" : ago(c.created_at, now)}</time>
            {c.edited_at && <span className="comment-time">• edited</span>}
          </header>

          {editing === c.id ? (
            <Composer label={`Edit comment ${c.id}`} placeholder="Edit your comment" initial={c.body} submitLabel="Save" busy={busy} autoFocus
              onSubmit={(t) => save(c.id, t)} onCancel={() => setEditing(null)} />
          ) : (
            <Body text={c.body} />
          )}

          {editing !== c.id && !pending && (
            <div className="comment-actions">
              <button type="button" className={`comment-act like${c.liked ? " on" : ""}`} aria-pressed={c.liked} onClick={() => like(c)}
                aria-label={`${c.liked ? "Unlike" : "Like"} (${c.likes} ${c.likes === 1 ? "like" : "likes"})`}>
                <Icon name="heart" />
                {c.likes > 0 && <span>{c.likes}</span>}
              </button>
              {!reply && enabled && (
                <button type="button" className="comment-act" onClick={() => (me ? setReplyTo(replyTo === c.id ? null : c.id) : viewer ? undefined : openSignIn())}
                  disabled={!!viewer && !me}>Reply</button>
              )}
              {mine && <button type="button" className="comment-act" onClick={() => { setEditing(c.id); setConfirming(null); }}>Edit</button>}
              {isOwner && !reply && <button type="button" className="comment-act" onClick={() => togglePin(c.id)}>{isPinned ? "Unpin" : "Pin"}</button>}
              {(mine || canModerate) && (confirming === c.id ? (
                <span className="comment-confirm" role="group" aria-label="Delete this comment?">
                  {mine ? "Delete" : "Remove"} this comment?
                  <button type="button" className="comment-act danger" onClick={() => remove(c.id)}>Delete</button>
                  <button type="button" className="comment-act" onClick={() => setConfirming(null)}>Keep</button>
                </span>
              ) : (
                <button type="button" className="comment-act" onClick={() => setConfirming(c.id)}>{mine ? "Delete" : "Remove"}</button>
              ))}
              {viewer && !mine && !canModerate && (reported.has(c.id) ? (
                <span className="comment-time">Reported. Thanks.</span>
              ) : reporting === c.id ? (
                <span className="comment-confirm" role="group" aria-label="Report this comment?">
                  Report to Pheelm?
                  <button type="button" className="comment-act danger" onClick={() => report(c.id)}>Report</button>
                  <button type="button" className="comment-act" onClick={() => setReporting(null)}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="comment-act" onClick={() => setReporting(c.id)}>Report</button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="comments" id="comments" aria-labelledby="comments-h">
      <div className="comments-head">
        <h2 id="comments-h">Comments{total ? <span className="comments-count"> {total}</span> : null}</h2>
        {total > 1 && (
          <div className="segmented" role="radiogroup" aria-label="Order comments">
            <button type="button" role="radio" aria-checked={sort === "top"} onClick={() => setSort("top")}>Top</button>
            <button type="button" role="radio" aria-checked={sort === "new"} onClick={() => setSort("new")}>Newest</button>
          </div>
        )}
      </div>

      {!enabled ? (
        <p className="comments-gate">Comments are turned off for this watchlist.</p>
      ) : me ? (
        <div className="comment-new">
          <UserAvatar person={me} className="comment-avatar" />
          <Composer label="Add a comment" placeholder={isOwner ? "Say something about your watchlist" : "Add a comment"} submitLabel="Post" busy={busy}
            onSubmit={(t) => post(t, null)} />
        </div>
      ) : viewer ? (
        <p className="comments-gate">
          <Link href="/profile">Create your profile</Link> to join the conversation. Comments show your name and @handle.
        </p>
      ) : (
        <button type="button" className="comments-gate as-button" onClick={() => openSignIn()}>
          <span className="comment-avatar" aria-hidden="true">?</span>
          <span>Sign in to join the conversation</span>
        </button>
      )}

      {error && <p className="notice error" role="alert">{error}</p>}

      {threads.length ? (
        <ol className="comment-list">
          {threads.map(({ c, replies }) => {
            const expanded = open.has(c.id) || replies.length <= REPLIES_SHOWN;
            const shown = expanded ? replies : replies.slice(0, REPLIES_SHOWN);
            return (
              <li key={c.id} className="thread">
                {item(c)}
                {(shown.length > 0 || replyTo === c.id) && (
                  <ol className="replies">
                    {shown.map((r) => <li key={r.id}>{item(r, true)}</li>)}
                    {!expanded && (
                      <li>
                        <button type="button" className="comment-act more-replies" onClick={() => setOpen((o) => new Set(o).add(c.id))}>
                          Show {replies.length - REPLIES_SHOWN} more {replies.length - REPLIES_SHOWN === 1 ? "reply" : "replies"}
                        </button>
                      </li>
                    )}
                    {replyTo === c.id && me && (
                      <li className="comment-new is-reply">
                        <UserAvatar person={me} className="comment-avatar" />
                        <Composer label={`Reply to ${c.id}`} placeholder={`Reply to ${c.author?.display_name || "this comment"}`} submitLabel="Reply" busy={busy} autoFocus
                          initial={c.author && c.user_id !== viewer?.id ? `@${c.author.handle} ` : ""}
                          onSubmit={(t) => post(t, c.id)} onCancel={() => setReplyTo(null)} />
                      </li>
                    )}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="comments-empty">No comments yet. Start the conversation.</p>
      )}
    </section>
  );
}
