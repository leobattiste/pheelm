"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Status = "loading" | "signed-out" | "off" | "on" | "unavailable";

const PLUS = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" /></svg>;
const CHECK = <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>;

/** Follow a director to see their new films on Pheelm as they're added. */
export default function FollowButton({ personId, name }: { personId: string; name: string }) {
  const path = usePathname();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setStatus("signed-out");
    db.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (!id) return setStatus("signed-out");
      const { data: row, error } = await db.from("follows").select("person_id").eq("user_id", id).eq("person_id", personId).maybeSingle();
      // Before supabase/follows.sql has run, the table doesn't exist: hide the button.
      if (error) return setStatus("unavailable");
      setStatus(row ? "on" : "off");
    });
  }, [personId]);

  if (status === "unavailable") return null;
  if (status === "signed-out" || status === "loading") {
    return (
      <Link className="pill-button" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}>
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
    if (error) setStatus(status);
  };

  return (
    <button type="button" className="pill-button" aria-pressed={status === "on"} onClick={toggle}
      aria-label={status === "on" ? `Following ${name}. Unfollow` : `Follow ${name}`}
      title={status === "on" ? "You'll see their new films in Your films → Following" : "See their new films when they're added"}>
      {status === "on" ? CHECK : PLUS}
      {status === "on" ? "Following" : "Follow"}
    </button>
  );
}
