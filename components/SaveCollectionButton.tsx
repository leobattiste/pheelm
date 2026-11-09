"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { openSignIn } from "./SignInSheet";
import Icon from "@/components/Icon";

type Status = "loading" | "signed-out" | "off" | "on" | "own" | "unavailable";

/** Follow a collection with explicit pending/error states and refreshed feed data. */
export default function SaveCollectionButton({ listId, ownerId }: { listId: string; ownerId: string }) {
  const path = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const request = useRef(0);
  const mounted = useRef(false);
  const locked = useRef(false);

  const load = useCallback(async () => {
    const sequence = ++request.current;
    const db = getBrowserClient();
    if (!db) { setStatus("signed-out"); return; }
    setStatus("loading");
    setNote("");
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (sequence !== request.current) return;
      const id = data.session?.user.id ?? null;
      setUserId(id);
      if (!id) { setStatus("signed-out"); return; }
      if (id === ownerId) { setStatus("own"); return; }
      const result = await db.from("list_saves").select("list_id").eq("list_id", listId).eq("user_id", id).maybeSingle();
      if (result.error) throw result.error;
      if (sequence === request.current) setStatus(result.data ? "on" : "off");
    } catch {
      if (sequence === request.current) { setStatus("unavailable"); setNote("Following status couldn’t be loaded. Try again."); }
    }
  }, [listId, ownerId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const db = getBrowserClient();
    const subscription = db?.auth.onAuthStateChange(() => { setTimeout(() => { if (mounted.current) void load(); }, 0); });
    return () => { mounted.current = false; request.current++; subscription?.data.subscription.unsubscribe(); };
  }, [load]);

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || !userId || locked.current || (status !== "on" && status !== "off")) return;
    locked.current = true;
    setBusy(true);
    setNote("");
    const next = status === "on" ? "off" : "on";
    try {
      const { error } = next === "on"
        ? await db.from("list_saves").insert({ list_id: listId, user_id: userId })
        : await db.from("list_saves").delete().eq("list_id", listId).eq("user_id", userId);
      if (error && !(next === "on" && error.code === "23505")) throw error;
      setStatus(next);
      setNote(next === "on" ? "Collection followed." : "Collection unfollowed.");
      router.refresh();
    } catch { setNote("That didn’t save. Try again."); }
    finally { locked.current = false; setBusy(false); }
  };

  if (status === "own") return null;
  if (status === "signed-out") return <span className="save-collection" data-keep-menu-open><Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`} onClick={(event) => { if (openSignIn()) event.preventDefault(); }}><Icon name="plus" />Follow</Link></span>;
  return <span className="save-collection" data-keep-menu-open>
    {status === "loading" ? <button type="button" className="button ghost" disabled aria-busy="true"><Icon name="plus" />Follow</button>
      : status === "unavailable" ? <button type="button" className="button ghost" onClick={() => void load()}>Try again</button>
      : <button type="button" className="button ghost" disabled={busy} aria-busy={busy} aria-pressed={status === "on"} onClick={toggle}><Icon name={status === "on" ? "check" : "plus"} />{status === "on" ? "Following" : "Follow"}</button>}
    {note && <span className="follow-note" role="status">{note}</span>}
  </span>;
}
