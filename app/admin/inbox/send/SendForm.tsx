"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewReach, sendCampaign, sendTest } from "./actions";
import { AUDIENCES, KINDS, type Audience, type Channel, type Draft, type Kind, type Reach, type Targets } from "./shared";

const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const EMPTY = { subject: "", message: "", link: "", label: "" };

/**
 * Write a message, choose who gets it and how, see how many it reaches, send yourself a test, then send.
 * The count is checked again when it's sent; if it changed, nothing goes out.
 */
export default function SendForm({ targets, owner }: { targets: Targets; owner: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("announcement");
  const [audience, setAudience] = useState<Exclude<Audience, "subscribers">>("members");
  const [ref, setRef] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["in_app", "email"]);
  const [words, setWords] = useState(EMPTY);
  const [answer, setAnswer] = useState<{ key: string; reach: Reach } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, startBusy] = useTransition();
  const newsletter = kind === "newsletter";
  const options = audience === "followers" ? targets.directors : audience === "watchlisted" ? targets.films : audience === "member" ? targets.members : [];
  const needsRef = !newsletter && audience !== "members";
  const draft: Draft = useMemo(() => ({
    kind, audience: newsletter ? "subscribers" : audience, ref: needsRef ? ref || null : null,
    channels: newsletter ? ["email"] : channels, ...words,
  }), [kind, audience, ref, channels, words, newsletter, needsRef]);

  // Count who it reaches whenever the audience or channels change. An answer only counts for the
  // choices it was asked about, so a slow one never shows for newer choices.
  const reachKey = `${draft.kind}|${draft.audience}|${draft.ref}|${draft.channels.join(",")}`;
  const waiting = (needsRef && !ref) || !draft.channels.length;
  const latest = useRef(draft);
  useEffect(() => { latest.current = draft; });
  const ask = (key: string) => void previewReach(latest.current).then((r) => setAnswer({ key, reach: r }));
  useEffect(() => {
    if (waiting) return;
    const t = setTimeout(() => ask(reachKey), 250);
    return () => clearTimeout(t);
  }, [reachKey, waiting]);
  const reach: Reach | null = !draft.channels.length ? { ok: false, message: "Choose in-app, email or both." } : answer?.key === reachKey ? answer.reach : null;
  // Changing anything after "Send to…" asks for confirmation again.
  const confirmFor = `${reachKey}|${words.subject}|${words.message}|${words.link}|${words.label}`;
  const confirming = confirmKey === confirmFor;

  const set = (k: keyof typeof EMPTY) => (e: { currentTarget: { value: string } }) => { const value = e.currentTarget.value; setWords((w) => ({ ...w, [k]: value })); };
  const toggle = (c: Channel) => setChannels((cs) => (["in_app", "email"] as Channel[]).filter((x) => x === c ? !cs.includes(c) : cs.includes(x)));
  const written = words.subject.trim().length >= 3 && words.message.trim().length > 0;
  const count = reach?.ok ? reach.recipients : 0;
  const canSend = owner && written && count > 0 && !busy;

  const test = () => startBusy(async () => { setStatus(null); setStatus(await sendTest(draft)); });
  const send = () => startBusy(async () => {
    setStatus(null);
    const result = await sendCampaign(draft, count);
    setStatus(result);
    setConfirmKey(null);
    if (result.ok) { setWords(EMPTY); router.refresh(); }
    else ask(reachKey);
  });

  return (
    <form className="form admin-send" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="admin-send-group">
        <legend>Kind</legend>
        <div className="chip-list admin-send-kinds" role="group" aria-label="Kind">
          {KINDS.map((k) => (
            <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
          ))}
        </div>
        <p className="field-hint">{KINDS.find((k) => k.id === kind)?.about}</p>
      </fieldset>

      <fieldset className="admin-send-group">
        <legend>Who gets it</legend>
        {newsletter ? <p className="muted">Newsletter subscribers who confirmed their email.</p> : <>
          <label className="field">
            <span className="visually-hidden">Audience</span>
            <select aria-label="Audience" value={audience} onChange={(e) => { setAudience(e.currentTarget.value as typeof audience); setRef(""); }}>
              {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          {needsRef && (
            <label className="field">
              {audience === "followers" ? "Director" : audience === "watchlisted" ? "Film" : "Member"}
              <select aria-label={audience === "followers" ? "Director" : audience === "watchlisted" ? "Film" : "Member"} value={ref} onChange={(e) => setRef(e.currentTarget.value)} required>
                <option value="">{options.length ? "Choose…" : audience === "followers" ? "No directors have followers yet" : audience === "watchlisted" ? "No films are in watchlists yet" : "No members yet"}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.count != null ? ` (${o.count.toLocaleString("en-US")})` : ""}</option>)}
              </select>
            </label>
          )}
        </>}
      </fieldset>

      <fieldset className="admin-send-group">
        <legend>How</legend>
        {newsletter ? <p className="muted">By email only.</p> : <div className="admin-send-channels">
          <label className="check"><input type="checkbox" checked={channels.includes("in_app")} onChange={() => toggle("in_app")} /> In-app notification</label>
          <label className="check"><input type="checkbox" checked={channels.includes("email")} onChange={() => toggle("email")} /> Email</label>
        </div>}
      </fieldset>

      <label className="field">
        Subject
        <input value={words.subject} onChange={set("subject")} maxLength={120} required placeholder="What it's about, in a few words" />
        <span className="field-hint">The email subject and the notification&apos;s text. {words.subject.length}/120</span>
      </label>
      <label className="field">
        Message
        <textarea value={words.message} onChange={set("message")} rows={8} maxLength={5000} required />
        <span className="field-hint">Plain text. Leave a blank line between paragraphs. {words.message.length.toLocaleString("en-US")}/5,000</span>
      </label>
      <div className="admin-send-link">
        <label className="field">
          Button link
          <input value={words.link} onChange={set("link")} inputMode="url" placeholder="/films" maxLength={300} />
          <span className="field-hint">A page on Pheelm. Leave empty for the home page.</span>
        </label>
        <label className="field">
          Button text
          <input value={words.label} onChange={set("label")} placeholder="Open Pheelm" maxLength={40} />
        </label>
      </div>

      <p className="admin-send-reach" role="status" aria-live="polite">
        {needsRef && !ref ? `Choose the ${audience === "followers" ? "director" : audience === "watchlisted" ? "film" : "member"}.`
          : !reach ? "Counting…"
          : !reach.ok ? reach.message
          : reach.recipients === 0 ? `No one would get this${reach.audience ? `: all ${plural(reach.audience, "person", "people")} turned it off or can't get email` : ""}.`
          : <>Reaches <strong>{plural(reach.recipients, "person", "people")}</strong>{!newsletter && draft.channels.length > 0 && <>: {[draft.channels.includes("in_app") ? `${reach.in_app.toLocaleString("en-US")} in-app` : "", draft.channels.includes("email") ? `${reach.emails.toLocaleString("en-US")} by email` : ""].filter(Boolean).join(", ")}</>}.
            {reach.audience > reach.recipients && <> {plural(reach.audience - reach.recipients, "other")} won&apos;t: they turned it off, or their email bounced.</>}</>}
      </p>

      {confirming ? (
        <div className="actions admin-send-confirm">
          <span>Send to {plural(count, "person", "people")} now? This can&apos;t be undone.</span>
          <button type="button" className="button small" onClick={send} disabled={!canSend}>{busy ? "Sending…" : "Yes, send"}</button>
          <button type="button" className="button ghost small" onClick={() => setConfirmKey(null)} disabled={busy}>Cancel</button>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="button small" onClick={() => setConfirmKey(confirmFor)} disabled={!canSend}>{count ? `Send to ${plural(count, "person", "people")}` : "Send"}</button>
          <button type="button" className="button ghost small" onClick={test} disabled={!written || busy}>{busy ? "Working…" : "Send test to me"}</button>
        </div>
      )}
      {!owner && <p className="muted">Only the owner can send. You can write a message and send yourself a test.</p>}
      {status && <p role="status" className={status.ok ? "notice ok" : "notice error"}>{status.message}</p>}
    </form>
  );
}
