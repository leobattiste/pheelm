"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

const GROUPS = [
  { title: "Films & collections", items: [
    ["new_film", "New films from directors you follow"],
    ["collection_film", "Films added to collections you follow"],
    ["featured", "Your collection is featured"],
  ] },
  { title: "Community activity", items: [
    ["comment", "Comments on your collections"],
    ["reply", "Replies to your comments"],
    ["mention", "Mentions"],
  ] },
  { title: "Collaboration", items: [
    ["invite", "Co-curator invitations"],
    ["request", "Co-curator requests"],
    ["invite_accepted", "Invitations accepted"],
    ["invite_declined", "Invitations declined"],
    ["request_accepted", "Requests accepted"],
    ["request_declined", "Requests declined"],
    ["removed", "Removed from a collection"],
  ] },
  { title: "Administration", items: [
    ["report", "Collection reports"],
    ["comment_report", "Comment reports"],
    ["submission", "Film suggestions"],
    ["message", "Messages"],
    ["new_member", "New members"],
  ] },
] as const;

export default function NotificationPreferences({ userId, initialDisabled, isAdmin }: { userId: string; initialDisabled: string[]; isAdmin: boolean }) {
  const [disabled, setDisabled] = useState<string[]>(initialDisabled);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const toggle = async (type: string) => {
    if (saving) return;
    const next = disabled.includes(type) ? disabled.filter((t) => t !== type) : [...disabled, type];
    setSaving(type);
    setError("");
    const db = getBrowserClient();
    if (!db) { setError("Settings are unavailable right now."); setSaving(null); return; }
    const { error: issue } = await db.from("notification_preferences").upsert({ user_id: userId, disabled_types: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (issue) setError("Could not save your preference. Please try again.");
    else setDisabled(next);
    setSaving(null);
  };
  return (
    <div className="form settings-form">
      <p className="muted">Choose which notifications appear in Pheelm. Changes are saved to your account and apply to new notifications.</p>
      {GROUPS.filter((g) => isAdmin || g.title !== "Administration").map((group) => (
        <section className="account-section" key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map(([type, label]) => (
            <label className="switch-row" key={type}>
              <span className="switch-label">{label}</span>
              <input type="checkbox" role="switch" className="switch" checked={!disabled.includes(type)} disabled={!!saving} onChange={() => void toggle(type)} aria-label={label} />
            </label>
          ))}
        </section>
      ))}
      {error && <p role="alert" className="muted">{error}</p>}
    </div>
  );
}
