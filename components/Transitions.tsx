"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ComponentProps } from "react";

// The route change that a running view transition is waiting for.
let finishNavigation: (() => void) | null = null;

/** Lets a waiting view transition take its "after" picture once the new page has rendered. */
export function TransitionWatcher() {
  const path = usePathname();
  useEffect(() => {
    if (!finishNavigation) return;
    const done = finishNavigation;
    finishNavigation = null;
    // The film page's poster takes over the name the clicked card was given. Resolve right away:
    // the browser holds back animation frames while a transition waits, so rAF would never fire.
    document.documentElement.classList.remove("vt-from-card");
    done();
  }, [path]);
  return null;
}

/**
 * A link to a film whose poster glides into place as the film page's poster.
 * Falls back to an ordinary link where view transitions aren't supported or motion is reduced.
 */
export default function FilmLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();

  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };
        if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        e.preventDefault();
        const poster = e.currentTarget.querySelector<HTMLElement>("[data-poster]");
        // Only the clicked card's poster carries the shared name; the page we're leaving gives its own up.
        document.documentElement.classList.add("vt-from-card");
        if (poster) poster.style.viewTransitionName = "film-poster";
        const t = doc.startViewTransition(
          () =>
            new Promise<void>((resolve) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                if (finishNavigation === finish) finishNavigation = null;
                resolve();
              };
              finishNavigation = finish;
              router.push(href);
              // If the page is slow to arrive, stop holding the old picture.
              setTimeout(() => {
                document.documentElement.classList.remove("vt-from-card");
                finish();
              }, 1500);
            }),
        );
        t.finished.finally(() => {
          if (poster) poster.style.viewTransitionName = "";
        });
      }}
    />
  );
}
