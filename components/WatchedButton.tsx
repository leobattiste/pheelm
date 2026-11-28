"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { myId, myIds, noteMine } from "@/lib/my-rows";
import Icon from "./Icon";
import { toast } from "./Toast";
import { openSignIn } from "./SignInSheet";

type Status = "loading" | "signed-out" | "off" | "on" | "unavailable";

/** "Add to Watched" in a film's menu: marks the film as seen, for the Watched tab on your profile. */
export default function WatchedButton({ filmId, title, className = "button ghost", iconOnly, filmHref }: { filmId: string; title: string; className?: string; iconOnly?: boolean; filmHref?: string }) {
  const text = (t: string) => (iconOnly ? <span className="visually-hidden">{t}</span> : t);
  const path = usePathname();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void myId().then(async id => {
      if (!live) return;
      setUserId(id);
      if (!id) return setStatus("signed-out");
      try { const mine = await myIds("watched"); if (live) setStatus(mine?.ids.has(filmId) ? "on" : "off"); }
      catch { if (live) setStatus("unavailable"); }
    });
    return () => { live = false; };
  }, [filmId]);

  if (status === "unavailable") return null;
  // Until we know, the button shows but waits: a signed-in member is never sent to Sign in.
  if (status === "loading") return <button type="button" className={className} disabled aria-busy="true" title="Add to Watched"><Icon name="eye" />{text("Add to Watched")}</button>;
  if (status === "signed-out") {
    return (
      <Link className={className} title="Add to Watched" href={`/login?next=${encodeURIComponent(path)}`}
        onClick={(e) => { if (openSignIn()) e.preventDefault(); }}>
        <Icon name="eye" />
        {text("Add to Watched")}
      </Link>
    );
  }

  const apply = async (next: "on" | "off", prev: "on" | "off") => {
    const db = getBrowserClient();
    if (!db || !userId) return false;
    setStatus(next);
    const { error } = next === "on"
      ? await db.from("watched").insert({ user_id: userId, film_id: filmId })
      : await db.from("watched").delete().eq("user_id", userId).eq("film_id", filmId);
    if (error) { setStatus(prev); toast.error("That didn’t save. Try again."); return false; }
    noteMine("watched", filmId, next === "on");
    return true;
  };
  const toggle = async () => {
    const prev = status === "on" ? "on" : "off";
    const next = prev === "on" ? "off" : "on";
    if (await apply(next, prev)) {
      if (next === "on") toast.success(`Marked as watched. Tell us what you think about “${title}”.`, { action: { label: "Join the discussion", href: `${filmHref ?? path}#comments` } });
      else toast.success("Removed from Watched", { action: { label: "Undo", run: () => void apply(prev, next) } });
    }
  };

  return (
    <button type="button" className={className} aria-pressed={status === "on"} onClick={toggle} title={status === "on" ? "Watched" : "Add to Watched"}>
      <Icon name={status === "on" ? "eyeOff" : "eye"} />
      {text(status === "on" ? "Watched" : "Add to Watched")}
    </button>
  );
}
