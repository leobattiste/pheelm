"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CommentAuthor, CommentItem } from "@/lib/comments";
import { initials } from "@/lib/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";

type Viewer = { id: string; handle: string | null; name: string | null; isPrivate?: boolean } | null;
type Props = {
  listId: string;
  ownerId: string;
  taggedIds: string[];
  initial: CommentItem[];
  viewer: Viewer;
};
type Sort = "top" | "new";

const MAX = 1000;
const REPLIES_SHOWN = 2;
const SELECT = "id, parent_id, user_id, body, created_at, edited_at";

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
 * editing and deleting, @mentions, and Top or Newest order. Changes show straight away and are
 * saved in the background; if saving fails, the change is undone and a note explains why.
 */
export default function Comments({ listId, ownerId, taggedIds, initial, viewer }: Props) {
  const [comments, setComments] = useState<CommentItem[]>(initial);
  const [sort, setSort] = useState<Sort>("top");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Keep "5m ago" fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const me: CommentAuthor | null = viewer?.handle ? { id: viewer.id, handle: viewer.handle, display_name: viewer.name, is_private: viewer.isPrivate } : null;
  const isOwner = viewer?.id === ownerId;
  const tagged = useMemo(() => new Set(taggedIds), [taggedIds]);

  const threads = useMemo(() => {
    const tops = comments.filter((c) => !c.parent_id);
    const replies = new Map<string, CommentItem[]>();
    for (const c of comments) if (c.parent_id) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
    const score = (c: CommentItem) => c.likes + (replies.get(c.id)?.length ?? 0) * 0.5;
    tops.sort(sort === "top"
      ? (a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at)
      : (a, b) => b.created_at.localeCompare(a.created_at));
    return tops.map((c) => ({ c, replies: replies.get(c.id) ?? [] }));
  }, [comments, sort]);

  const fail = (message: string) => {
    setError(message);
    setTimeout(() => setError((e) => (e === message ? null : e)), 6000);
  };
  const reason = (e: { code?: string; message?: string } | null) =>
    e?.message?.includes("very fast") ? "You're commenting very fast. Wait a minute and try again." : "That didn't go through. Check your connection and try again.";

  const post = async (body: string, parentId: string | null) => {
    const db = getBrowserClient();
    if (!db || !viewer || !me) return false;
    setBusy(true);
    const temp: CommentItem = {
      id: `temp-${Date.now()}`, parent_id: parentId, user_id: viewer.id, body,
      created_at: new Date().toISOString(), edited_at: null, likes: 0, liked: false, author: me,
    };
    setComments((cs) => [...cs, temp]);
    if (parentId) setOpen((o) => new Set(o).add(parentId));
    const { data, error: e } = await db.from("list_comments").insert({ list_id: listId, user_id: viewer.id, parent_id: parentId, body }).select(SELECT).single();
    setBusy(false);
    if (e || !data) {
      setComments((cs) => cs.filter((c) => c.id !== temp.id));
      fail(reason(e));
      return false;
    }
    setComments((cs) => cs.map((c) => (c.id === temp.id ? { ...temp, ...(data as Partial<CommentItem>) } : c)));
    setReplyTo(null);
    return true;
  };

  const save = async (id: string, body: string) => {
    const db = getBrowserClient();
    if (!db) return false;
    const before = comments.find((c) => c.id === id);
    setComments((cs) => cs.map((c) => (c.id === id ? { ...c, body, edited_at: new Date().toISOString() } : c)));
    setEditing(null);
    const { error: e } = await db.from("list_comments").update({ body }).eq("id", id);
    if (e && before) {
      setComments((cs) => cs.map((c) => (c.id === id ? before : c)));
      fail(reason(e));
      return false;
    }
    return true;
  };

  const remove = async (id: string) => {
    const db = getBrowserClient();
    if (!db) return;
    const before = comments;
    setComments((cs) => cs.filter((c) => c.id !== id && c.parent_id !== id));
    setConfirming(null);
    const { error: e } = await db.from("list_comments").delete().eq("id", id);
    if (e) { setComments(before); fail(reason(e)); }
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

  const total = comments.length;

  const item = (c: CommentItem, reply = false) => {
    const a = c.author;
    const name = a?.display_name || (a ? `@${a.handle}` : "A former member");
    const mine = viewer?.id === c.user_id;
    const pending = c.id.startsWith("temp-");
    return (
      <article className={`comment${reply ? " is-reply" : ""}${pending ? " is-pending" : ""}`} id={`comment-${c.id}`} aria-busy={pending}>
        <span className="comment-avatar" aria-hidden="true">{initials((a?.display_name || a?.handle || "?").replace(/^@/, ""))}</span>
        <div className="comment-main">
          <header className="comment-head">
            {a && !a.is_private ? <Link href={`/@${a.handle}`} className="comment-name">{name}</Link> : <span className="comment-name">{name}</span>}
            {c.user_id === ownerId && <span className="comment-badge">Curator</span>}
            {c.user_id !== ownerId && tagged.has(c.user_id) && <span className="comment-badge">Tagged</span>}
            <time className="comment-time" dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()}>{pending ? "Posting…" : ago(c.created_at, now)}</time>
            {c.edited_at && <span className="comment-time">• edited</span>}
          </header>

          {editing === c.id ? (
            <Composer label={`Edit comment ${c.id}`} placeholder="Edit your comment" initial={c.body} submitLabel="Save" busy={false} autoFocus
              onSubmit={(t) => save(c.id, t)} onCancel={() => setEditing(null)} />
          ) : (
            <Body text={c.body} />
          )}

          {editing !== c.id && !pending && (
            <div className="comment-actions">
              <button type="button" className={`comment-act like${c.liked ? " on" : ""}`} aria-pressed={c.liked} onClick={() => like(c)}
                aria-label={`${c.liked ? "Unlike" : "Like"} (${c.likes} ${c.likes === 1 ? "like" : "likes"})`}>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16.5s-6-3.6-6-8.1A3.4 3.4 0 0 1 10 6.3a3.4 3.4 0 0 1 6 2.1c0 4.5-6 8.1-6 8.1z" /></svg>
                {c.likes > 0 && <span>{c.likes}</span>}
              </button>
              {!reply && (
                <button type="button" className="comment-act" onClick={() => (me ? setReplyTo(replyTo === c.id ? null : c.id) : viewer ? undefined : openSignIn())}
                  disabled={!!viewer && !me}>Reply</button>
              )}
              {mine && <button type="button" className="comment-act" onClick={() => { setEditing(c.id); setConfirming(null); }}>Edit</button>}
              {(mine || isOwner) && (confirming === c.id ? (
                <span className="comment-confirm" role="group" aria-label="Delete this comment?">
                  Delete{!reply && comments.some((x) => x.parent_id === c.id) ? " with replies" : ""}?
                  <button type="button" className="comment-act danger" onClick={() => remove(c.id)}>Delete</button>
                  <button type="button" className="comment-act" onClick={() => setConfirming(null)}>Keep</button>
                </span>
              ) : (
                <button type="button" className="comment-act" onClick={() => setConfirming(c.id)}>{mine ? "Delete" : "Remove"}</button>
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

      {me ? (
        <div className="comment-new">
          <span className="comment-avatar" aria-hidden="true">{initials((me.display_name || me.handle).replace(/^@/, ""))}</span>
          <Composer label="Add a comment" placeholder={isOwner ? "Say something about your collection" : "Add a comment"} submitLabel="Post" busy={busy}
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
                        <span className="comment-avatar" aria-hidden="true">{initials((me.display_name || me.handle).replace(/^@/, ""))}</span>
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
