"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";

type Status = "loading" | "signed-out" | "off" | "on" | "unavailable";

const PLUS = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>;
const CHECK = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>;

/** Follow a director to see their new films on Pheelm as they're added. */
export default function FollowButton({ personId, name }: { personId: string; name: string }) {
  const path = usePathname();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setStatus("signed-out");
    db.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (!id) return setStatus("signed-out");
      const { data: row, error } = await db.from("follows").select("person_id").eq("user_id", id).eq("person_id", personId).maybeSingle();
      // Before supabase/follows.sql has run, the table doesn't exist. The button still shows, and
      // says so when pressed, rather than vanishing.
      if (error) {
        console.warn("Follow is off: run supabase/follows.sql in Supabase.", error.message);
        return setStatus("unavailable");
      }
      setStatus(row ? "on" : "off");
    });
  }, [personId]);

  if (status === "unavailable") {
    return (
      <span className="follow">
        <button type="button" className="pill-button" onClick={() => setNote("Following isn’t available yet. Check back soon.")}>
          {PLUS}
          Follow
        </button>
        <span className="follow-note" role="status">{note}</span>
      </span>
    );
  }
  if (status === "signed-out" || status === "loading") {
    return (
      <Link className="pill-button" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}
        onClick={(e) => { if (status === "signed-out" && openSignIn()) e.preventDefault(); }}>
        {PLUS}
        Follow
      </Link>
    );
  }

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const next = status === "on" ? "off" : "on";
    setStatus(next);
    const { error } =
      next === "off"
        ? await db.from("follows").delete().eq("user_id", userId).eq("person_id", personId)
        : await db.from("follows").insert({ user_id: userId, person_id: personId });
    if (error) {
      setStatus(status);
      setNote("That didn’t save. Try again.");
    }
  };

  return (
    <span className="follow">
    <button type="button" className="pill-button" aria-pressed={status === "on"} onClick={toggle}
      aria-label={status === "on" ? `Following ${name}. Unfollow` : `Follow ${name}`}
      title={status === "on" ? "You'll see their new films in Your films → Following" : "See their new films when they're added"}>
      {status === "on" ? CHECK : PLUS}
      {status === "on" ? "Following" : "Follow"}
    </button>
    <span className="follow-note" role="status">{note}</span>
    </span>
  );
}
