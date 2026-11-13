"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "@/lib/profile-activity";

const STEP = 5;

/** "Nov 12", with the year when it isn't this year. */
function when(iso: string) {
  const d = new Date(iso), now = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...(d.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" } : {}) });
}

/**
 * What the member did lately, one plain line each, linking to it. The first five show; Show more
 * adds five at a time, and moves focus to the first new line so keyboard users carry on from there.
 */
export default function ProfileActivity({ items }: { items: Activity[] }) {
  const [shown, setShown] = useState(STEP);
  const [focusFrom, setFocusFrom] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (focusFrom === null) return;
    list.current?.querySelectorAll("a")[focusFrom]?.focus();
    setFocusFrom(null);
  }, [focusFrom]);

  if (!items.length) return <span className="muted">No activity yet</span>;
  const rest = items.length - shown;
  return (
    <div className="profile-activity-wrap">
      <ul className="profile-activity" ref={list} id="profile-activity-list">
        {items.slice(0, shown).map((a) => (
          <li key={a.id}>
            <Link href={a.href}>{a.verb} <span className="profile-activity-title">{a.title}</span></Link>
            <time dateTime={a.at}>{when(a.at)}</time>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <button type="button" className="link-button profile-activity-more" aria-controls="profile-activity-list"
          onClick={() => { setFocusFrom(shown); setShown(shown + STEP); }}>
          Show more
        </button>
      )}
    </div>
  );
}
