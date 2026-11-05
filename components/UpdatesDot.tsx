"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

const SEEN_KEY = "updates-seen";

// One check per page load, shared by every dot on the page.
let check: Promise<string | null> | null = null;

/** The newest film added by a followed director, or null. */
function newestUpdate(): Promise<string | null> {
  return (check ??= (async () => {
    const db = getBrowserClient();
    if (!db) return null;
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;
    const { data, error } = await db.rpc("follow_updates");
    if (error || !data?.length) return null;
    return (data as { added_at: string }[])[0].added_at;
  })().catch(() => null));
}

/** Marks every current update as seen, and hides the dots. */
export function markUpdatesSeen(newest: string | null) {
  if (!newest) return;
  try {
    localStorage.setItem(SEEN_KEY, newest);
  } catch {}
  window.dispatchEvent(new Event("updates-seen"));
}

/** A small dot when a followed director has new films the member hasn't looked at yet. */
export default function UpdatesDot() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () =>
      newestUpdate().then((newest) => {
        let seen = "";
        try {
          seen = localStorage.getItem(SEEN_KEY) ?? "";
        } catch {}
        if (alive) setShow(!!newest && newest > seen);
      });
    read();
    window.addEventListener("updates-seen", read);
    return () => {
      alive = false;
      window.removeEventListener("updates-seen", read);
    };
  }, []);

  return show ? <span className="updates-dot" role="status" aria-label="New films from directors you follow" /> : null;
}

/** Placed on the Following tab: viewing it counts as seeing the updates. */
export function MarkSeen({ newest }: { newest: string | null }) {
  useEffect(() => markUpdatesSeen(newest), [newest]);
  return null;
}
