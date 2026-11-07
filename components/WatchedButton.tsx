"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";

type Status = "loading" | "signed-out" | "off" | "on" | "unavailable";

/** "Add to Watched" in a film's menu: marks the film as seen, for the Watched tab on your profile. */
export default function WatchedButton({ filmId }: { filmId: string }) {
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
      const { data: row, error } = await db.from("watched").select("film_id").eq("user_id", id).eq("film_id", filmId).maybeSingle();
      setStatus(error ? "unavailable" : row ? "on" : "off");
    });
  }, [filmId]);

  if (status === "unavailable") return null;
  if (status === "signed-out" || status === "loading") {
    return (
      <Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}
        onClick={(e) => { if (status === "signed-out" && openSignIn()) e.preventDefault(); }}>
        <Icon name="eye" />
        Add to Watched
      </Link>
    );
  }

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const next = status === "on" ? "off" : "on";
    setStatus(next);
    const { error } = next === "on"
      ? await db.from("watched").insert({ user_id: userId, film_id: filmId })
      : await db.from("watched").delete().eq("user_id", userId).eq("film_id", filmId);
    if (error) setStatus(status);
  };

  return (
    <button type="button" className="button ghost" aria-pressed={status === "on"} onClick={toggle}>
      <Icon name={status === "on" ? "check" : "eye"} />
      {status === "on" ? "Watched" : "Add to Watched"}
    </button>
  );
}
