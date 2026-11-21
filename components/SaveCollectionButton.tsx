"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { myId, myIds, noteMine } from "@/lib/my-rows";
import { openSignIn } from "./SignInSheet";
import Icon from "@/components/Icon";
import { toast } from "./Toast";

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
    let live = true;
    void myId().then(async id => {
      if (!live) return;
      setUserId(id);
      if (!id) return setStatus("signed-out");
      if (id === ownerId) return setStatus("own");
      try { const mine = await myIds("list_saves"); if (live) setStatus(mine?.ids.has(listId) ? "on" : "off"); }
      catch { if (live) setStatus("unavailable"); }
    });
    return () => { live = false; };
  }, [listId, ownerId]);

  if (status === "own" || status === "unavailable") return null;
  // Until we know, the button shows but waits: a signed-in member is never sent to Sign in.
  if (status === "loading") return <span className="save-collection"><button type="button" className="button ghost" disabled aria-busy="true">{PLUS}Follow</button></span>;
  if (status === "signed-out") {
    return (
      <span className="save-collection">
        <Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`}
        onClick={(e) => { if (openSignIn()) e.preventDefault(); }}>{PLUS}Follow</Link>
      </span>
    );
  }

  const apply = async (next: "on" | "off", prev: "on" | "off") => {
    const db = getBrowserClient();
    if (!db || !userId) return false;
    setStatus(next);
    const { error } = next === "on"
      ? await db.from("list_saves").insert({ list_id: listId, user_id: userId })
      : await db.from("list_saves").delete().eq("list_id", listId).eq("user_id", userId);
    if (error) { setStatus(prev); toast.error("That didn’t save. Try again."); return false; }
    noteMine("list_saves", listId, next === "on");
    return true;
  };
  const toggle = async () => {
    const prev = status === "on" ? "on" : "off";
    const next = prev === "on" ? "off" : "on";
    if (await apply(next, prev)) {
      toast.success(next === "on" ? "Following this watchlist" : "Unfollowed this watchlist", { action: { label: "Undo", run: () => void apply(prev, next) } });
    }
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
