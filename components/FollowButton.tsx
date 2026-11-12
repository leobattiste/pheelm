"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import { toast } from "./Toast";
import { openSignIn } from "./SignInSheet";

type Status = "loading" | "signed-out" | "off" | "on";

/** Follow a director: you get a notification when a new film of theirs is added to Pheelm. */
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
      const { data: row } = await db.from("follows").select("person_id").eq("user_id", id).eq("person_id", personId).maybeSingle();
      setStatus(row ? "on" : "off");
    });
  }, [personId]);

  if (status === "signed-out" || status === "loading") {
    return (
      <Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}
        onClick={(e) => { if (status === "signed-out" && openSignIn()) e.preventDefault(); }}>
        <Icon name="plus" />
        Follow
      </Link>
    );
  }

  const apply = async (next: "on" | "off", prev: "on" | "off") => {
    const db = getBrowserClient();
    if (!db || !userId) return false;
    setStatus(next);
    setNote("");
    const { error } =
      next === "off"
        ? await db.from("follows").delete().eq("user_id", userId).eq("person_id", personId)
        : await db.from("follows").insert({ user_id: userId, person_id: personId });
    if (error) {
      setStatus(prev);
      toast.error("That didn’t save. Try again.");
      return false;
    }
    return true;
  };
  const toggle = async () => {
    const prev = status === "on" ? "on" : "off";
    const next = prev === "on" ? "off" : "on";
    if (await apply(next, prev)) {
      toast.success(next === "on" ? `Following ${name}. You’ll be notified of new films.` : `Unfollowed ${name}`, { action: { label: "Undo", run: () => void apply(prev, next) } });
    }
  };

  return (
    <span className="follow">
      <button type="button" className="button ghost" aria-pressed={status === "on"} onClick={toggle}
        aria-label={status === "on" ? `Following ${name}. Unfollow` : `Follow ${name}`}
        title={status === "on" ? "Unfollow" : "Get notified when their new films are added"}>
        <Icon name={status === "on" ? "check" : "plus"} />
        {status === "on" ? "Following" : "Follow"}
      </button>
      <span className="follow-note" role="status">{note}</span>
    </span>
  );
}
