"use client";

import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Marks the notifications on screen as read after a moment, and tells the menu to update its dot.
 * They stay highlighted on this visit so you can still see what was new.
 */
export default function Seen({ ids }: { ids: string[] }) {
  useEffect(() => {
    const t = setTimeout(async () => {
      const db = getBrowserClient();
      if (!db || !ids.length) return;
      await db.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
      window.dispatchEvent(new Event("notificationschange"));
    }, 1500);
    return () => clearTimeout(t);
  }, [ids]);
  return null;
}
