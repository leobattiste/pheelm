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
export default function WatchedButton({ filmId }: { filmId: string }) {
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
  if (status === "loading") return <button type="button" className="button ghost" disabled aria-busy="true"><Icon name="eye" />Add to Watched</button>;
  if (status === "signed-out") {
    return (
      <Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`}
        onClick={(e) => { if (openSignIn()) e.preventDefault(); }}>
        <Icon name="eye" />
        Add to Watched
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
      if (next === "on") toast.success("Marked as watched. What did you think?", { action: { label: "Comment", href: `${path}#comments` } });
      else toast.success("Removed from Watched", { action: { label: "Undo", run: () => void apply(prev, next) } });
    }
  };

  return (
    <button type="button" className="button ghost" aria-pressed={status === "on"} onClick={toggle}>
      <Icon name={status === "on" ? "check" : "eye"} />
      {status === "on" ? "Watched" : "Add to Watched"}
    </button>
  );
}
