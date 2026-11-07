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

/** Saves someone's collection to your Watchlist page, with the public count of everyone who has. */
export default function SaveCollectionButton({ listId, ownerId, initialSaves }: { listId: string; ownerId: string; initialSaves: number }) {
  const path = usePathname();
  const [status, setStatus] = useState<Status>("loading");
  const [saves, setSaves] = useState(initialSaves);
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

  const count = <span className="save-count-label">{saves ? `Saved by ${saves}` : "No saves yet"}</span>;

  if (status === "own" || status === "unavailable") return <span className="save-collection">{count}</span>;
  if (status === "signed-out" || status === "loading") {
    return (
      <span className="save-collection">
        <Link className="button ghost small" href={`/login?next=${encodeURIComponent(path)}`} aria-busy={status === "loading"}
        onClick={(e) => { if (status === "signed-out" && openSignIn()) e.preventDefault(); }}>{PLUS}Save</Link>
        {count}
      </span>
    );
  }

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || !userId) return;
    const next = status === "on" ? "off" : "on";
    setStatus(next);
    setSaves((n) => n + (next === "on" ? 1 : -1));
    const { error } = next === "on"
      ? await db.from("list_saves").insert({ list_id: listId, user_id: userId })
      : await db.from("list_saves").delete().eq("list_id", listId).eq("user_id", userId);
    if (error) {
      setStatus(status);
      setSaves((n) => n + (next === "on" ? -1 : 1));
    }
  };

  return (
    <span className="save-collection">
      <button type="button" className="button ghost small" aria-pressed={status === "on"} onClick={toggle}>
        {status === "on" ? CHECK : PLUS}
        {status === "on" ? "Saved" : "Save"}
      </button>
      {count}
    </span>
  );
}
