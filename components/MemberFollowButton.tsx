"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import Icon from "./Icon";
import { openSignIn } from "./SignInSheet";
import { toast } from "./Toast";

/** The viewer's follow state is supplied once with search results; no per-card reads. */
export default function MemberFollowButton({ memberId, name, viewerId, initialFollowing, onChange }: {
  memberId: string;
  name: string;
  viewerId: string | null;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
}) {
  const path = usePathname();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const request = useRef({ generation: 0, busy: false });
  // Reset before paint when the result or signed-in viewer changes. An old request may
  // finish after that change or after unmount, but it must not update the new viewer.
  useLayoutEffect(() => {
    request.current.generation++;
    request.current.busy = false;
    setFollowing(initialFollowing);
    setBusy(false);
    return () => { request.current.generation++; request.current.busy = false; };
  }, [initialFollowing, memberId, viewerId]);

  if (memberId === viewerId) return null;
  if (!viewerId) return <Link className="button ghost" href={`/login?next=${encodeURIComponent(path)}`}
    onClick={event => { if (openSignIn()) event.preventDefault(); }} aria-label={`Follow ${name}`}>
    <Icon name="plus" />Follow
  </Link>;

  const toggle = async () => {
    const db = getBrowserClient();
    if (!db || request.current.busy) return;
    const generation = ++request.current.generation;
    request.current.busy = true;
    const current = () => request.current.generation === generation;
    setBusy(true);
    const next = !following;
    try {
      const { error } = next
        ? await db.from("member_follows").insert({ follower_id: viewerId, followed_id: memberId })
        : await db.from("member_follows").delete().eq("follower_id", viewerId).eq("followed_id", memberId);
      if (!current()) return;
      if (error) throw error;
      setFollowing(next);
      onChange?.(next);
      toast.success(next ? `Following ${name}` : `Unfollowed ${name}`);
    } catch {
      if (current()) toast.error("That didn’t save. Try again.");
    } finally {
      if (current()) { request.current.busy = false; setBusy(false); }
    }
  };

  return <button type="button" className="button ghost" onClick={toggle} disabled={busy}
    aria-busy={busy} aria-pressed={following} aria-label={following ? `Following ${name}. Unfollow` : `Follow ${name}`}>
    <Icon name={following ? "check" : "plus"} />{following ? "Following" : "Follow"}
  </button>;
}
