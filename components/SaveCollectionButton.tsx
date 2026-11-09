"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";
import Icon from "@/components/Icon";

type Status = "loading" | "signed-out" | "off" | "on" | "own" | "unavailable";
const PLUS = <Icon name="plus" />;
const CHECK = <Icon name="check" />;

/**
 * Follows a collection: it shows on your Watchlist page, and you're notified when a film is added.
 * How many people follow a collection is never shown.
 */
export default function SaveCollectionButton({ listId, ownerId }: { listId: string; ownerId: string }) {
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
      if (id === ownerId) return setStatus("own");
      const { data: row, error } = await db.from("list_saves").select("list_id").eq("list_id", listId).eq("user_id", id).maybeSingle();
      if (error) return setStatus("unavailable");
      setStatus(row ? "on" : "off");
    });
  }, [listId, ownerId]);

  if (status === "own" || status === "unavailable") return null;
  if (status === "signed-out" || status === "loading") {
    return (
      <span className="save-collection">
        <Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}
        onClick={(e) => { if (status === "signed-out" && openSignIn()) e.preventDefault(); }}>{PLUS}Follow</Link>
      </span>
    );
  }

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const next = status === "on" ? "off" : "on";
    setStatus(next);
    const { error } = next === "on"
      ? await db.from("list_saves").insert({ list_id: listId, user_id: userId })
      : await db.from("list_saves").delete().eq("list_id", listId).eq("user_id", userId);
    if (error) setStatus(status);
  };

  return (
    <span className="save-collection">
      <button type="button" className="button ghost" aria-pressed={status === "on"} onClick={toggle}>
        {status === "on" ? CHECK : PLUS}
        {status === "on" ? "Following" : "Follow"}
      </button>
    </span>
  );
}
